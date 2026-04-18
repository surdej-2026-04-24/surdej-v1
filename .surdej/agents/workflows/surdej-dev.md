---
name: surdej-dev
description: Run the VS Code task to start both Frontend and Extension servers in parallel
---

## Start Frontend and Extension Servers

This command starts both the Surdej Web Frontend and Browser Extension native servers simultaneously using VS Code's task runner. 

**Run VS Code task:** `Dev: Start Frontend + Extension`
- Press `Cmd+Shift+P` (or `Ctrl+Shift+P` on Windows/Linux)
- Select `Tasks: Run Task`
- Choose `Dev: Start Frontend + Extension`

This leverages the `dependsOn` feature from `.vscode/tasks.json` to safely open two background watchers directly within your editor.
