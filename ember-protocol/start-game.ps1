$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Stop-WithMessage {
  param(
    [string]$Chinese,
    [string]$English
  )

  Write-Host "[错误 / ERROR] $Chinese" -ForegroundColor Red
  Write-Host $English -ForegroundColor Red
  Read-Host '按 Enter 关闭 / Press Enter to close'
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithMessage '请先安装 Node.js 22.12 或更新版本。' 'Install Node.js 22.12 or newer before starting the game.'
}

if (-not (Test-Path -LiteralPath 'node_modules')) {
  Write-Host '正在安装依赖... / Installing dependencies...'
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage '依赖安装失败。' 'Dependency installation failed.'
  }
}

Write-Host '正在关闭旧的 5173 服务... / Stopping the previous server on port 5173...'
$owners = @(
  Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
)

foreach ($ownerId in $owners) {
  try {
    Stop-Process -Id $ownerId -Force -ErrorAction Stop
  } catch {
    Stop-WithMessage "无法结束占用端口 5173 的进程 $ownerId。" "Could not stop process $ownerId on port 5173."
  }
}

$deadline = (Get-Date).AddSeconds(5)
while (
  (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) -and
  (Get-Date) -lt $deadline
) {
  Start-Sleep -Milliseconds 200
}

if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
  Stop-WithMessage '无法释放端口 5173，请关闭占用它的程序后重试。' 'Port 5173 could not be released. Close the program using it and try again.'
}

Write-Host ''
Write-Host '游戏地址 / Game URL: http://localhost:5173'
Write-Host '关闭此窗口会停止游戏服务。 / Closing this window stops the game server.'
Write-Host ''

& npm.cmd run dev
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage '游戏服务启动失败。' 'The game server failed to start.'
}
