---
name: surdej-cloudflare
description: Set up and run a Cloudflare Tunnel to expose the local frontend
---

# Cloudflare Tunnel Setup

This workflow ensures your local `surdej` development environment is securely exposed over HTTPS so that extension clients, mobile devices, and browser proxies can access the local frontend.

## 1. Run the Local Tunnel

We have configured a VS Code task to securely proxy `http://127.0.0.1:4001` to `https://niels-macmini-happy-pdf-refinery.happymates.net`.

To start this via VS Code:
1. Press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
2. Select `Tasks: Run Task`
3. Select `Dev: Cloudflare Tunnel`

Alternatively, you can run the command manually:
// turbo
```bash
cloudflared tunnel run --url http://127.0.0.1:4001 niels-macmini-happy-pdf-refinery
```

Once running, select the "Local Tunnel (Mac Mini)" environment within the Browser Extension's Options page to map the extension to this secure endpoint.
