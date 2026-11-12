@echo off
cd /d "%~dp0desktop"
if not exist node_modules (
  call npm ci || goto fail
)
call npm start
exit /b %errorlevel%
:fail
pause
exit /b 1
