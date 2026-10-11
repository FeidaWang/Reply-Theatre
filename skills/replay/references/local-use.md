# Local commands

Run commands from the installed skill's actual directory, or use absolute script paths.

```sh
python3 scripts/replay.py open
python3 scripts/replay.py collect --thread-id VERIFIED_CHAT_ID
python3 scripts/replay.py open --thread-id VERIFIED_CHAT_ID --engine /verified/path/to/codex
python3 scripts/replay.py view --data /path/to/saved.json
python3 scripts/replay.py export --data /path/to/saved.json --output /path/to/replay.html
python3 scripts/replay.py stop --data /path/to/saved.json
```

`collect` saves JSON without starting a viewer. `open` saves JSON and starts or reuses a viewer. Without an explicit ID these commands use `CODEX_THREAD_ID`; if absent, they report an error rather than guessing. Current-chat collection skips the newest stored turn by default. `--include-current` includes that potentially incomplete turn; `--skip-latest` also applies to a selected other chat. Limits are 20 edited turns and 100 pages by default; maximums are 200 turns and 1,000 pages. A bounded result is labelled truncated.

The reader uses only `initialize`, `thread/read`, `thread/turns/list` and the initialization notification. It never starts or resumes a model turn. It reads a compatible bundled engine when available or finds `codex` on PATH. `CODEX_REPLAY_ENGINE` or `--engine` can select a verified executable. Reading or executing an app's existing engine does not grant permission to modify the app bundle.

`view`, `export` and `stop` do not need a Codex engine. The viewer stores position alongside the selected JSON; an input in a read-only directory can still display, but server launch or position persistence may fail. Copy a supplied record into a user-approved writable workspace if needed. Records are not copied from another chat automatically.

The viewer expires after 12 idle hours. Its close control hides the replay while preserving the record; `stop` ends the server. Exported HTML embeds all viewer resources and needs no server. Hosts may restrict opening local HTML; deliver the artifact without bypassing those restrictions.

This edition creates no project capture policy, hook definitions, trust records, MCP configuration or plugin-upgrade bridges. The full plugin's capture journal is not read. Existing v2 files retain their recorded evidence and uncertainty labels.
