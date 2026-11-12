@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Open a new Command Prompt after installing Node.
  goto fail
)
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22 || (v[0]===22 && v[1]>=12) ? 0 : 1)"
if errorlevel 1 (
  echo This Windows edition requires Node 22.12 or newer. Your supplied Node 26 meets the requirement.
  goto fail
)
if not exist .env copy .env.example .env >nul
pushd desktop
call npm ci
if errorlevel 1 (
  popd
  goto fail
)
popd
node windows-start.cjs --backend-only
if errorlevel 1 goto fail
exit /b 0
:fail
echo.
echo Startup stopped. Resolve the message above, then run Prepare-Windows.cmd again.
pause
exit /b 1
