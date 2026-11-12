@echo off
setlocal
cd /d "%~dp0desktop"
where node >nul 2>&1
if errorlevel 1 goto fail
call npm ci
if errorlevel 1 goto fail
call npm run install:binary
if errorlevel 1 goto fail
if not exist "node_modules\electron\dist\electron.exe" (
  echo The Windows Electron binary was not installed. Review the download output above.
  goto fail
)
echo.
echo Electron is ready. Open Open-UI-Windows.wsf on Desktop 2.
pause
exit /b 0
:fail
echo.
echo Electron setup failed. Copy the first error above to diagnose the download.
pause
exit /b 1
