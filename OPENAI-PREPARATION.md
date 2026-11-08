# OpenAI desktop MCP preparation

Replay Theater Desktop 0.5.1 follows the Token Weather desktop packaging pattern. The portable ZIP contains the plugin manifest, one local stdio MCP entry, the server and panel resources, the replay skill and a synthetic fixture. The plugin declares Desktop only. No remote endpoint or account binding is needed for the local server.

## Validation

The candidate was installed from the ZIP into an isolated Codex profile. Codex App Server discovered both MCP tools and the UI resource. Direct stdio calls verified synthetic review, selected diffs, private panel data and rejected out-of-scope arguments. A synthetic history engine verified host-bound reading. The panel was exercised in a sandboxed MCP Apps test frame for playback, filtering and host theme changes. The signed-in Codex desktop panel and OpenAI submission portal remain unverified.

## Review

The manifest contains five positive and three negative cases. The first four positive cases use the synthetic fixture. The fifth requires a local chat with a completed native edit. The developer name is Feida Wang. The plugin is free and targets all available countries.

Record the installed desktop build in a local chat for the reviewer. Ask for the synthetic demo’s edit list, then ask for step 2’s diff. Open the synthetic player in the thread panel, step forward and switch to the review filter. Ask to restore a file from the replay and show the tool’s read-only scope. Keep the recording free of real code, chat IDs and private paths. Verify the recording URL before adding it to the manifest.

Before upload, confirm the submitting organization is enabled for local MCP submissions. Publish the updated product, support, privacy and terms pages at their existing listing URLs. The package contains the updated copy. The public URLs previously described the skills-only edition. The target portal still needs to verify the developer, resolve applicable checks and attestations, and import the draft metadata. If a skills-only listing already exists, OpenAI’s documented flow requires the MCP server in the initial package.

[Desktop-only plugins](https://developers.openai.com/plugins/deploy/desktop-only) · [Upload and submit](https://developers.openai.com/plugins/deploy/submission)
