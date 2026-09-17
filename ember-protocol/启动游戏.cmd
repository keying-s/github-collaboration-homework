@echo off
cd /d "%~dp0"

where pwsh.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PowerShell 7 ^(pwsh.exe^) is required.
  echo Download it from https://aka.ms/powershell-release?tag=stable
  pause
  exit /b 1
)

pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-game.ps1"
