<#
.SYNOPSIS
  Cài Cinextma lên IIS (Windows 10/11, Windows Server). Chạy bằng PowerShell "Run as Administrator".

.DESCRIPTION
  1. Bật IIS (nếu chưa có), cài URL Rewrite 2.1 + ARR 3.0 + NSSM qua winget
  2. Bật reverse proxy của ARR (giữ Host header, không buffer response để stream HTML)
  3. Build ứng dụng, chạy migration database
  4. Tạo Windows Service "CinextmaWeb" chạy Next.js tại 127.0.0.1:<AppPort>
  5. Tạo IIS site: <HostName>:<Port> (+ cổng LAN), virtual directory /media trỏ thẳng vào thư mục media
  6. Thêm tên miền vào file hosts, mở firewall cho cổng LAN

  Chạy lại script nhiều lần được (idempotent).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\iis\setup-iis.ps1
  powershell -ExecutionPolicy Bypass -File deploy\iis\setup-iis.ps1 -HostName phim.local -LanPort 8080 -SkipBuild
#>
[CmdletBinding()]
param(
  [string]$SiteName = "Cinextma",
  [string]$HostName = "cinextma.local",
  [int]$Port = 80,
  # Cổng không cần tên miền để máy khác trong mạng LAN truy cập bằng IP (0 = tắt)
  [int]$LanPort = 8080,
  [int]$AppPort = 3000,
  [string]$ServiceName = "CinextmaWeb",
  # Để trống = thư mục gốc dự án (2 cấp trên thư mục chứa script)
  [string]$ProjectDir = "",
  [switch]$SkipBuild,
  [switch]$SkipInstall,
  # Ghi toàn bộ output ra file (dùng khi chạy qua UAC, cửa sổ admin tự đóng)
  [string]$LogFile = ""
)

$ErrorActionPreference = "Stop"
if ($LogFile) {
  New-Item -ItemType Directory -Force (Split-Path -Parent $LogFile) | Out-Null
  Start-Transcript -Path $LogFile -Force | Out-Null
}
# Lỗi bất kỳ: ghi rõ ra log rồi thoát với mã 1
trap {
  Write-Host "DEPLOY_FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host $_.ScriptStackTrace
  if ($LogFile) { Stop-Transcript | Out-Null }
  exit 1
}
# Windows PowerShell 5.1 chưa gán $PSScriptRoot khi tính giá trị mặc định trong param(), nên tính ở đây
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $ProjectDir) { $ProjectDir = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path }
$appcmd = Join-Path $env:windir "System32\inetsrv\appcmd.exe"

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Warn($text) { Write-Host "    $text" -ForegroundColor Yellow }

# Lưu ý: tham số appcmd phải viết dạng /section:... — PowerShell tách "-section:x" thành 2 đối số.
function Invoke-AppCmd {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { $output = & $appcmd @args 2>&1 } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw "appcmd $($args -join ' ') => $output" }
  return $output
}

function Get-DotEnv([string]$file) {
  $values = @{}
  if (Test-Path $file) {
    foreach ($line in Get-Content $file -Encoding UTF8) {
      if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$') { $values[$Matches[1]] = $Matches[2] }
    }
  }
  return $values
}

function Set-DotEnvValue([string]$file, [string]$key, [string]$value) {
  $content = Get-Content $file -Raw -Encoding UTF8
  $line = "$key=`"$value`""
  if ($content -match "(?m)^\s*$key\s*=.*$") { $content = [regex]::Replace($content, "(?m)^\s*$key\s*=.*$", $line) }
  else { $content = $content.TrimEnd() + "`r`n$line`r`n" }
  [IO.File]::WriteAllText($file, $content, (New-Object System.Text.UTF8Encoding($false)))
}

# ---------------------------------------------------------------------------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Hãy mở PowerShell bằng 'Run as Administrator' rồi chạy lại script."
}
# Chỉ một lần deploy tại một thời điểm: lần chạy sau chờ lần trước xong (tối đa 30 phút).
# Mutex tự nhả khi tiến trình kết thúc, kể cả khi script lỗi giữa chừng.
$deployMutex = New-Object System.Threading.Mutex($false, "Global\CinextmaDeploy")
try { $acquired = $deployMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
if (-not $acquired) {
  Write-Host "Đang có một lần deploy khác chạy, chờ nó xong..." -ForegroundColor Yellow
  try { $acquired = $deployMutex.WaitOne([TimeSpan]::FromMinutes(30)) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
  if (-not $acquired) { throw "Lần deploy khác chạy quá 30 phút, hãy kiểm tra lại." }
}
Set-Location $ProjectDir
Write-Host "Thư mục dự án: $ProjectDir"

$envFile = Join-Path $ProjectDir ".env"
if (-not (Test-Path $envFile)) { throw "Chưa có file .env. Sao chép .env.example thành .env và chỉnh sửa trước." }

# ---------------------------------------------------------------------------
Step "Kiểm tra IIS"
$features = @("IIS-WebServerRole", "IIS-WebServer", "IIS-CommonHttpFeatures", "IIS-StaticContent", "IIS-DefaultDocument",
  "IIS-HttpErrors", "IIS-RequestFiltering", "IIS-HttpCompressionStatic", "IIS-ManagementConsole", "IIS-ManagementScriptingTools")
$missing = $features | Where-Object { (Get-WindowsOptionalFeature -Online -FeatureName $_).State -ne "Enabled" }
if ($missing) {
  Warn "Bật các tính năng IIS: $($missing -join ', ')"
  Enable-WindowsOptionalFeature -Online -FeatureName $missing -All -NoRestart | Out-Null
}
Ok "IIS sẵn sàng"

if (-not $SkipInstall) {
  Step "Cài URL Rewrite, ARR, NSSM (winget)"
  $packages = @(
    @{ Id = "Microsoft.IIS.URLRewrite"; Check = { Test-Path (Join-Path $env:windir "System32\inetsrv\rewrite.dll") } },
    @{ Id = "Microsoft.IIS.ApplicationRequestRouting"; Check = { Test-Path (Join-Path $env:ProgramFiles "IIS\Application Request Routing\requestRouter.dll") } },
    @{ Id = "NSSM.NSSM"; Check = { [bool](Get-Command nssm -ErrorAction SilentlyContinue) } }
  )
  foreach ($pkg in $packages) {
    if (& $pkg.Check) { Ok "$($pkg.Id) đã có"; continue }
    winget install --id $pkg.Id -e --silent --accept-source-agreements --accept-package-agreements --scope machine
    if ($LASTEXITCODE -ne 0) { winget install --id $pkg.Id -e --silent --accept-source-agreements --accept-package-agreements }
    Ok "Đã cài $($pkg.Id)"
  }
  # Nạp lại PATH để thấy nssm vừa cài
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) {
  $nssm = Get-ChildItem "$env:ProgramFiles\WinGet\Packages", "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter nssm.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "win64" } | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $nssm) { throw "Không tìm thấy nssm.exe. Cài thủ công: winget install NSSM.NSSM" }

# ---------------------------------------------------------------------------
Step "Bật reverse proxy (ARR)"
Invoke-AppCmd set config /section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" `
  /reverseRewriteHostInResponseHeaders:"False" /timeout:"01:00:00" /commit:apphost | Out-Null
# Không buffer response để HTML của Next.js được stream ngay
try { Invoke-AppCmd set config /section:system.webServer/proxy /responseBufferLimit:"0" /commit:apphost | Out-Null }
catch { Warn "Không đặt được responseBufferLimit: $($_.Exception.Message)" }
$allowed = Invoke-AppCmd list config /section:system.webServer/rewrite/allowedServerVariables
foreach ($var in @("HTTP_X_FORWARDED_PROTO", "HTTP_X_FORWARDED_HOST", "HTTP_X_REAL_IP")) {
  if (-not ($allowed -match $var)) {
    Invoke-AppCmd set config /section:system.webServer/rewrite/allowedServerVariables "/+[name='$var']" /commit:apphost | Out-Null
  }
}
Ok "ARR proxy: bật, giữ Host header, không buffer response"

# ---------------------------------------------------------------------------
Step "Cấu hình .env cho IIS"
$publicUrl = if ($Port -eq 80) { "http://$HostName" } else { "http://${HostName}:$Port" }
$dotenv = Get-DotEnv $envFile
if (-not $dotenv["BETTER_AUTH_URL"] -or $dotenv["BETTER_AUTH_URL"] -match "localhost") {
  Set-DotEnvValue $envFile "BETTER_AUTH_URL" $publicUrl
  Ok "BETTER_AUTH_URL=$publicUrl"
}
$origins = @($publicUrl, "http://localhost:$AppPort")
if ($dotenv["TRUSTED_ORIGINS"]) { $origins += $dotenv["TRUSTED_ORIGINS"].Split(",") }
Set-DotEnvValue $envFile "TRUSTED_ORIGINS" (($origins | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique) -join ",")

# ffmpeg, yt-dlp, deno: service chạy bằng tài khoản SYSTEM không thấy PATH của user -> ghi đường dẫn tuyệt đối
$dotenv = Get-DotEnv $envFile
$tools = @(
  @{ Name = "ffmpeg"; Key = "FFMPEG_PATH"; Install = "winget install Gyan.FFmpeg" },
  @{ Name = "ffprobe"; Key = "FFPROBE_PATH"; Install = "winget install Gyan.FFmpeg" },
  @{ Name = "yt-dlp"; Key = "YTDLP_PATH"; Install = "winget install yt-dlp.yt-dlp" },
  @{ Name = "deno"; Key = "DENO_PATH"; Install = "winget install DenoLand.Deno" }
)
foreach ($tool in $tools) {
  $key = $tool.Key
  if (-not $dotenv[$key] -or -not (Test-Path $dotenv[$key])) {
    $found = (Get-Command $tool.Name -ErrorAction SilentlyContinue).Source
    if ($found) {
      $target = (Get-Item $found).Target
      if ($target) { $found = $target | Select-Object -First 1 }
      Set-DotEnvValue $envFile $key ($found -replace "\\", "/")
      Ok "$key=$found"
    } else {
      Warn "Không tìm thấy $($tool.Name). Cài bằng: $($tool.Install) rồi chạy lại script."
    }
  }
}

$dotenv = Get-DotEnv $envFile
$mediaRoot = if ($dotenv["MEDIA_ROOT"]) { $dotenv["MEDIA_ROOT"] } else { "./storage" }
if (-not [IO.Path]::IsPathRooted($mediaRoot)) { $mediaRoot = Join-Path $ProjectDir $mediaRoot }
$mediaRoot = [IO.Path]::GetFullPath($mediaRoot)
$mediaPublic = Join-Path $mediaRoot "public"
New-Item -ItemType Directory -Force $mediaPublic, (Join-Path $mediaRoot "private"), (Join-Path $ProjectDir "logs") | Out-Null
Ok "Thư mục media: $mediaRoot"

# ---------------------------------------------------------------------------
Step "Build ứng dụng"
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Chưa cài Node.js (>= 20). Cài: winget install OpenJS.NodeJS.LTS" }
if (-not (Test-Path (Join-Path $ProjectDir "node_modules"))) { npm install --no-audit --no-fund; if ($LASTEXITCODE) { throw "npm install lỗi" } }
npm run db:deploy
if ($LASTEXITCODE) { throw "Migration database lỗi" }
if (-not $SkipBuild -or -not (Test-Path (Join-Path $ProjectDir ".next\BUILD_ID"))) {
  # Dừng service cũ để không khoá file .next
  $hadService = [bool](Get-Service $ServiceName -ErrorAction SilentlyContinue)
  if ($hadService) { & $nssm stop $ServiceName | Out-Null }
  npm run build
  if ($LASTEXITCODE) {
    # Không để site sập: bật lại service (dùng bản build cũ nếu còn) rồi mới báo lỗi
    if ($hadService) { & $nssm start $ServiceName | Out-Null; Warn "Build lỗi - đã bật lại service $ServiceName" }
    throw "Build lỗi"
  }
}
Ok "Build xong"

# ---------------------------------------------------------------------------
Step "Windows Service $ServiceName (Next.js tại 127.0.0.1:$AppPort)"
$nextBin = Join-Path $ProjectDir "node_modules\next\dist\bin\next"
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
  & $nssm stop $ServiceName | Out-Null
} else {
  & $nssm install $ServiceName $node | Out-Null
}
& $nssm set $ServiceName Application $node | Out-Null
& $nssm set $ServiceName AppParameters "`"$nextBin`" start -p $AppPort -H 127.0.0.1" | Out-Null
& $nssm set $ServiceName AppDirectory $ProjectDir | Out-Null
& $nssm set $ServiceName AppEnvironmentExtra "NODE_ENV=production" | Out-Null
& $nssm set $ServiceName DisplayName "Cinextma Web (Next.js)" | Out-Null
& $nssm set $ServiceName Description "Website xem phim Cinextma - IIS reverse proxy tới cổng $AppPort" | Out-Null
& $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $nssm set $ServiceName AppStdout (Join-Path $ProjectDir "logs\web.out.log") | Out-Null
& $nssm set $ServiceName AppStderr (Join-Path $ProjectDir "logs\web.err.log") | Out-Null
& $nssm set $ServiceName AppRotateFiles 1 | Out-Null
& $nssm set $ServiceName AppRotateOnline 1 | Out-Null
& $nssm set $ServiceName AppRotateBytes 10485760 | Out-Null
# Cho ffmpeg thời gian dọn dẹp khi dừng service
& $nssm set $ServiceName AppStopMethodConsole 15000 | Out-Null
& $nssm start $ServiceName | Out-Null
Ok "Service đã chạy (log: logs\web.out.log)"

# ---------------------------------------------------------------------------
Step "IIS site $SiteName"
$siteDir = Join-Path $ProjectDir "deploy\iis\site"
New-Item -ItemType Directory -Force $siteDir | Out-Null
(Get-Content (Join-Path $ScriptDir "site.web.config") -Raw -Encoding UTF8).Replace("__APP_PORT__", "$AppPort") |
  Set-Content (Join-Path $siteDir "web.config") -Encoding UTF8
Copy-Item (Join-Path $ScriptDir "media.web.config") (Join-Path $mediaPublic "web.config") -Force

$pools = Invoke-AppCmd list apppool /text:name
if (-not ($pools -contains $SiteName)) {
  Invoke-AppCmd add apppool /name:$SiteName /managedRuntimeVersion:"" /managedPipelineMode:Integrated | Out-Null
}
Invoke-AppCmd set apppool $SiteName /processModel.idleTimeout:"00:00:00" | Out-Null

$sites = Invoke-AppCmd list site /text:name
if ($sites -contains $SiteName) { Invoke-AppCmd delete site $SiteName | Out-Null }
$bindings = "http/*:${Port}:$HostName"
if ($LanPort -gt 0) { $bindings += ",http/*:${LanPort}:" }
Invoke-AppCmd add site /name:$SiteName /physicalPath:"$siteDir" /bindings:$bindings | Out-Null
Invoke-AppCmd set app "$SiteName/" /applicationPool:$SiteName | Out-Null
Invoke-AppCmd add vdir /app.name:"$SiteName/" /path:/media /physicalPath:"$mediaPublic" | Out-Null

# Quyền đọc cho tài khoản app pool và IUSR (tài khoản IIS dùng cho khách ẩn danh khi phục vụ file tĩnh)
foreach ($dir in @($siteDir, $mediaPublic)) {
  icacls $dir /grant "IIS AppPool\${SiteName}:(OI)(CI)RX" /grant "IIS_IUSRS:(OI)(CI)RX" /grant "IUSR:(OI)(CI)RX" /Q | Out-Null
}
# Site mới tạo thường đã tự chạy; lệnh start lúc đó báo lỗi nhưng không sao
try { Invoke-AppCmd start site $SiteName | Out-Null } catch { }
Ok "Site: $bindings"

# ---------------------------------------------------------------------------
Step "Tên miền & firewall"
$hosts = Join-Path $env:windir "System32\drivers\etc\hosts"
if (-not (Select-String -Path $hosts -Pattern "\s$([regex]::Escape($HostName))\s*$" -Quiet)) {
  Add-Content -Path $hosts -Value "`r`n127.0.0.1`t$HostName" -Encoding ASCII
  Ok "Đã thêm $HostName vào file hosts"
}
if ($LanPort -gt 0) {
  $ruleName = "Cinextma HTTP $LanPort"
  if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $LanPort -Action Allow -Profile Private, Domain | Out-Null
    Ok "Đã mở firewall cổng $LanPort (mạng Private/Domain)"
  }
}

# ---------------------------------------------------------------------------
Step "Kiểm tra"
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort/api/auth/get-session" -UseBasicParsing -TimeoutSec 5
    $ok = $response.StatusCode -eq 200
  } catch { Start-Sleep -Seconds 2 }
}
if ($ok) { Ok "Next.js đang chạy" } else { Warn "Next.js chưa phản hồi, xem logs\web.err.log" }

$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^(127|169\.254)\." }).IPAddress
Write-Host "`nHoàn tất! Mở trình duyệt:" -ForegroundColor Green
Write-Host "   $publicUrl            (máy này)"
if ($LanPort -gt 0) { $ips | ForEach-Object { Write-Host "   http://${_}:$LanPort   (máy khác trong mạng LAN)" } }
Write-Host "   $publicUrl/admin      (trang quản trị)"
Write-Host $(if ($ok) { "DEPLOY_OK" } else { "DEPLOY_DONE_BUT_APP_NOT_RESPONDING" })
if ($LogFile) { Stop-Transcript | Out-Null }
