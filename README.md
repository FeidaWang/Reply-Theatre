# Replay Theater — Skills-only edition

Replay recorded file edits from local Codex history, view a saved Replay Theater JSON record, or export a standalone HTML replay. This free edition includes one self-contained skill, Python scripts, schemas and the local browser viewer. It has no MCP connection or lifecycle hooks.

Published by **Feida Wang**. Source: [FeidaWang/Reply-Theatre](https://github.com/FeidaWang/Reply-Theatre). Help and issue-reporting instructions are in [SUPPORT.md](SUPPORT.md). Read the [privacy policy](PRIVACY.md) and [terms of use](TERMS.md).

## What you need

Python 3.9 or later is required. Collection from a chat also needs a compatible local Codex app-server supporting paginated history, access to that chat and its verified ID. The Python runtime uses only the standard library; no pip installation or API key is needed. Installing a skill does not provide local filesystem access or the Codex engine to a cloud-only host.

## Try it

Invoke the installed skill and ask: “Replay the recorded file edits from my previous Codex turn.” For a demonstration without personal history, run:

```sh
python3 skills/replay/scripts/replay.py view --data skills/replay/examples/native-edits.json
```

Open the returned local URL with the host's browser tools. The command does not automatically open an external browser. The viewer currently uses Simplified Chinese labels and includes playback, a film timeline, file filters and split/unified diffs. Detailed commands are in `skills/replay/references/local-use.md`.

## Data and limits

Native collection saves records under `CODEX_HOME/replay-theater-skills`, or `~/.codex/replay-theater-skills` by default, separately from the full plugin. The viewer listens only on token-scoped `127.0.0.1` URLs, serves the selected snapshot and local assets, and saves viewing position. It has no general filesystem browser. It performs no remote MCP requests and sends no records to a publisher-operated service. The assistant host's own handling of prompts and tool results remains subject to that host's settings and policies.

Native history can omit Shell, formatter, MCP and subagent edits. Proposed or failed native diffs do not prove changes were applied. Supplied v2 JSON records can include older observed evidence; viewing them does not activate recording. Missing full-file versions cannot be reconstructed. Exported HTML embeds recorded code and paths; share it deliberately.

## Editions

The complete local plugin, with optional reviewed capture hooks and MCP inspection, is a separate distribution. This package does not replace it or change its installation, configuration or data. Do not install two plugins with the same identity into the same managed source as an upgrade unless you intend to switch editions.

This ZIP is a locally validated preparation package. Public submission still requires the real listing pages and publisher verification described in `OPENAI-PREPARATION.md`; it has not been uploaded, approved or published.

MIT licence. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.

## Download and install

The [OpenAI Skills-only ZIP](downloads/replay-theater-openai-skills-0.4.2.zip) contains a single `replay-theater/` directory. It is a preparation package, not an OpenAI-approved directory release.

For a standalone local skill, clone this repository and copy the complete `skills/replay` folder to your local skills directory. Keep the scripts, web assets, schemas, examples and references together. For example, from the repository root:

```sh
mkdir -p ~/.agents/skills
# Choose a different destination if a skill named replay is already installed.
cp -R skills/replay ~/.agents/skills/replay
```

In Codex, invoke `$replay`. When installed as a plugin, invoke `$replay-theater:replay`. This repository preserves the requested name **Reply-Theatre**; the plugin's manifest identity and product name remain **replay-theater / Replay Theater**.
