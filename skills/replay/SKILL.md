---
name: replay
description: Replay recorded local Codex native file edits in a browser, filter by turn or file, view a supplied Replay Theater JSON snapshot, or export an offline HTML replay. Use for edit-history replay requests, not automatic change recording.
---

# Replay recorded edits

Explicit user instructions take priority over this workflow. This is a self-contained skill with local scripts and viewer resources. It requires Python 3.9+. Native history collection also requires a compatible local Codex app-server and permission to read the intended chat history. No OpenAI API key is required. This edition has no MCP tools or lifecycle hooks.

Resolve `<skill-root>` as the actual directory containing this installed `SKILL.md`. Do not hard-code an author workspace or plugin cache path. In a plugin, the skill is named `$replay-theater:replay`.

## Choose the input

- For the previous edits in this local Codex chat, run `python3 "<skill-root>/scripts/replay.py" open`. It uses `CODEX_THREAD_ID`, skips the newest turn containing this invocation, and saves up to 20 ended turns with recorded native edits.
- For a user-selected other chat, resolve its verified ID with available chat listing/reading tools and pass `--thread-id`. Never guess an ID or silently substitute another chat. Add `--skip-latest` when requested.
- Only when explicitly asked for the ongoing turn, add `--include-current`. Explain that this is a potentially incomplete persisted snapshot: stored status does not prove that a live session has ended.
- For a supplied saved JSON file, run `python3 "<skill-root>/scripts/replay.py" view --data "<verified-input-path>"`. This makes no history requests. Both v1 and v2 snapshots are supported, including previously captured evidence already present in a v2 file.

Do not try to read a user's computer from an environment without local access. In that case request an accessible saved JSON record or explain the required local runtime. If no engine is available, report the error. Use `--engine` only with a verified compatible executable; never alter installed application or browser bundles, personal browser profiles, permissions or trust settings to enable the workflow.

## Show the replay

The command returns JSON including `url` and `dataPath`. Open that exact local URL with `open_in_codex` using its browser target when available. Otherwise use the provided browser tools, or return a clickable local link. Do not automatically launch an external browser. Explain an empty replay instead of looking in another chat.

The viewer includes a film timeline, automatic playback at three speeds, file search/filtering, copy diff, split/unified views and wrapping. Its labels currently use Simplified Chinese. Space plays/pauses; P/N navigate; Home/End go to the boundaries; ? opens help; Esc closes a dialog first or the replay otherwise. Arrows scroll focused code panels and navigate edits elsewhere. Viewer interactions do not request model inference; invoking this skill is still a model workflow.

Records and position persist under `CODEX_HOME/replay-theater-skills` (default `~/.codex/replay-theater-skills`), independently of the full plugin. Refresh rereads the saved snapshot; rerun `open` to collect newer history. This edition never reads the full plugin's capture journal or installs a recorder. It records only native `fileChange` items: Shell, formatter, MCP and subagent edits may be absent. Failed/declined/in-progress native diffs are proposals, not proof of applied changes. For supplied v2 records, distinguish observed changes, failed-tool side effects and uncertain attribution without guessing missing order or file contents.

## Export or stop

For export, run `python3 "<skill-root>/scripts/replay.py" export --data "<dataPath>" --output "<requested-output.html>"` and deliver the local HTML file. It embeds the source diff and can be opened offline where the host permits local HTML. Never bypass a browser's file URL restrictions. Saved records and exports can contain source code and paths; share them only within the user's requested scope.

To stop the selected local viewer, run `python3 "<skill-root>/scripts/replay.py" stop --data "<dataPath>"`. Its saved record remains. The viewer also exits after 12 idle hours.

For a safe demonstration without personal history, use `examples/native-edits.json` alongside this skill. Read `references/local-use.md` for commands, runtime requirements and limitations.
