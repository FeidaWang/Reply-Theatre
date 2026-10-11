#!/usr/bin/env python3
"""Replay local Codex native edit history or a supplied saved snapshot."""
import argparse
import json
import os
from pathlib import Path
import sys

from replaylib.dataset import atomic_json, collect, dataset_path, validate_data
from replaylib.history import HistoryClient, HistoryError
from replaylib.service import ensure_server, export_html, read_json, serve, stop_server


def default_store():
    return Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))).expanduser() / "replay-theater-skills"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("collect", "open"):
        part = sub.add_parser(command)
        part.add_argument("--thread-id", default=os.environ.get("CODEX_THREAD_ID"))
        part.add_argument("--engine")
        part.add_argument("--store", default=str(default_store()))
        part.add_argument("--max-turns", type=int, default=20)
        part.add_argument("--max-pages", type=int, default=100)
        part.add_argument("--include-current", action="store_true", help="Include the newest stored turn; it may be incomplete.")
        part.add_argument("--skip-latest", action="store_true")
    part = sub.add_parser("view", help="View a supplied saved JSON snapshot without history requests.")
    part.add_argument("--data", required=True)
    part = sub.add_parser("export", help="Export a self-contained offline HTML replay.")
    part.add_argument("--data", required=True)
    part.add_argument("--output", required=True)
    part = sub.add_parser("stop", help="Stop the selected viewer and keep its saved records.")
    part.add_argument("--data", required=True)
    part = sub.add_parser("serve", help="Internal viewer process.")
    part.add_argument("--data", required=True)
    part.add_argument("--state", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "serve":
            serve(args.data, args.state)
            return 0
        if args.command == "stop":
            print(json.dumps({"stopped": stop_server(args.data)}))
            return 0
        if args.command == "export":
            # Validate before opening the destination, so bad input cannot truncate it.
            html = export_html(read_json(args.data))
            destination = Path(args.output).expanduser().resolve()
            if destination == Path(args.data).expanduser().resolve():
                raise HistoryError("Choose an export destination different from the saved JSON.")
            destination.parent.mkdir(parents=True, exist_ok=True)
            fd = os.open(destination, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as output:
                output.write(html)
            print(json.dumps({"output": str(destination), "offline": True}))
            return 0
        if args.command == "view":
            validate_data(read_json(args.data))
            print(json.dumps(ensure_server(args.data)))
            return 0
        if not args.thread_id:
            raise HistoryError("CODEX_THREAD_ID is unavailable. Supply the intended --thread-id; no other chat was guessed.")
        if not 1 <= args.max_turns <= 200 or not 1 <= args.max_pages <= 1000:
            raise HistoryError("--max-turns must be 1..200 and --max-pages 1..1000.")
        if args.include_current and args.skip_latest:
            raise HistoryError("Choose --include-current or --skip-latest, not both.")
        skip = args.skip_latest or (args.thread_id == os.environ.get("CODEX_THREAD_ID") and not args.include_current)
        with HistoryClient(args.engine) as client:
            data = collect(client, args.thread_id, skip_latest=skip, max_turns=args.max_turns, max_pages=args.max_pages)
        validate_data(data)
        path = dataset_path(Path(args.store).expanduser().resolve(), args.thread_id)
        atomic_json(path, data)
        result = {"dataPath": str(path), "turns": len(data["turns"]),
                  "steps": sum(len(turn["steps"]) for turn in data["turns"]),
                  "modelRequests": 0, "skippedTurnId": data["source"]["skippedTurnId"],
                  "truncated": data["source"]["truncated"]}
        if args.command == "open":
            result.update(ensure_server(path))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (HistoryError, OSError, ValueError, KeyError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
