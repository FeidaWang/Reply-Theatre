"""A deliberately small read-only app-server client; no model or turn calls."""
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time
from . import VERSION


class HistoryError(RuntimeError):
    pass


class RpcError(HistoryError):
    def __init__(self, method, error):
        self.code = error.get("code")
        super().__init__(f"{method}: {error.get('message', 'RPC failed')} ({self.code})")


def resolve_engine(explicit=None):
    if explicit or os.environ.get("CODEX_REPLAY_ENGINE"):
        candidate = explicit or os.environ["CODEX_REPLAY_ENGINE"]
        resolved = shutil.which(candidate)
        if not resolved:
            raise HistoryError(f"Codex engine is not executable: {candidate}")
        return resolved
    # Read/execute the bundled engine, never alter an app bundle.
    bundled = Path("/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex")
    if bundled.is_file() and os.access(bundled, os.X_OK):
        return str(bundled)
    resolved = shutil.which("codex")
    if not resolved:
        raise HistoryError("Codex engine not found. Supply --engine /absolute/path/to/codex.")
    return resolved


class HistoryClient:
    ALLOWED = {"initialize", "thread/read", "thread/turns/list"}

    def __init__(self, engine=None, timeout=20):
        self.engine = resolve_engine(engine)
        self.timeout = timeout
        self.counter = 0
        self.calls = []
        self.inbox = queue.Queue()
        self.process = None

    def __enter__(self):
        self.process = subprocess.Popen(
            [self.engine, "--no-daemon", "-c", "analytics.enabled=false", "app-server", "--stdio"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="utf-8", bufsize=1,
        )
        threading.Thread(target=self._read, daemon=True).start()
        try:
            result = self.request("initialize", {
                "clientInfo": {"name": "replay_theater", "title": "Replay Theater (read only)", "version": VERSION},
                "capabilities": {"experimentalApi": True},
            })
            self.user_agent = result.get("userAgent", "unknown")
            self._send({"method": "initialized", "params": {}})
            return self
        except BaseException:
            self.close()
            raise

    def _read(self):
        try:
            for line in self.process.stdout:
                try:
                    self.inbox.put(json.loads(line))
                except json.JSONDecodeError:
                    continue
        finally:
            self.inbox.put(None)

    def _send(self, message):
        try:
            self.process.stdin.write(json.dumps(message) + "\n")
            self.process.stdin.flush()
        except (BrokenPipeError, OSError) as error:
            raise HistoryError("Codex app-server closed its input.") from error

    def request(self, method, params):
        if method not in self.ALLOWED:
            raise HistoryError(f"Read-only client refused {method}")
        self.counter += 1
        request_id = self.counter
        self._send({"id": request_id, "method": method, "params": params})
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            try:
                message = self.inbox.get(timeout=max(0.01, deadline - time.monotonic()))
            except queue.Empty:
                break
            if message is None:
                raise HistoryError("Codex app-server exited before replying.")
            if "method" in message and "id" in message:
                self._send({"id": message["id"], "error": {"code": -32601, "message": "Read-only replay client"}})
                continue
            if message.get("id") == request_id:
                self.calls.append(method)
                if "error" in message:
                    raise RpcError(method, message["error"])
                return message.get("result", {})
        raise HistoryError(f"Timed out reading {method} after {self.timeout}s.")

    def close(self):
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
            for stream in (self.process.stdin, self.process.stdout):
                stream.close()

    def __exit__(self, *unused):
        self.close()
