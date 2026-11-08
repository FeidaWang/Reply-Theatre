# Replay Theater

[English](#english) · [简体中文](#简体中文)

## English

Codex is an AI assistant that can edit your project files. When it says a task is done, you may want to see what changed before you accept the work or pass it to a teammate. Replay Theater turns the edits Codex recorded into a numbered list you can go through one at a time.

### Pick the version you need

- **Check your own project.** Use the **desktop edition** in the Codex chat where the work happened. It can show a list in chat or open a player beside it.
- **See an example first.** Watch the short demo, or use the **hosted demo** to ask about four sample edits. It works with sample files such as `greeting.py`. [Watch the demo](https://replay-theater-demo.475035492.workers.dev/replay-theater-demo-walkthrough.mp4)

### Set up the desktop edition

You need a Codex desktop app with local plugin support and Python 3.9 or newer on your computer. Open Terminal and run `codex --version` and `python3 --version` to check that both commands work.

Paste these lines into Terminal. The first tells Codex where to find Replay Theater. The second installs it.

```sh
codex plugin marketplace add FeidaWang/Reply-Theatre
codex plugin add replay-theater@reply-theatre
```

Reopen Codex Desktop. If you already added this marketplace, run `codex plugin marketplace upgrade reply-theatre` before running the install line again. [Install from the desktop ZIP instead](#install-from-the-desktop-zip--从桌面版-zip-安装)

### Review your first edit

1. Open the local Codex chat where you asked Codex to change a file. Type `$replay-theater:replay`, then ask **“Which file edits did Codex record in this chat?”**
2. Pick an edit from the numbered list. Ask **“Show me what changed in step 2”**, or **“Open Replay Theater so I can review the changes one at a time.”**
3. Look at the changed lines. Green means a line was added and red means a line was removed. This before-and-after view is called a **diff**. In the player, **Applied** shows completed edits and **Review** shows edits that need a closer look. A failed proposal is a suggested change that the replay does not count as applied.

If you have no edits yet, ask **“Open the sample replay so I can practise reviewing an edit.”** If a change is missing, check the file itself. Replay Theater shows the history Codex recorded, which can omit changes from commands or other tools. You can inspect and copy a diff. Replay Theater only reads the edit record.

### Try the hosted demo

The hosted demo shows the same four sample edits to everyone. Once it is connected, ask **“List the sample edits”**, then **“Show me what changed in step 2.”** The example changes `print("Hello")` to `print("Hello, replay!")`. [Connect from the Codex command line](#connect-the-hosted-demo--连接在线演示版)

If you manage plugins in OpenAI Platform, upload the demo ZIP as its own draft. It connects to the public MCP endpoint with **No authentication**. An MCP endpoint is the address your chat client uses to call the demo’s tools. [Download the hosted demo ZIP](https://github.com/FeidaWang/Reply-Theatre/raw/refs/heads/main/downloads/replay-theater-demo-openai-0.1.3.zip) · [MCP endpoint](https://replay-theater-demo.475035492.workers.dev/mcp)

## 简体中文

Codex 是一个可以帮你改项目文件的 AI 助手。它说任务做完了，你可能想先看看它动了哪些文件、具体改了什么，再决定要不要接受这次修改，或把工作交给同事。Replay Theater 会把 Codex 记录下来的文件改动列成清单，让你按顺序一条条看。

### 选一个版本

- **要看自己的项目。** 用 **桌面版**，打开 Codex 当时改文件的那个本地聊天。你可以在聊天里读清单，也可以打开旁边的回放面板。
- **想先看个例子。** 可以看短视频，或用 **在线演示版** 试着提问。里面有四条示例改动，用的是 `greeting.py` 这样的示例文件。[观看演示视频](https://replay-theater-demo.475035492.workers.dev/replay-theater-demo-walkthrough.mp4)

### 安装桌面版

你需要支持本地插件的 Codex 桌面版，以及 Python 3.9 或更新版本。打开终端，运行 `codex --version` 和 `python3 --version`，确认两个命令都能显示版本号。

把下面两行贴进终端。第一行告诉 Codex 去哪里找 Replay Theater，第二行安装它。

```sh
codex plugin marketplace add FeidaWang/Reply-Theatre
codex plugin add replay-theater@reply-theatre
```

重新打开 Codex 桌面版。如果你以前已经添加过这个来源，先运行 `codex plugin marketplace upgrade reply-theatre`，再运行第二行安装命令。[从桌面版 ZIP 安装](#install-from-the-desktop-zip--从桌面版-zip-安装)

### 看懂第一条改动

1. 打开 Codex 当时改文件的那个本地聊天。输入 `$replay-theater:replay`，然后说 **「列出这个聊天里 Codex 记录到的文件改动」**。
2. 从编号清单里挑一步。比如说 **「显示第 2 步改了什么」**，或者 **「打开 Replay Theater，我想一步步看」**。
3. 绿色是新增的行，红色是删掉的行。这种改动前后的对照叫 **diff**。面板上的 **Applied** 是已完成的改动，**Review** 是待核对的改动。看到失败的提案时，可以看它原本想改什么，但这一步没有被计为已应用。

还没有改动记录时，可以说 **「打开示例回放，我想练习怎么看改动」**。如果清单少了一项，请打开文件核对。回放取自 Codex 保存的记录，终端命令或其他工具做的改动有时不会出现在清单里。你可以查看和复制改动对照，回放过程只读取改动记录。

### 试试在线演示版

在线演示版只展示固定的四条示例改动。连接后，可以先问 **「列出示例改动」**，再问 **「显示第 2 步改了什么」**。你会看到示例里的 `print("Hello")` 变成了 `print("Hello, replay!")`。[用 Codex 命令行连接](#connect-the-hosted-demo--连接在线演示版)

如果你在 OpenAI Platform 管理插件，可以用演示版 ZIP 创建独立草稿，连接时选 **No authentication**（无需登录）。MCP 地址就是聊天工具访问这些示例功能的入口。[下载在线演示版 ZIP](https://github.com/FeidaWang/Reply-Theatre/raw/refs/heads/main/downloads/replay-theater-demo-openai-0.1.3.zip) · [MCP 地址](https://replay-theater-demo.475035492.workers.dev/mcp)

### Connect the hosted demo / 连接在线演示版

If you have the `codex` command, paste this line into Terminal, then start a new Codex session and ask to list the Replay Theater sample edits.

如果你能运行 `codex` 命令，把下面这行贴进终端，再打开一个新的 Codex 会话，请它列出 Replay Theater 的示例改动。

```sh
codex mcp add replay-theater-demo --url https://replay-theater-demo.475035492.workers.dev/mcp
```

### Install from the desktop ZIP / 从桌面版 ZIP 安装

Download the desktop ZIP. Open Terminal in the download folder and paste the block below. Keep the extracted folder so Codex can find the plugin again.

下载桌面版 ZIP。在下载目录打开终端，贴入下面这段命令。请保留解压后的文件夹，方便 Codex 以后找到插件。[Desktop ZIP / 桌面版 ZIP](https://github.com/FeidaWang/Reply-Theatre/raw/refs/heads/main/downloads/replay-theater-openai-desktop-mcp-0.5.1.zip)

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

Reopen Codex Desktop when installation finishes. 安装完成后，重新打开 Codex 桌面版。

[Help / 帮助](SUPPORT.md) · [Local commands / 本地命令](skills/replay/references/local-use.md) · [MIT License](LICENSE)

Desktop / 桌面版 · [Privacy / 隐私](PRIVACY.md) · [Terms / 条款](TERMS.md)

Hosted demo / 在线演示版 · [Privacy / 隐私](https://replay-theater-demo.475035492.workers.dev/privacy.html) · [Terms / 条款](https://replay-theater-demo.475035492.workers.dev/terms.html)
