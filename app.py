"""Native host for the bundled Krishna Saarthi React application."""
import ctypes
import json
import sys
import threading
from pathlib import Path

from PySide6.QtCore import QByteArray, QBuffer, QIODevice, QObject, QTimer, QUrl, Signal, Slot
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QApplication, QFileDialog, QMainWindow
from pypdf import PdfReader

import engine as e


class Controller(QObject):
    changed = Signal(str)
    event = Signal(str, object)

    def __init__(self, window):
        super().__init__(window)
        self.window = window
        self.stop = threading.Event()
        self.devices = []
        self.resume = ""
        self.project = ""
        self.s = dict(phase="idle", status="Ready", question="", answer="", pdf="", devices=[],
                      displays=[], device=-1, display=0, limit=e.PROJECT_LIMIT, profileError="",
                      provider=e.get("PROVIDER", "ollama"), notice="")
        self.event.connect(self.receive)
        self.sources()

    def update(self, **values):
        self.s.update(values)
        self.changed.emit(self.snapshot())

    @Slot(result=str)
    def snapshot(self):
        return json.dumps(self.s)

    @Slot()
    def sources(self):
        if self.s["phase"] != "idle":
            return
        self.devices = []
        idx = -1
        note = "Ready"
        try:
            import soundcard as sc
            self.devices = sc.all_microphones(include_loopback=sys.platform == "win32")
            preferred = e.get("AUDIO_DEVICE", "").strip()
            if not preferred and sys.platform == "win32":
                speaker = sc.default_speaker()
                idx = next((i for i,d in enumerate(self.devices) if getattr(d,"isloopback",False) and d.id == speaker.id), -1)
            else:
                preferred = preferred or "BlackHole"
                idx = next((i for i,d in enumerate(self.devices) if preferred.lower() in d.name.lower()), -1)
        except Exception as exc:
            note = f"Audio input unavailable • {exc}"
        self.screens = QApplication.screens()
        self.update(devices=[d.name + (" (loopback)" if getattr(d,"isloopback",False) else "") for d in self.devices],
                    device=idx, displays=[s.name() for s in self.screens], display=0, status=note)

    @Slot(str)
    def setProject(self, text):
        self.project = text

    @Slot()
    def pdf(self):
        path, _ = QFileDialog.getOpenFileName(self.window, "Candidate résumé", "", "PDF (*.pdf)")
        if not path:
            return
        try:
            pages = []
            length = 0
            for page in PdfReader(path).pages:
                part = page.extract_text() or ""
                pages.append(part)
                length += len(part) + 1
                if length >= e.RESUME_LIMIT:
                    break
            resume = "\n".join(pages).strip()[:e.RESUME_LIMIT]
            if not resume:
                raise ValueError("Use a PDF with selectable text.")
            self.resume = resume
            self.update(pdf=f"{Path(path).name} • {len(resume):,} characters", profileError="")
        except Exception as exc:
            self.update(profileError=f"PDF load failed • {exc}")

    @Slot()
    def removePdf(self):
        self.resume = ""
        self.update(pdf="", profileError="")

    def worker(self, name, fn, model=False):
        def run():
            try:
                self.event.emit(name, fn())
            except Exception as exc:
                self.event.emit("error", e.FALLBACK if model else str(exc))
        threading.Thread(target=run, daemon=True).start()

    @Slot(int)
    def listen(self, index):
        if self.s["phase"] != "idle":
            return
        if not 0 <= index < len(self.devices):
            self.update(status="Select the meeting playback input first.")
            return
        self.stop.clear()
        dev = self.devices[index]
        self.update(phase="opening", status="Opening input…", question="", answer="", device=index)
        self.worker("samples", lambda: e.record(self.stop, lambda: self.event.emit("ready", None), dev))

    @Slot(str)
    def respond(self, question):
        if len(self.project) > e.PROJECT_LIMIT:
            self.update(status="Shorten the project description in Candidate profile.")
            return
        if self.s["phase"] == "listening":
            self.update(phase="speech", status="Transcribing meeting audio…")
            self.stop.set()
        elif self.s["phase"] == "idle":
            if not question.strip():
                self.update(status="Type a question, start listening, or analyse a display.")
                return
            self.answer_question(question)

    def answer_question(self, question):
        resume, project = self.resume, self.project
        self.update(phase="answer", status="Generating response…", question=question, answer="")
        self.worker("answer", lambda: e.respond(question, resume, project, lambda t:self.event.emit("partial",t)), True)

    @Slot(int)
    def capture(self, index):
        if self.s["phase"] != "idle" or not 0 <= index < len(self.screens):
            return
        self.update(phase="screen", status="Reading selected display…", display=index, question="", answer="")
        self.window.hide()
        def grab():
            try:
                pix = self.screens[index].grabWindow(0)
                data = QByteArray()
                buf = QBuffer(data)
                buf.open(QIODevice.WriteOnly)
                if pix.isNull() or not pix.save(buf, "JPEG", 85):
                    raise ValueError("Capture failed. Check screen recording permissions.")
                raw = bytes(data)
                self.worker("screen", lambda:e.extract_question(raw), True)
            except Exception as exc:
                self.receive("error", str(exc))
            finally:
                self.window.show()
        QTimer.singleShot(400, grab)

    @Slot(str, object)
    def receive(self, name, value):
        if name == "key":
            self.window.shortcut(value)
        elif name == "ready":
            self.update(phase="listening",status="Listening • click Response when the question ends")
        elif name == "samples":
            self.worker("speech", lambda:e.transcribe(value))
        elif name == "speech":
            self.answer_question(value)
        elif name == "screen":
            q = "" if value.strip() == "NO_QUESTION" else value.strip()
            self.update(phase="idle",question=q,status="Review the question, then click Response." if q else "No readable question found.")
        elif name == "partial":
            self.update(answer=value)
        elif name in ("answer","error"):
            self.update(phase="idle",answer=value,status="Response complete" if name == "answer" else value)


class Assistant(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Krishna Saarthi")
        self.resize(780, 800)
        self.hooks = None
        self.view = QWebEngineView()
        self.setCentralWidget(self.view)
        self.controller = Controller(self)
        self.channel = QWebChannel(self)
        self.channel.registerObject("assistant", self.controller)
        self.view.page().setWebChannel(self.channel)
        path = Path(__file__).resolve().parent / "frontend/dist/index.html"
        self.view.load(QUrl.fromLocalFile(str(path)))

    def shortcut(self, action):
        if action == "toggle":
            self.setVisible(not self.isVisible())
            if self.isVisible():
                self.raise_()
        else:
            area = self.screen().availableGeometry()
            self.move(area.left() if action == "left" else area.right()-self.frameGeometry().width()+1, area.top())

    def platform_setup(self):
        msg = "Full-display sharing can reveal this window. Verify from a second device."
        try:
            if sys.platform == "win32":
                fn = ctypes.windll.user32.SetWindowDisplayAffinity
                fn.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
                if fn(int(self.winId()), 0x11):
                    msg = "Windows capture exclusion requested. Verify the attendee view."
            elif sys.platform == "darwin":
                import AppKit  # Register the NSView and NSWindow Objective-C methods.
                import objc
                view = objc.objc_object(c_void_p=int(self.winId()))
                view.window().setSharingType_(0)
        except Exception:
            pass
        try:
            from pynput.keyboard import GlobalHotKeys
            def key(action):
                return lambda: self.controller.event.emit("key", action)
            self.hooks = GlobalHotKeys({"<ctrl>+h": key("toggle"), "<ctrl>+<left>": key("left"), "<ctrl>+<right>": key("right")})
            self.hooks.start()
        except Exception as exc:
            msg += f" Global shortcuts unavailable: {exc}"
        self.controller.update(notice=msg)

    def closeEvent(self, event):
        self.controller.stop.set()
        if self.hooks:
            self.hooks.stop()
        super().closeEvent(event)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = Assistant()
    window.show()
    window.platform_setup()
    sys.exit(app.exec())
