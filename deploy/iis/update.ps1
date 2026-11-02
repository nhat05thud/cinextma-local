<#
.SYNOPSIS
  Cập nhật Cinextma sau khi sửa code: cài package, migrate DB, build lại và khởi động lại service.
  Chạy bằng PowerShell "Run as Administrator":
    powershell -ExecutionPolicy Bypass -File deploy\iis\update.ps1
#>
param([string]$ServiceName = "CinextmaWeb")

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))

$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) { throw "Không tìm thấy nssm. Chạy setup-iis.ps1 trước." }

Write-Host "==> Cài package" -ForegroundColor Cyan
npm install --no-audit --no-fund
if ($LASTEXITCODE) { throw "npm install lỗi" }

Write-Host "==> Migrate database" -ForegroundColor Cyan
npm run db:deploy
if ($LASTEXITCODE) { throw "Migration lỗi" }

Write-Host "==> Dừng service & build" -ForegroundColor Cyan
& $nssm stop $ServiceName | Out-Null
npm run build
$buildFailed = $LASTEXITCODE

Write-Host "==> Khởi động service" -ForegroundColor Cyan
& $nssm start $ServiceName | Out-Null
if ($buildFailed) { throw "Build lỗi - service vẫn chạy bản build cũ (nếu còn)." }
Write-Host "Xong." -ForegroundColor Green
