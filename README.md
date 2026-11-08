# Replay Theater

[简体中文](README.zh-CN.md)

Codex is an AI assistant that can edit your project files. When it says a task is done, you may want to see what changed before you accept the work or pass it to a teammate. Replay Theater turns the edits Codex recorded into a numbered list you can go through one at a time.

## Pick the version you need

- **Check your own project.** Use the **desktop edition** in the Codex chat where the work happened. It can show a list in chat or open a player beside it.
- **See an example first.** Watch the short demo, or use the **hosted demo** to ask about four sample edits. It works with sample files such as `greeting.py`. [Watch the demo](https://replay-theater-demo.475035492.workers.dev/replay-theater-demo-walkthrough.mp4)

## Set up the desktop edition

You need a Codex desktop app with local plugin support and Python 3.9 or newer on your computer. Open Terminal and run `codex --version` and `python3 --version` to check that both commands work.

Paste these lines into Terminal. The first tells Codex where to find Replay Theater. The second installs it.

```sh
codex plugin marketplace add FeidaWang/Reply-Theatre
codex plugin add replay-theater@reply-theatre
```

Reopen Codex Desktop. If you already added this marketplace, run `codex plugin marketplace upgrade reply-theatre` before running the install line again. [Install from the desktop ZIP instead](#install-from-the-desktop-zip)

## Review your first edit

1. Open the local Codex chat where you asked Codex to change a file. Type `$replay-theater:replay`, then ask **“Which file edits did Codex record in this chat?”**
2. Pick an edit from the numbered list. Ask **“Show me what changed in step 2”**, or **“Open Replay Theater so I can review the changes one at a time.”**
3. Look at the changed lines. Green means a line was added and red means a line was removed. This before-and-after view is called a **diff**. In the player, **Applied** shows completed edits and **Review** shows edits that need a closer look. A failed proposal is a suggested change that the replay does not count as applied.

If you have no edits yet, ask **“Open the sample replay so I can practise reviewing an edit.”** If a change is missing, check the file itself. Replay Theater shows the history Codex recorded, which can omit changes from commands or other tools. You can inspect and copy a diff. Replay Theater only reads the edit record.

## Try the hosted demo

The hosted demo shows the same four sample edits to everyone. Once it is connected, ask **“List the sample edits”**, then **“Show me what changed in step 2.”** The example changes `print("Hello")` to `print("Hello, replay!")`. [Connect from the Codex command line](#connect-the-hosted-demo)

If you manage plugins in OpenAI Platform, upload the demo ZIP as its own draft. It connects to the public MCP endpoint with **No authentication**. An MCP endpoint is the address your chat client uses to call the demo’s tools. [Download the hosted demo ZIP](https://github.com/FeidaWang/Reply-Theatre/raw/refs/heads/main/downloads/replay-theater-demo-openai-0.1.3.zip) · [MCP endpoint](https://replay-theater-demo.475035492.workers.dev/mcp)

## Connect the hosted demo

If you have the `codex` command, paste this line into Terminal, then start a new Codex session and ask to list the Replay Theater sample edits.

```sh
codex mcp add replay-theater-demo --url https://replay-theater-demo.475035492.workers.dev/mcp
```

## Install from the desktop ZIP

Download the desktop ZIP. Open Terminal in the download folder and paste the block below. Keep the extracted folder so Codex can find the plugin again. [Download the desktop ZIP](https://github.com/FeidaWang/Reply-Theatre/raw/refs/heads/main/downloads/replay-theater-openai-desktop-mcp-0.5.1.zip)

```sh
replay_install_dir="$(mktemp -d "$PWD/replay-theater-install.XXXXXX")"
unzip replay-theater-openai-desktop-mcp-0.5.1.zip -d "$replay_install_dir"
mkdir -p "$replay_install_dir/.agents/plugins"
cat > "$replay_install_dir/.agents/plugins/marketplace.json" <<'JSON'
{
  "name": "reply-theatre-zip",
  "plugins": [
    {
      "name": "replay-theater",
      "source": {"source": "local", "path": "./replay-theater"},
      "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
      "category": "Productivity"
    }
  ]
}
JSON
codex plugin marketplace add "$replay_install_dir"
codex plugin add replay-theater@reply-theatre-zip
```

Reopen Codex Desktop when installation finishes.

[Help](SUPPORT.md) · [Local commands](skills/replay/references/local-use.md) · [MIT License](LICENSE)

Desktop · [Privacy](PRIVACY.md) · [Terms](TERMS.md)

Hosted demo · [Privacy](https://replay-theater-demo.475035492.workers.dev/privacy.html) · [Terms](https://replay-theater-demo.475035492.workers.dev/terms.html)
