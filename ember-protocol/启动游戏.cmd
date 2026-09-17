@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.12 或更新版本。
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo 游戏地址：http://localhost:5173
echo 如果提示端口被占用，请直接打开该地址。
echo 关闭此窗口会停止游戏服务。
echo.
call npm.cmd run dev
pause
