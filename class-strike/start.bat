@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   CLASS STRIKE  正在启动本地服务器...
echo   浏览器将自动打开，请勿关闭本窗口
echo ============================================
start "" "http://localhost:8137"
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8137
  goto :end
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8137
  goto :end
)
where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes http-server -p 8137 -c-1
  goto :end
)
echo 未找到 Python 或 Node.js，请先安装其中之一。
pause
:end
