#!/usr/bin/env python3
"""Local stdio MCP for reviewing recorded edits in the host-bound Codex chat."""
import json
from pathlib import Path
import sys
from uuid import UUID

# Isolated mode excludes external Python import paths.
SCRIPT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_ROOT))

from replaylib import VERSION
from replaylib.dataset import collect, validate_data
from replaylib.history import HistoryClient, HistoryError
from replaylib.inspection import display_name, inspect_replay
from replaylib.service import WEB_ROOT, read_json, standalone_html

RESOURCE = "ui://replay-theater/replay.html"
RESOURCE_INFO = {"uri": RESOURCE, "name": "Replay Theater", "mimeType": "text/html;profile=mcp-app"}
PROTOCOLS = {"2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"}
MAX_REQUEST = 64 * 1024
MAX_PANEL = 512 * 1024
DEMO = SCRIPT_ROOT.parent / "examples" / "native-edits.json"
DEMO_INPUT = {"type": "boolean", "description": "Use the bundled synthetic example instead of chat history."}
REVIEW_INPUTS = {
    "demo": DEMO_INPUT,
    "turn": {"type": "integer", "minimum": 1, "description": "Recorded turn number, newest first."},
    "start_step": {"type": "integer", "minimum": 1, "description": "First step in a summary page."},
    "step": {"type": "integer", "minimum": 1, "description": "Return this step's diff only when requested."},
}
READ_ONLY = {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}
TOOLS = [
    {
        "name": "review_replay",
        "title": "Review recorded edits",
        "description": "List numbered edits from this local Codex chat. Supply a step only to show that step's recorded diff. Use demo mode for synthetic edits.",
        "inputSchema": {
            "type": "object", "properties": REVIEW_INPUTS, "additionalProperties": False,
            "not": {"required": ["step", "start_step"]},
        },
        "annotations": READ_ONLY,
    },
    {
        "name": "open_replay",
        "title": "Replay Theater",
        "description": "Open Replay Theater in the thread panel with recorded diffs from this local Codex chat or a synthetic demo. Use when interactive playback is requested.",
        "inputSchema": {"type": "object", "properties": {"demo": DEMO_INPUT}, "additionalProperties": False},
        "annotations": READ_ONLY,
        "_meta": {
            "ui": {"resourceUri": RESOURCE, "visibility": ["model", "app"]},
            "openai/ui": {"entrypoints": [{"type": "thread"}]},
        },
    },
]


def tool_result(message, *, error=False, structured=None, panel=None, demo=False):
    result = {"content": [{"type": "text", "text": message}]}
    if error:
        result["isError"] = True
    if structured is not None:
        result["structuredContent"] = structured
    if panel is not None:
        result["_meta"] = {"replay": panel, "demo": demo}
    return result


def bound_history(params):
    meta = params.get("_meta")
    thread = meta.get("threadId") if isinstance(meta, dict) else None
    try:
        if not isinstance(thread, str) or str(UUID(thread)) != thread:
            raise ValueError
    except ValueError:
        raise HistoryError("No verified local Codex chat binding. Open Replay Theater in the intended local chat.") from None
    with HistoryClient(timeout=5) as client:
        return collect(client, thread, max_turns=20, max_pages=8)


def panel_data(data):
    """Project complete edits into a bounded payload private to the MCP App."""
    panel = {
        "schemaVersion": data["schemaVersion"],
        "generatedAt": data["generatedAt"],
        "source": {"truncated": data["source"]["truncated"]},
        "warnings": list(data["warnings"]),
        "turns": [],
    }
    remaining = MAX_PANEL - 4096
    file_keys = {}
    limited = False
    for turn in data["turns"]:
        projected_turn = {key: turn[key] for key in ("id", "status", "startedAt", "completedAt")}
        projected_turn["steps"] = []
        remaining -= len(json.dumps(projected_turn).encode("utf-8")) + 2
        for step in turn["steps"]:
            projected = {key: step[key] for key in (
                "id", "kind", "status", "applied", "diff", "lines", "added", "removed"
            )}
            projected["path"] = str(file_keys.setdefault(step["path"], len(file_keys)))
            projected["displayPath"] = display_name(step["displayPath"])
            if step.get("displayMovePath"):
                projected["displayMovePath"] = display_name(step["displayMovePath"])
            if "provenance" in step:
                projected["provenance"] = {
                    key: value for key, value in step["provenance"].items()
                    if key in {"type", "toolName", "toolStatus", "attribution", "mode", "limited",
                               "ordering", "exitCode", "toolStatusSource"}
                }
            remaining -= len(json.dumps(projected).encode("utf-8")) + 2
            if remaining < 0:
                limited = True
                break
            projected_turn["steps"].append(projected)
        if projected_turn["steps"]:
            panel["turns"].append(projected_turn)
        if limited:
            panel["source"]["truncated"] = True
            panel["warnings"].append("Panel data limit reached. Ask in chat to view the remaining diffs step by step.")
            break
    return panel


def call_tool(params):
    name = params.get("name")
    tool = next((item for item in TOOLS if item["name"] == name), None)
    if tool is None:
        return tool_result("Unknown Replay Theater tool.", error=True)
    arguments = params.get("arguments", {})
    inputs = tool["inputSchema"]["properties"]
    if not isinstance(arguments, dict) or arguments.keys() - inputs.keys():
        return tool_result("Invalid Replay Theater arguments.", error=True)
    for key, value in arguments.items():
        valid = type(value) is bool if key == "demo" else type(value) is int and 1 <= value <= 100000
        if not valid:
            return tool_result(f"Invalid {key} value.", error=True)
    if {"step", "start_step"} <= arguments.keys():
        return tool_result("Choose a step diff or a summary page.", error=True)
    demo = arguments.get("demo", False)
    try:
        data = validate_data(read_json(DEMO) if demo else bound_history(params))
        if name == "review_replay":
            summary = inspect_replay(data, arguments.get("turn", 1), arguments.get("start_step", 1), arguments.get("step"))
            return tool_result("Recorded replay edits." if summary["stepCount"] else "No recorded edits.",
                               structured={**summary, "demo": demo})
        panel = panel_data(data)
        message = "Replay ready in the thread panel." if panel["turns"] else "No edits fit in the replay panel."
        if not data["turns"]:
            message = "No recorded edits in this replay."
        return tool_result(message, panel=panel, demo=demo)
    except HistoryError as error:
        # History errors may include raw RPC details or an executable path.
        message = str(error)
        if not message.startswith(("No verified local", "Turn must ", "Step must ", "The record has ", "This turn has ", "Start step ")):
            message = "Unable to read recorded edits for this local Codex chat."
        return tool_result(message, error=True)
    except (OSError, ValueError, KeyError, TypeError):
        return tool_result("Replay data is unavailable or invalid.", error=True)


def dispatch(method, params):
    if method == "initialize":
        protocol = params.get("protocolVersion")
        return {
            "protocolVersion": protocol if isinstance(protocol, str) and protocol in PROTOCOLS else "2025-11-25",
            "capabilities": {"tools": {}, "resources": {}},
            "serverInfo": {"name": "replay-theater", "version": VERSION},
        }
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        return call_tool(params)
    if method == "resources/list":
        return {"resources": [RESOURCE_INFO]}
    if method == "resources/templates/list":
        return {"resourceTemplates": []}
    if method == "resources/read":
        if params.get("uri") != RESOURCE:
            raise ValueError("Unknown replay resource.")
        bridge = (WEB_ROOT / "mcp-bridge.js").read_text(encoding="utf-8")
        return {"contents": [{
            **RESOURCE_INFO, "text": standalone_html("<script>" + bridge + "</script>"),
            "_meta": {"ui": {"prefersBorder": False},
                      "openai/ui": {"availableDisplayModes": ["inline", "fullscreen"]}},
        }]}
    raise LookupError("Method not found.")


def respond(request):
    if not isinstance(request, dict) or request.get("jsonrpc") != "2.0":
        return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid request."}}
    if "id" not in request:
        return None
    response = {"jsonrpc": "2.0", "id": request["id"]}
    try:
        params = request.get("params", {})
        if not isinstance(params, dict):
            raise ValueError("Invalid parameters.")
        response["result"] = dispatch(request.get("method"), params)
    except LookupError as error:
        response["error"] = {"code": -32601, "message": str(error)}
    except ValueError as error:
        response["error"] = {"code": -32602, "message": str(error)}
    except OSError:
        response["error"] = {"code": -32603, "message": "Bundled replay resource unavailable."}
    return response


def main():
    while line := sys.stdin.buffer.readline(MAX_REQUEST + 1):
        if len(line) > MAX_REQUEST:
            while line and not line.endswith(b"\n"):
                line = sys.stdin.buffer.readline(MAX_REQUEST + 1)
            response = {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Request too large."}}
        else:
            try:
                response = respond(json.loads(line))
            except (ValueError, RecursionError):
                response = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Invalid JSON."}}
        if response is not None:
            print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
