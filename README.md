# Krishna Saarthi • Windows edition

## Audio permission • once for the interview

Start Docker Desktop and Ollama. Run Prepare-Windows.cmd on Desktop 1. It prepares dependencies and backend services. On Desktop 2 open Open-UI-Windows.wsf after quitting any older Electron instance.

Upload the résumé and project text under Candidate profile. In Interview, choose an audio mode under Audio permission, tick the audio consent checkbox and click Allow audio & start. No screen-analysis source or screen consent is needed to start audio. Wait until Audio active and check the playback/microphone indicators. The first preparation loads/downloads the speech model.

Audio remains active until Stop audio, Stop all capture, source loss or closing/reloading the app. There is no 90-minute expiry. The latest AUDIO_WINDOW_SECONDS of audio are retained in memory while the whole session can continue for 1.5 hours and beyond. Response uses Recent audio by default and does not stop listening.

If microphone access is denied, enable Windows Settings > Privacy & security > Microphone > Microphone access and Let desktop apps access your microphone. Setup errors now identify the audio stage. Complete these steps before sharing.

Windows system playback uses Electron's desktop-media/loopback route. That technical route retains a required display track, which can cause an OS capture indicator. The audio workflow never reads or submits images from that track. Image analysis requires the separate screen permission below. Microphone / routed input only does not use a desktop capture route.

## Screen permission • only when needed

Audio can already be active, or it can remain off.

1. Under Screen permission click Refresh screen sources.
2. Select the actual coding/meeting window or display.
3. Tick the separate screen consent checkbox.
4. Click Allow screen.
5. Click Analyse my screen, review the extracted question, then click Response.

The screen source is retained for reuse until Stop screen, Stop all capture, source loss or app close/reload. Stopping or failing screen preparation does not stop audio. Stopping audio does not stop an authorized screen source. Analysis does not send additional audio, and screen-derived questions switch Response uses to Analysed screen question. Select Recent audio to resume spoken questions.

Permission handlers distinguish screen-video capture from physical-camera access. No screen selection is required by the audio button, fixing the previous source-selection error.

## Respond from ongoing audio

Leave Response uses set to Recent audio. Click Response when the interviewer finishes a question. The app snapshots recent audio, transcribes playback and microphone independently, and sends labelled transcripts to the selected model. Listening continues while transcription and generation run.

A successful answer advances the audio cursor so the next question uses newer audio. If an answer fails, the cursor is retained for retry while the rolling buffer still contains it. AUDIO_WINDOW_SECONDS controls the recent window, default 60 and bounded to 10–120 seconds. Old samples are overwritten, so long sessions use bounded memory. This is continuous capture with on-demand transcription, rather than an archive of the whole interview.

Source labels do not prove speaker identity. Meeting playback can include several participants or unrelated application audio. Microphone audio may contain room sound. If the model cannot identify a clear question, it is instructed to ask for clarification. For manual correction edit the question field, which selects Typed / edited question. Select Recent audio again for the next spoken question.

## Capture interruptions

If a source closes, Windows revokes permission, a device disconnects or the machine sleeps, the affected capture can stop. Reauthorize only that capture when ready. The other capture remains active when its own source is available. Hiding Electron with Control+H leaves both active streams running. Closing/reloading Electron ends both.

## Permission sounds and visibility

The app creates no capture-permission message boxes, plays no notification tone and never routes recorded microphone/playback samples to its speakers. Its capture worklet outputs silence and its screen video is muted. Windows owns OS permission prompts, system audio indicators, device notifications and their sounds. This project cannot guarantee that Windows produces no sound or that those dialogs are excluded from a shared display. Complete setup before presenting.

The floating window requests capture exclusion and hides its Windows taskbar button by default. Those settings are not evidence of what a remote attendee sees. Share a selected meeting/browser tab or window and verify from a second device. Entire-display sharing may expose the assistant or OS/application dialogs. macOS ScreenCaptureKit may capture protected windows. This Windows edition requires macOS 13+ if used on a Mac; the earlier Monterey package is separate.

## Configuration and model

Prepare-Windows.cmd creates .env from .env.example when absent. Existing .env files can be copied into a replacement project. The default provider is Ollama with gemma3:4b. Docker reaches the host through DOCKER_OLLAMA_BASE_URL=http://host.docker.internal:11434/v1.

To switch to a vision-capable GPT model available in your account, set PROVIDER=openai, OPENAI_MODEL and OPENAI_API_KEY in .env, then recreate the container and restart Electron. The backend sends your question, extracted résumé and project description to the configured provider on Response. Screen analysis sends one selected image. Transcription stays in the local Docker container.

PROJECT_MAX_CHARS defaults to 10000. RESUME_MAX_CHARS limits extracted PDF text. MAX_ANSWER_TOKENS and MODEL_TIMEOUT_SECONDS control model output and inactivity timeout. FALLBACK_MESSAGE is shown for model failures.

## Window controls and launch files

Control+Left / Right docks the window. Control+H hides/restores it. Change SHORTCUT_LEFT, SHORTCUT_RIGHT and SHORTCUT_TOGGLE in .env if Windows intercepts a combination, then restart Electron. App > Show assistant and reopening Open-UI-Windows.wsf can recover the hidden UI.

DESKTOP_ALWAYS_ON_TOP defaults to true. DESKTOP_CONTENT_PROTECTION requests capture exclusion. DESKTOP_SKIP_TASKBAR hides the app's taskbar button. Focus answer gives the Answer panel more space while the capture status and Stop all capture remain accessible.

Prepare-Windows.cmd installs dependencies, starts Docker and checks the model, without opening Electron. Open-UI-Windows.wsf launches the graphical executable without a console. Repair-Desktop-Windows.cmd explicitly installs the Electron binary if missing. Start-All-Windows.cmd remains available for combined console startup and diagnostics.

## Development and logs

frontend/main.jsx contains the UI. frontend/browser.js owns the prepared capture session. frontend/audio-buffer.js maintains bounded PCM samples and creates standalone WAV requests. frontend/public/audio-worklet.js captures audio without replay. desktop/main.cjs enforces preparation, source selection and session-scoped permission grants. server.py and engine.py implement transcription, screen extraction and streamed model answers. The legacy Python app.py launcher has its own capture workflow.

Rebuild React after frontend changes with npm ci and npm run build inside frontend. The Docker build does this automatically. No host Python is needed for Docker/Electron.

Run docker compose logs -f from this project folder for backend logs. App > Developer console shows renderer errors. Quit Electron from its App menu. Run docker compose down to stop the backend.

## Validation

The Vite production build and syntax checks passed. Simulated checks covered session grants/release, dual audio, bounded WAV buffering, repeated responses without new media requests, screen reuse and stop behavior. Actual Windows loopback, microphone devices, permissions, notification sounds and remote attendee capture require testing on the target laptop.
