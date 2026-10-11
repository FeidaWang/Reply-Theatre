# Replay Theater privacy policy

Effective date: **11 October 2026**

Publisher and maintainer: **Feida Wang**. Product: **Replay Theater — Skills-only edition**, published in [FeidaWang/Reply-Theatre](https://github.com/FeidaWang/Reply-Theatre).

This policy covers the skill, its bundled Python scripts and local browser viewer in this repository. The full plugin with capture hooks, remote MCP deployments, modified third-party editions and the assistant platform itself have different capabilities and are outside this policy's scope.

## Local processing and information used

This edition operates in the environment where you run it. It does not provide a publisher-operated replay service, create a Replay Theater account, request an API key or automatically send your replay records to Feida Wang.

When you ask it to collect local Codex history, the reader requests the selected chat's metadata and paginated turn history from your local Codex app-server. It saves recorded native file-change evidence and the metadata needed to display it. A replay can contain source-code diffs, file names and absolute paths, project locations, chat/turn/tool identifiers, timestamps, edit status and line counts, plus the engine path and user-agent information. Source code or paths may themselves contain personal or confidential information. The saved replay does not reproduce the complete conversation or reconstruct complete earlier file versions.

When you supply an existing Replay Theater JSON file, the viewer validates and displays that file. A v2 file can include previously recorded tool names, tool outcomes, file hashes and attribution information. Viewing it does not install or activate a recorder. This edition does not collect Shell, formatter or MCP file changes itself.

The viewer uses local browser storage for its selected turn and step, file filter, search text, diff view, wrapping, playback speed and related preferences. In live viewing, it also saves the replay position alongside the chosen JSON. A local server-state file contains process information, the selected record path and the token-scoped viewer URL. These are used to start, reuse or stop the selected viewer. Choosing **Copy diff** writes the selected diff to your system clipboard.

These uses support the replay, filtering, position restoration, copying and export actions you request. The bundled viewer has no advertising or tracking SDK and does not set tracking cookies. It loads its viewer assets locally, and its HTTP access logging is disabled. These statements describe this edition's own code, not the behaviour of your assistant, Codex engine, browser, extensions or operating system.

## Storage, retention and deletion

Newly collected JSON records are saved under `CODEX_HOME/replay-theater-skills`, normally `~/.codex/replay-theater-skills`. A different `--store` location can be selected. Position and server-state files are stored alongside the selected record. Viewing an existing JSON uses its supplied location. HTML exports are written to the location you choose and embed the recorded diffs and viewer resources.

Replay records, position files and exports have **no automatic deletion period**: they remain until you delete them or your environment removes them. Browser preferences remain until you clear the relevant site's browser storage. Closing the viewer, stopping its server or uninstalling the skill does not erase saved records, exports or browser storage. The server normally exits after 12 idle hours; that timeout does not delete your replay. Backups, synced folders, clipboard history and copies you share can retain additional copies under their own settings.

To remove local data, stop the viewer for that record, delete the selected JSON and related `.position.json` and any remaining `.server.json` files, remove exports and shared copies you control, and clear the relevant browser storage. Preserve files you still need. These actions do not delete the original Codex chat history. Use the host's own controls to manage that history. Feida Wang cannot access or remotely delete records that remain on your computer.

## Recipients and third-party platforms

The bundled scripts communicate with the local Codex engine and the viewer on `127.0.0.1`; they do not automatically upload replay data to the publisher. Anyone with access to your files, device, browser storage or an active viewer link may be able to see the corresponding information. A local viewer link is not a public hosting link; avoid exposing the service through a proxy or sharing it beyond your intended scope.

An assistant host may process your prompt, supplied files and tool results under its own privacy policy and account settings. Uploading a JSON record to that host, copying a diff into a chat or sharing an exported HTML file can disclose code and paths to the recipients you choose. Local operation does not mean that every action taken through an assistant remains on your device.

GitHub hosts this repository, downloads and the support issue tracker. GitHub can process website and download traffic, account information and issue activity under its [General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Its platform processing, retention, international transfers and account controls are governed by that statement rather than the local viewer's storage behaviour.

## Support information and privacy requests

If you voluntarily open a GitHub issue or comment, Feida Wang and other readers can see your public GitHub identity and the information you include. That information may be used to answer the request, investigate the reported problem and maintain the software. Public issue material remains on GitHub until you, the maintainer or GitHub removes it where their permissions allow. Closing an issue does not delete it; GitHub's backups and platform retention are governed by its own policy, and third-party copies may remain.

Support does not require a personal replay record. Use the synthetic example and redacted error messages. Do not post passwords, API keys, private source code, government identifiers, payment details, health information or other sensitive personal information. The project provides a public issue channel, not a private channel for sensitive submissions.

For questions or requests concerning information you have posted to this project, follow [SUPPORT.md](SUPPORT.md) and open a minimal issue without including the information you want removed. You can edit or delete your own content where GitHub permits, ask the maintainer to review removal of project content within their control, or contact GitHub for its platform privacy processes. Applicable privacy rights are not limited by this policy.

## Changes

Policy updates will be published in this file with a revised effective date and visible Git history. If a future edition introduces a hosted service, telemetry or additional data collection, its policy must explain those practices before they are introduced. This policy does not describe such a service.
