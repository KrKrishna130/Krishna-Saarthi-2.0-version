# Electron launcher with the Docker backend

This folder contains the complete desktop code. main.cjs creates the window, registers global shortcuts, positions it within the current display's work area and adds App menu recovery controls. preload.cjs exposes the launcher status to React. package-lock.json fixes dependency versions.

## Floating meeting window
The launcher defaults to a 520 × 760 window above the meeting. DESKTOP_ALWAYS_ON_TOP and DESKTOP_CONTENT_PROTECTION default to true. The App menu can toggle Keep above meeting or display Screen-sharing status. The React UI includes a visible platform capture limitation and a Focus answer control. This is a separate desktop window over your browser. It cannot guarantee invisibility to every capture method. macOS ScreenCaptureKit may include protected windows.

From the project root, Start-All-Mac.command (run with bash) or Start-All-Windows.cmd starts Docker and Electron together. These scripts wait for the container's health check before loading the UI. Stop Electron using App > Quit. Run docker compose down from the root when you want to stop the backend as well.

## Requirements
This Windows edition targets Windows 11 x64, Node 26.13.0, npm 10.9.4 and Docker Desktop using Linux containers. Electron 45.3.0 is pinned. The installer requires Node 22.12 or newer. On macOS this edition requires macOS 13+, and the separate Monterey/Node 18 build should be used on your older iMac.

## Windows startup
Run Start-All-Windows.cmd from the project root. It installs locked desktop dependencies, validates the Docker engine, builds and waits for the container, checks the configured Ollama model from inside Docker, then opens Electron. Start-Desktop-Windows.cmd can open only the UI after dependencies and backend are ready. See WINDOWS_SETUP.md for the exact commands.

## Start on macOS

From the extracted Krishna Saarthi project folder:
```bash
node --version
npm --version
test -f .env || cp .env.example .env
docker compose up --build -d
cd desktop
npm ci
npm start
```
Node and Electron run on your laptop. The Docker container serves React and FastAPI on port 8787. The root .env is loaded automatically. Existing .env files work with the default shortcut values. Keep Ollama open with gemma3:4b available. You can also use bash Start-Desktop-Mac.command from the project root after starting Docker.

## Start on Windows

From PowerShell in the extracted project:
```powershell
node --version
npm --version
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build -d
cd desktop
npm ci
npm start
```
Start-Desktop-Windows.cmd runs the desktop installation and launcher after Docker is ready.

## Configure the keyboard

Add these entries to the root .env, save, close Electron fully and run npm start again:
```dotenv
DESKTOP_URL=http://localhost:8787
SHORTCUT_LEFT=Control+Left
SHORTCUT_RIGHT=Control+Right
SHORTCUT_TOGGLE=Control+H
```
DESKTOP_URL must point to the matching WEB_PORT if you change it. These keys use Control on both OSes, including the Mac Control key. Movement docks to an edge of the current display. It does not transfer to the next monitor.

For Mac Mission Control conflicts, change or disable the Move left/right a space shortcuts in System Settings, Keyboard, Keyboard Shortcuts, Mission Control. Alternatively use these bindings:
```dotenv
SHORTCUT_LEFT=Control+Alt+Left
SHORTCUT_RIGHT=Control+Alt+Right
SHORTCUT_TOGGLE=Control+Alt+H
```
Alt means Option on a Mac. Each restart prints whether registration succeeded. App > Shortcut status shows the same result. OS shortcuts can still intercept combinations that appear registered, so test with the meeting window focused. App > Show assistant restores a hidden window if the toggle combination fails. Selecting the Electron icon in the Mac Dock also restores it.

## Independent audio and screen grants

The preload exposes prepareAudio/releaseAudio and prepareScreen/releaseScreen. Each requires explicit UI consent and a trusted local origin. The audio route chooses a technical desktop source for Windows loopback internally, so the user does not need to choose a screen-analysis source to start audio. Its display track is never used for image extraction. The separate screen grant requires selecting a source in the screen permission panel. Display requests require a pending authorized capture purpose. Physical-camera permission remains excluded.

Audio and screen streams are owned and stopped independently in browser.js. Audio capture continues during screen selection, analysis and response generation. The session has no 90-minute timeout, while PCM memory is bounded by AUDIO_WINDOW_SECONDS. Windows-owned indicators, dialogs and sounds can still appear.

## Checks and logs

Test Control+Right, Control+Left and Control+H with both the assistant and a different application focused. Verify docking on each monitor, including a display to the left of the primary. Restore from App > Show assistant if needed. Test typed questions before audio and image capture.

Docker logs:
```bash
docker compose logs -f
```
Run that command from the project root. npm start prints launcher registration and capture errors. App > Developer console shows frontend errors. If Docker is unavailable, the launcher shows a load error. Start Docker, then use App > Reload.

The earlier Monterey dependency installation was validated separately. This Windows dependency lockfile was regenerated, JavaScript syntax, the Vite build and docking/toggle logic with mocked Electron APIs. Physical Mac/Windows shortcuts, audio, screen permissions and Electron rendering have not been verified here.
