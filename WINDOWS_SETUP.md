# Run Krishna Saarthi on Krishna's Windows laptop

## Separate audio and screen permissions

The previous combined Prepare interview control has been replaced. Audio permission does not depend on a selected screen-analysis source. Use Allow audio & start once for ongoing audio. Use Allow screen separately when needed. A failure in one does not release the other. Full steps are in README.md.

## Electron package installed but electron.exe missing
Electron 45 downloads its executable separately. The desktop package now runs its binary installer during npm ci. If you installed an earlier copy, replace desktop/package.json and desktop/package-lock.json with this version and run Repair-Desktop-Windows.cmd from the root. Wait for the download and executable check to finish. It preserves your .env and backend data.

For an immediate repair using an already installed desktop folder, run:
```cmd
cd desktop
node node_modules\electron\install.js
dir node_modules\electron\dist\electron.exe
```
Then reopen Open-UI-Windows.wsf. If download fails, keep the error output. A successful npm package audit alone does not confirm that the executable exists. Internet access to Electron's release download is needed. The actual Windows executable and UI still require a local launch check.


The supplied laptop has Windows 11 Home Single Language x64 build 26300, about 24 GB RAM, Node 26.13.0, npm 10.9.4 and Docker CLI 29.9.3. Its hypervisor is running. Docker engine availability, WSL readiness, Ollama installation and GPU acceleration still require local checks. The printed Docker version confirms the client is installed.

This edition pins Electron 45.3.0 for Windows and your newer Node installation. Keep the previous Monterey edition for the older Mac. It is available separately in the conversation.

## UI without a taskbar button or launch console

Use this workflow for Desktop 1 and Desktop 2.

1. On Desktop 1 run Prepare-Windows.cmd from the project folder. It installs desktop dependencies, starts Docker and checks the model. Leave any backend log terminals on Desktop 1.
2. Quit any older Electron instance using App > Quit before switching desktops.
3. Switch to Desktop 2 with Windows+Control+Right. Open the project folder in File Explorer and double-click Open-UI-Windows.wsf. This launches the graphical Electron binary directly. It does not create a Command Prompt or npm console.
4. The assistant window opens with its Windows taskbar button hidden by default. Control+H hides/restores the window. If a shortcut fails, double-click Open-UI-Windows.wsf again to restore the existing instance, or use App > Show assistant while its menu is available.
5. App > Show taskbar button can restore the button for this session. Set DESKTOP_SKIP_TASKBAR=false in .env and restart Electron for a persistent visible button.

A Command Prompt you already opened remains visible until you move, minimize or close it. Open-UI-Windows.wsf creates no new console, and the taskbar setting applies to the assistant window. A separately pinned Electron icon may still be on the taskbar, so right-click that pinned shortcut and choose Unpin from taskbar if present. Other applications keep their own taskbar buttons.

If Windows policy blocks .wsf scripts, create a normal desktop shortcut manually. Its Target must contain the quoted path to desktop\node_modules\electron\dist\electron.exe followed by the quoted desktop folder path. That opens the graphical program directly. Existing .cmd launchers remain available for debugging.

Hiding a taskbar button does not guarantee invisibility during screen sharing and does not remove the process from Task Manager. Verify the attendee view independently.

## 1. Open Docker Desktop

Wait until its engine is running. Use Linux containers and the WSL 2 backend on Windows Home. In ordinary Command Prompt, run:
```cmd
docker version
docker compose version
docker info --format "{{.OSType}}"
```
docker version must show Client and Server. The last command must print linux. If Docker reports WSL problems, check:
```cmd
wsl --version
wsl --status
```
If WSL needs updating, run wsl --update and restart Docker Desktop. For an uninstalled WSL feature, use the Docker Desktop instructions and restart Windows when required. The project launcher leaves Windows feature configuration to you.

## 2. Install or open Ollama for Windows

Run:
```cmd
ollama --version
ollama list
```
If gemma3:4b is missing:
```cmd
ollama pull gemma3:4b
```
Keep the Ollama Windows application open. Its local API normally uses port 11434. CPU inference can be slow. Your supplied output does not identify a supported discrete GPU, so there is no fixed latency guarantee.

## 3. Extract the archive

For a folder in Downloads, use:
```cmd
cd /d "%USERPROFILE%\Downloads\Krishna Saarthi"
dir
```
The folder must contain compose.yaml and Start-All-Windows.cmd. Use the actual extraction path if it differs. Spaces in your user name and project folder are supported.

If another project copy is already using port 8787, run docker compose down from that old copy's folder before starting this one.

## 4. Start everything

From the project root run:
```cmd
Start-All-Windows.cmd
```
The launcher creates .env from .env.example when absent, installs locked desktop packages using npm ci, confirms the running Docker engine is Linux, builds and waits for the backend/UI container, verifies Ollama's configured model from inside that container and opens the Electron window. It waits up to 180 seconds for container health after the build. The initial image build and dependency downloads can take longer. If a check fails, read the printed error and correct it before rerunning.

When Ollama is unreachable from Docker, ensure the Windows app is running and check Docker Desktop host connectivity. DOCKER_OLLAMA_BASE_URL in .env defaults to http://host.docker.internal:11434/v1. Do not point it at container localhost.

The React UI is also available at http://localhost:8787. Each browser tab and Electron window keeps its own profile in memory. Upload the résumé in the window where you want answers.

## 5. Use the floating UI

Open Candidate profile, choose a text-based PDF and paste your project description. The default project limit is 10,000 characters. Type one short question and click Response before trying meeting capture.

Join the meeting in Chrome or Teams. Electron's Keep above meeting option floats the assistant above the meeting window. Control+Left / Right docks it. Control+H hides/restores it. App > Show assistant can recover a hidden window. App > Shortcut status reports OS registration. The keys can be changed in .env and take effect after restarting Electron.

Under Audio permission choose Meeting playback + my microphone, tick audio consent and click Allow audio & start. This does not require a screen-analysis source. Wait for Audio active. Response uses Recent audio, and listening continues after every answer. Under Screen permission, when needed click Refresh screen sources, select the intended source, tick screen consent and click Allow screen. Then use Analyse my screen and Response. Audio and screen have independent stop controls.

Capture exclusion is requested for the Electron window. It does not prove what a remote attendee sees. Share a specific meeting tab or window and inspect the remote view from a second device. Entire-screen capture and auxiliary dialogs can reveal content. This project does not guarantee universal invisibility.

## 6. Logs, stop and restart

From a second Command Prompt in the project root:
```cmd
docker compose logs -f
```
The launcher Terminal shows Electron output. App > Developer console shows React errors.

Quit Electron from its App menu. Docker keeps running until:
```cmd
docker compose down
```
Rerun Start-All-Windows.cmd to start again.

## Model configuration

The archive includes .env.example. On first startup the launcher creates .env with local Gemma defaults. To switch to GPT, edit .env:
```dotenv
PROVIDER=openai
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=your-key
```
Use a vision-capable model available to your API account. Rerun the launcher after changing settings. It recreates containers when the environment changes.

## Validation limits

Dependency metadata, the React build, syntax checks and simulated desktop behavior were checked. Docker Desktop, the Electron binary and live meeting audio on your physical Windows laptop have not been run in the delivery environment.
