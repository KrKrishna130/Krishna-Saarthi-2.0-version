@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv || goto fail
)
if not exist ".env" copy .env.example .env >nul
".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto fail
".venv\Scripts\python.exe" app.py || goto fail
exit /b 0
:fail
echo Setup or launch failed. See the message above.
pause
exit /b 1
