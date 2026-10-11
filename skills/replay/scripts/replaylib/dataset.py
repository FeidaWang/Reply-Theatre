"""Normalize native edits without reading today's files or inventing versions."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from .history import HistoryError, RpcError
from .schema import validate_schema, replay_schema

HUNK = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")
ENDED = {"completed", "interrupted", "failed"}
STATUSES = {"completed", "failed", "declined", "inProgress"}


def diff_lines(diff, kind):
    raw = diff.splitlines()
    if kind in {"add", "delete"}:
        return [{"op": "+" if kind == "add" else "-", "text": line,
                 "old": n if kind == "delete" else None,
                 "new": n if kind == "add" else None} for n, line in enumerate(raw, 1)]
    lines, old, new = [], None, None
    for line in raw:
        match = HUNK.match(line)
        if match:
            old, new = map(int, match.groups())
            lines.append({"op": "@", "text": line, "old": None, "new": None})
        elif old is not None and line[:1] in {"+", "-", " "}:
            op = line[0]
            lines.append({"op": op, "text": line[1:], "old": old if op != "+" else None,
                          "new": new if op != "-" else None})
            old += op != "+"
            new += op != "-"
        elif line.startswith("\\ No newline"):
            lines.append({"op": "!", "text": line, "old": None, "new": None})
        else:
            # Preserve headers, binary notices and unknown formats as raw evidence.
            lines.append({"op": "?", "text": line, "old": None, "new": None})
    return lines


def display_path(path, cwd):
    try:
        return str(Path(path).relative_to(cwd)) if cwd else path
    except ValueError:
        return path


def normalize_turn(turn, cwd):
    steps = []
    for item in turn.get("items", []):
        if item.get("type") != "fileChange":
            continue
        for index, change in enumerate(item.get("changes", [])):
            kind = change.get("kind", {})
            if kind.get("type") not in {"add", "delete", "update"}:
                raise HistoryError("Unsupported native edit kind; refusing to guess its meaning.")
            path, diff = change.get("path"), change.get("diff")
            status = item.get("status")
            if not isinstance(path, str) or not isinstance(diff, str) or status not in STATUSES:
                raise HistoryError("Native fileChange did not match the supported contract.")
            lines = diff_lines(diff, kind["type"])
            move_path = kind.get("move_path")
            steps.append({
                "id": f"{turn['id']}:{item['id']}:{index}", "itemId": item["id"],
                "path": path, "displayPath": display_path(path, cwd),
                "kind": kind["type"], "movePath": move_path,
                "displayMovePath": display_path(move_path, cwd) if move_path else None,
                "status": status, "applied": status == "completed", "diff": diff, "lines": lines,
                "added": sum(line["op"] == "+" for line in lines),
                "removed": sum(line["op"] == "-" for line in lines),
            })
    if not steps:
        return None
    return {"id": turn["id"], "status": turn["status"], "startedAt": turn.get("startedAt"),
            "completedAt": turn.get("completedAt"), "steps": steps}


def collect(client, thread_id, skip_latest=False, max_turns=20, max_pages=100):
    thread = client.request("thread/read", {"threadId": thread_id, "includeTurns": False})["thread"]
    turns, seen_turns, seen_cursors = [], set(), set()
    cursor = None
    pages = 0
    skipped_turn = None
    truncated = False
    while pages < max_pages:
        params = {"threadId": thread_id, "limit": 20, "sortDirection": "desc", "itemsView": "full"}
        if cursor:
            params["cursor"] = cursor
        try:
            page = client.request("thread/turns/list", params)
        except RpcError as error:
            if error.code == -32601:
                raise HistoryError("This Codex engine does not support paginated history. Use a compatible --engine; no incomplete fallback was saved.") from error
            raise
        pages += 1
        entries = page.get("data")
        if not isinstance(entries, list):
            raise HistoryError("Invalid history page.")
        for position, turn in enumerate(entries):
            if pages == 1 and position == 0 and skip_latest:
                skipped_turn = turn["id"]
                seen_turns.add(turn["id"])
                continue
            if turn["id"] in seen_turns:
                continue
            seen_turns.add(turn["id"])
            if turn.get("status") not in ENDED:
                continue
            if turn.get("itemsView") != "full":
                raise HistoryError("Engine returned partial turn items despite requesting full history.")
            normalized = normalize_turn(turn, thread.get("cwd"))
            if normalized:
                turns.append(normalized)
            if len(turns) >= max_turns:
                truncated = position < len(entries) - 1 or bool(page.get("nextCursor"))
                break
        if len(turns) >= max_turns:
            break
        cursor = page.get("nextCursor")
        if not cursor:
            break
        if cursor in seen_cursors:
            raise HistoryError("Engine repeated a history cursor; pagination stopped without saving.")
        seen_cursors.add(cursor)
    else:
        truncated = bool(cursor)
    warnings = ["仅包含原生 fileChange；Shell、格式化器、MCP 和子代理的改动可能缺失。", "diff 是当时的记录；未读取当前文件，也不代表完整文件版本。"]
    if skipped_turn:
        warnings.append("当前聊天最新回合已跳过，避免回放本次调用；回合状态来自持久历史。")
    if truncated:
        warnings.append("已达到历史读取上限；更早的回合未载入。")
    data = {
        "schemaVersion": 1, "threadId": thread_id, "cwd": thread.get("cwd"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {"type": "codex-native-fileChange", "engine": client.engine,
                   "userAgent": client.user_agent, "modelRequests": 0,
                   "pagesRead": pages, "truncated": truncated, "skippedTurnId": skipped_turn},
        "warnings": warnings, "turns": turns,
    }
    return data


def validate_data(data):
    if not isinstance(data,dict):
        raise HistoryError("Invalid replay dataset")
    version = data.get("schemaVersion")
    if type(version) is not int or version not in {1,2}:
        raise HistoryError("Unsupported replay schemaVersion (expected 1 or 2)")
    validate_schema(data,replay_schema(version))
    if not isinstance(data.get("threadId"), str) or not isinstance(data.get("turns"), list) or not isinstance(data.get("generatedAt"), str):
        raise HistoryError("Invalid replay dataset.")
    if not isinstance(data.get("warnings"), list) or not all(isinstance(w, str) for w in data["warnings"]):
        raise HistoryError("Invalid replay warnings.")
    if not isinstance(data.get("source"), dict) or data["source"].get("type") != ("codex-edit-replay" if version == 2 else "codex-native-fileChange"):
        raise HistoryError("Invalid replay source.")
    if data.get("cwd") is not None and not isinstance(data["cwd"], str):
        raise HistoryError("Invalid replay cwd.")
    ids = set()
    turn_ids = set()
    for turn in data["turns"]:
        if not isinstance(turn, dict) or not isinstance(turn.get("id"), str) or turn.get("status") not in ENDED or not isinstance(turn.get("steps"), list):
            raise HistoryError("Invalid replay turn.")
        if turn["id"] in turn_ids:
            raise HistoryError("Duplicate replay turn ID.")
        turn_ids.add(turn["id"])
        for step in turn["steps"]:
            if not isinstance(step, dict) or not isinstance(step.get("id"), str) or step["id"] in ids:
                raise HistoryError("Invalid or duplicate replay step ID.")
            ids.add(step["id"])
            if step.get("kind") not in {"add", "delete", "update"} or step.get("status") not in STATUSES:
                raise HistoryError("Invalid replay step kind/status.")
            if not all(isinstance(step.get(key), str) for key in ("path", "displayPath", "diff", "itemId")):
                raise HistoryError("Invalid replay step text.")
            if step.get("lines") != diff_lines(step["diff"], step["kind"]):
                raise HistoryError("Replay lines do not match the source diff.")
            if step.get("applied") != (step["status"] == "completed"):
                raise HistoryError("Replay applied flag does not match native status.")
            for key, op in (("added", "+"), ("removed", "-")):
                if type(step.get(key)) is not int or step[key] != sum(line["op"] == op for line in step["lines"]):
                    raise HistoryError("Replay line counts do not match the source diff.")
            for key in ("movePath", "displayMovePath"):
                if step.get(key) is not None and not isinstance(step[key], str):
                    raise HistoryError("Invalid replay move path.")
            if version == 2:
                provenance = step["provenance"]
                if provenance["type"] == "native":
                    if set(provenance) != {"type"}:
                        raise HistoryError("Native provenance contains unexpected fields")
                else:
                    required = {"type","toolName","toolStatus","attribution","mode","observedAt","beforeHash","afterHash","limited","ordering"}
                    if not required <= set(provenance) or set(provenance) - required - {"exitCode","toolStatusSource"} or not step["applied"] or step["status"] != "completed":
                        raise HistoryError("Invalid observed-change provenance")
                    if "exitCode" in provenance and provenance["exitCode"] is not None:
                        if type(provenance["exitCode"]) is not int or provenance["toolStatus"] != ("succeeded" if provenance["exitCode"] == 0 else "failed"):
                            raise HistoryError("Exit code disagrees with tool status")
                    if "toolStatusSource" in provenance and provenance["toolStatusSource"] not in {"hook-response","native-transcript-completion"}:
                        raise HistoryError("Unknown tool status source")
                    for key in ("beforeHash","afterHash"):
                        if provenance[key] is not None and not re.fullmatch("[0-9a-f]{64}",provenance[key]):
                            raise HistoryError("Invalid snapshot hash")
                    if provenance["beforeHash"] == provenance["afterHash"]:
                        raise HistoryError("Observed change has identical before/after hashes")
    return data


def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix=".replay-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(data, output, ensure_ascii=False, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def dataset_path(store, thread_id):
    # A thread identifier is data, never a filesystem path.
    return Path(store) / (hashlib.sha256(thread_id.encode()).hexdigest()[:24] + ".json")
