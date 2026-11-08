---
name: replay-demo
description: Explore the built-in Replay Theater sample, list edits, and inspect one numbered diff. Use for requests about the Replay Theater demo.
---

# Replay Theater Demo

The demo contains four synthetic edits. Identify them as sample data when presenting results.

- For an overview, call `list_demo_edits` without arguments. Report the numbered edits with their recorded status and preserve their original numbering.
- For an individual diff, call `get_demo_diff` with a step number from 1 to 4. To identify a step by file name or status, use the list first. Label a failed, unapplied edit as a proposal.
- If asked for a step outside the sample, explain the available range. For requests about personal Codex history or editing files, explain the demo's read-only scope.
