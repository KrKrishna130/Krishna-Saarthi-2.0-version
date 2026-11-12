"""Loopback web edition. Each browser tab owns its profile and session."""
import io
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pypdf import PdfReader
from starlette.concurrency import run_in_threadpool

import engine

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def local_api(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.headers.get("x-krishna-saarthi-client") != "web":
        return JSONResponse({"detail": "Use the local application."}, status_code=403)
    return await call_next(request)


@app.get("/api/config")
def config():
    return dict(provider=engine.get("PROVIDER", "ollama"), limit=engine.PROJECT_LIMIT,
                audio_window_seconds=max(10, min(120, int(engine.get("AUDIO_WINDOW_SECONDS", "60")))))


@app.post("/api/warmup")
async def warmup():
    try:
        await run_in_threadpool(engine.warm_speech)
        return {"ready": True}
    except Exception as exc:
        raise HTTPException(503, "Speech model could not load. Check the model download connection.") from exc


async def payload(request, limit):
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > limit:
            raise HTTPException(413, "File exceeds the upload limit.")
        data.extend(chunk)
    return bytes(data)


@app.post("/api/profile")
async def profile(request: Request):
    data = await payload(request, 10 * 1024**2)
    def extract():
        result = ""
        for page in PdfReader(io.BytesIO(data)).pages:
            result += (page.extract_text() or "") + "\n"
            if len(result) >= engine.RESUME_LIMIT:
                break
        return result[:engine.RESUME_LIMIT].strip()
    try:
        text = await run_in_threadpool(extract)
    except Exception as exc:
        raise HTTPException(400, "Could not read PDF.") from exc
    if not text:
        raise HTTPException(400, "Choose a PDF containing selectable text.")
    return {"text": text}


@app.post("/api/screen")
async def screen(request: Request):
    data = await payload(request, 12 * 1024**2)
    try:
        return {"text": await run_in_threadpool(engine.extract_question, data)}
    except Exception as exc:
        raise HTTPException(502, engine.FALLBACK) from exc


@app.post("/api/audio")
async def audio(request: Request):
    from faster_whisper.audio import decode_audio
    data = await payload(request, 12 * 1024**2)
    def recognise():
        samples = decode_audio(io.BytesIO(data), sampling_rate=16000)
        return engine.transcribe(samples)
    try:
        return {"text": await run_in_threadpool(recognise)}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, "Transcription failed. Check the audio source and Whisper model download.") from exc


class Question(BaseModel):
    question: str
    resume: str = ""
    project: str = ""


@app.post("/api/answer")
def answer(body: Question):
    if not body.question.strip() or len(body.project) > engine.PROJECT_LIMIT or len(body.resume) > engine.RESUME_LIMIT:
        raise HTTPException(400, "Check the question and candidate profile length.")
    def stream():
        try:
            for part in engine.stream_model(engine.answer_messages(body.question, body.resume, body.project)):
                yield json.dumps({"delta": part}) + "\n"
            yield '{"done":true}\n'
        except Exception:
            yield json.dumps({"error": engine.FALLBACK}) + "\n"
    return StreamingResponse(stream(), media_type="application/x-ndjson")


app.mount("/", StaticFiles(directory=Path(__file__).parent / "frontend/dist", html=True), name="ui")
