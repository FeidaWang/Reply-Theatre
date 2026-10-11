"""Token-scoped loopback viewer. No filesystem browsing or history RPC in HTTP."""
from contextlib import contextmanager
import http.server
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from .dataset import atomic_json, validate_data
from .history import HistoryError
from . import VERSION

PLUGIN_ROOT = Path(__file__).resolve().parents[2]
WEB_ROOT = PLUGIN_ROOT / "web"


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def export_html(data):
    validate_data(data)
    embedded = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    template = (WEB_ROOT / "index.html").read_text(encoding="utf-8")
    scripts = ('<script type="application/json" id="dataset">' + embedded + '</script>\n<script>'
               + (WEB_ROOT / "icons.js").read_text(encoding="utf-8") + '</script>\n<script>'
               + (WEB_ROOT / "app.js").read_text(encoding="utf-8") + '</script>')
    return (template.replace('<link rel="stylesheet" href="style.css">',
                             "<style>" + (WEB_ROOT / "style.css").read_text(encoding="utf-8") + "</style>")
            .replace('<script src="app.js" defer></script>', '')
            .replace('<script src="icons.js" defer></script>', '')
            .replace('</body>', scripts + '\n</body>'))


def make_server(data_path, token=None, idle_seconds=43200):
    data_path = Path(data_path).resolve()
    token = token or secrets.token_urlsafe(24)
    initial = validate_data(read_json(data_path))
    thread_id = initial["threadId"]

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *unused):
            pass  # Token and code content must not enter access logs.

        def allowed(self):
            host = self.headers.get("Host", "")
            return host == f"127.0.0.1:{self.server.server_port}"

        def respond(self, code, body=b"", content_type="text/plain; charset=utf-8"):
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'")
            self.end_headers()
            self.wfile.write(body)

        def route(self):
            path = urlsplit(self.path).path
            prefix = f"/{token}/"
            if not self.allowed() or not path.startswith(prefix):
                return None
            return path[len(prefix):]

        def do_GET(self):
            route = self.route()
            if route is None:
                self.respond(403, b"Forbidden")
                return
            self.server.last_access = time.monotonic()
            if route == "health":
                body = json.dumps({"service": "replay-theater", "threadId": thread_id, "version": self.server.replay_version}).encode()
                self.respond(200, body, "application/json")
            elif route == "data":
                try:
                    data = validate_data(read_json(data_path))
                    if data["threadId"] != thread_id:
                        raise HistoryError("Snapshot belongs to another chat.")
                    self.respond(200, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")
                except (OSError, ValueError, HistoryError):
                    self.respond(500, b"Replay snapshot is unavailable or invalid.")
            elif route == "position":
                try:
                    position = read_json(data_path.with_suffix(".position.json"))
                except (OSError, ValueError):
                    position = {}
                self.respond(200, json.dumps(position).encode(), "application/json")
            elif route in {"", "index.html", "app.js", "icons.js", "style.css"}:
                filename = route or "index.html"
                content_type = {"index.html": "text/html; charset=utf-8", "app.js": "text/javascript; charset=utf-8", "icons.js": "text/javascript; charset=utf-8", "style.css": "text/css; charset=utf-8"}[filename]
                self.respond(200, (WEB_ROOT / filename).read_bytes(), content_type)
            else:
                self.respond(404, b"Not found")

        def do_POST(self):
            expected_origin = f"http://127.0.0.1:{self.server.server_port}"
            route = self.route()
            if route not in {"position", "stop"} or self.headers.get("Origin") != expected_origin:
                self.respond(403, b"Forbidden")
                return
            if route == "position":
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    if not 0 < length <= 4096:
                        raise ValueError("Invalid length")
                    position = json.loads(self.rfile.read(length))
                    if not isinstance(position, dict) or set(position) != {"turnId", "stepId", "file", "view", "attempts", "savedAt"}:
                        raise ValueError("Invalid fields")
                    if not all(isinstance(position[k], str) and len(position[k]) <= 2048 for k in ("turnId", "stepId", "file")):
                        raise ValueError("Invalid text")
                    if position["view"] not in {"split", "unified"} or not isinstance(position["attempts"], bool):
                        raise ValueError("Invalid view")
                    if type(position["savedAt"]) is not int or position["savedAt"] < 0:
                        raise ValueError("Invalid saved timestamp")
                    atomic_json(data_path.with_suffix(".position.json"), position)
                except (OSError, ValueError, TypeError):
                    self.respond(400, b"Invalid replay position")
                    return
                self.server.last_access = time.monotonic()
                self.respond(200, b"Saved")
                return
            self.respond(200, b"Stopped")
            threading.Thread(target=self.server.shutdown, daemon=True).start()

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = True
    server.last_access = time.monotonic()
    server.replay_token = token
    server.replay_thread_id = thread_id
    server.replay_version = VERSION

    def expire():
        while not server.expiry_stop.wait(min(30, idle_seconds)):
            if time.monotonic() - server.last_access >= idle_seconds:
                server.shutdown()
                return

    server.expiry_stop = threading.Event()
    threading.Thread(target=expire, daemon=True).start()
    return server


def serve(data_path, state_path, idle_seconds=43200):
    server = make_server(data_path, idle_seconds=idle_seconds)
    url = f"http://127.0.0.1:{server.server_port}/{server.replay_token}/"
    state = {"service": "replay-theater", "pid": os.getpid(), "url": url,
             "version": VERSION,
             "threadId": server.replay_thread_id, "dataPath": str(Path(data_path).resolve())}
    atomic_json(state_path, state)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        server.expiry_stop.set()
        server.server_close()
        try:
            if read_json(state_path).get("url") == url:
                Path(state_path).unlink()
        except (OSError, ValueError):
            pass


def probe(state, thread_id, require_current=False):
    try:
        parsed = urlsplit(state["url"])
        if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or not parsed.port:
            return False
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(state["url"] + "health", timeout=1) as response:
            data = json.load(response)
        return (data.get("service") == "replay-theater" and data.get("threadId") == thread_id
                and (not require_current or data.get("version") == VERSION))
    except (KeyError, OSError, ValueError):
        return False


@contextmanager
def startup_lock(path):
    deadline = time.monotonic() + 15
    while True:
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(fd)
            break
        except FileExistsError:
            # A killed launcher leaves a harmless lock; recover after a minute.
            try:
                if time.time() - Path(path).stat().st_mtime > 60:
                    Path(path).unlink()
                    continue
            except FileNotFoundError:
                continue
            if time.monotonic() >= deadline:
                raise HistoryError("Another replay viewer is starting. Retry shortly.")
            time.sleep(0.1)
    try:
        yield
    finally:
        Path(path).unlink(missing_ok=True)


def ensure_server(data_path):
    data_path = Path(data_path).resolve()
    thread_id = validate_data(read_json(data_path))["threadId"]
    state_path = data_path.with_suffix(".server.json")
    with startup_lock(state_path.with_suffix(".lock")):
        try:
            state = read_json(state_path)
            if state.get("dataPath") == str(data_path) and probe(state, thread_id, require_current=True):
                return state
            if state.get("dataPath") == str(data_path) and probe(state, thread_id):
                # Update the viewer runtime without discarding history or position.
                stop_server(data_path)
        except (OSError, ValueError):
            pass
        state_path.unlink(missing_ok=True)
        process = subprocess.Popen(
            [sys.executable, str(PLUGIN_ROOT / "scripts/replay.py"), "serve", "--data", str(data_path), "--state", str(state_path)],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                state = read_json(state_path)
                if probe(state, thread_id, require_current=True):
                    # Reap the detached child while this launcher remains alive.
                    threading.Thread(target=process.wait, daemon=True).start()
                    return state
            except (OSError, ValueError):
                pass
            if process.poll() is not None:
                raise HistoryError("Local replay server failed to start.")
            time.sleep(0.1)
        process.terminate()
        process.wait(timeout=3)
        raise HistoryError("Local replay server did not become ready.")


def stop_server(data_path):
    state_path = Path(data_path).with_suffix(".server.json")
    try:
        state = read_json(state_path)
    except (OSError, ValueError):
        return False
    if not probe(state, state.get("threadId")):
        return False
    parsed = urlsplit(state["url"])
    request = urllib.request.Request(state["url"] + "stop", data=b"", method="POST",
                                    headers={"Origin": f"http://{parsed.netloc}"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=3):
        pass
    deadline = time.monotonic() + 4
    while time.monotonic() < deadline:
        if not probe(state, state.get("threadId")):
            return True
        time.sleep(0.05)
    raise HistoryError("The replay viewer did not finish stopping; saved history was preserved.")
