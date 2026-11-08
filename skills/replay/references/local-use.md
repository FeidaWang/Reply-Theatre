# Local commands

The desktop MCP panel reads the host-bound chat and renders the built-in UI resource. These commands are for supplied snapshots, explicit CLI workflows, browser viewing and export. Run commands from the installed skill's actual directory, or use absolute script paths.

```sh
python3 scripts/replay.py collect
python3 scripts/replay.py collect --thread-id VERIFIED_CHAT_ID
python3 scripts/replay.py collect --thread-id VERIFIED_CHAT_ID --engine /verified/path/to/codex
python3 scripts/replay.py inspect --data /path/to/saved.json
python3 scripts/replay.py inspect --data /path/to/saved.json --turn 1 --step 2
python3 scripts/replay.py view --data /path/to/saved.json
python3 scripts/replay.py export --data /path/to/saved.json --output /path/to/replay.html
python3 scripts/replay.py stop --data /path/to/saved.json
```

`collect` saves JSON without starting a viewer. `open` saves JSON and starts or reuses a viewer. Without an explicit ID these commands use `CODEX_THREAD_ID`; if absent, they report an error rather than guessing. Current-chat collection skips the newest stored turn by default. `--include-current` includes that potentially incomplete turn; `--skip-latest` also applies to a selected other chat. Limits are 20 edited turns and 100 pages by default; maximums are 200 turns and 1,000 pages. A bounded result is labelled truncated.

`inspect` returns up to 12 numbered edit summaries in the selected turn. The default is the latest recorded turn. Use `--start-step` for another page and `--step` for a single recorded diff, limited to 8,000 characters. Both forms work with supplied v1 and v2 snapshots without running the engine or starting a viewer.

The reader uses only `initialize`, `thread/read`, `thread/turns/list` and the initialization notification. It never starts or resumes a model turn. It reads a compatible bundled engine when available or finds `codex` on PATH. `CODEX_REPLAY_ENGINE` or `--engine` can select a verified executable. Reading or executing an app's existing engine does not grant permission to modify the app bundle.

`view`, `export` and `stop` do not need a Codex engine. The viewer stores position alongside the selected JSON; an input in a read-only directory can still display, but server launch or position persistence may fail. Copy a supplied record into a user-approved writable workspace if needed. Records are not copied from another chat automatically.

The viewer expires after 12 idle hours. Run `stop` to end the server. The saved record remains available. Exported HTML embeds all viewer resources and needs no server. Hosts may restrict opening local HTML. Deliver the artifact without bypassing those restrictions.

These CLI commands do not write capture policy, hooks, trust records, MCP configuration or plugin-upgrade bridges. The full plugin's capture journal is not read. Existing v2 files retain their recorded evidence and uncertainty labels.

The **Review** filter includes native proposals and supplied capture records with a non-successful tool result, uncertain attribution or ordering, or limited coverage. An observed edit can appear under both **Applied** and **Review**. The round totals still count confirmed changes across all filters.

On compatible ChatGPT desktop versions, open the local viewer in the built-in browser. **Annotate** opens a native annotation for the selected edit’s file and status. To annotate specific code, select text within the diff in the browser’s Annotation mode. The browser’s site controls manage access. When site tools are available, ask Codex to use `show_replay_step` with the step number shown in the player. The tool respects the current round and filters and returns the visible file name and status without the diff body.

See [Annotations Extensibility](https://learn.chatgpt.com/docs/annotations-extensibility) and [Site tools](https://learn.chatgpt.com/docs/webmcp).
