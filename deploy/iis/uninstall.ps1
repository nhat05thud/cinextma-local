<#
.SYNOPSIS
  Gỡ site IIS, app pool và Windows Service của Cinextma. KHÔNG xoá database và thư mục media.
    powershell -ExecutionPolicy Bypass -File deploy\iis\uninstall.ps1
#>
param(
  [string]$SiteName = "Cinextma",
  [string]$ServiceName = "CinextmaWeb",
  [string]$HostName = "cinextma.local",
  [int]$LanPort = 8080
)

$appcmd = Join-Path $env:windir "System32\inetsrv\appcmd.exe"
$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source

if ($nssm -and (Get-Service $ServiceName -ErrorAction SilentlyContinue)) {
  & $nssm stop $ServiceName | Out-Null
  & $nssm remove $ServiceName confirm | Out-Null
  Write-Host "Đã gỡ service $ServiceName"
}
& $appcmd delete site $SiteName 2>$null | Out-Null
& $appcmd delete apppool $SiteName 2>$null | Out-Null
Write-Host "Đã gỡ IIS site / app pool $SiteName"

Get-NetFirewallRule -DisplayName "Cinextma HTTP $LanPort" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$hosts = Join-Path $env:windir "System32\drivers\etc\hosts"
(Get-Content $hosts) | Where-Object { $_ -notmatch "\s$([regex]::Escape($HostName))\s*$" } | Set-Content $hosts -Encoding ASCII
Write-Host "Đã xoá firewall rule và dòng hosts. Database (data\) và media (storage\) được giữ nguyên."
