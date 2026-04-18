# 11 — Chrome Extension

## Overview

**"Peeler-Mate"** — A Chrome Extension (Manifest V3) built with React and Vite, providing companion functionality to the main web platform.

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Build** | Vite + `@crxjs/vite-plugin` |
| **Framework** | React 19 |
| **UI** | Radix UI, Lucide React, Tailwind CSS 3 |
| **Routing** | React Router DOM |
| **Data** | js-yaml, jszip |
| **Packaging** | vite-plugin-zip-pack |
| **Dev** | TypeScript 5.8 |

## Package Info

- Name: `@happy-mates/extension`
- Version: 1.9.4

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development with hot reload |
| `pnpm build` | Production build |
| `pnpm upload-release` | Upload release to distribution |
| `pnpm cli:login` | CLI authentication |
| `pnpm cli:logout` | CLI logout |

## Capabilities

The extension extends the platform's reach into the browser, providing:

- Quick access to platform features from any webpage
- Content capture and annotation
- Integration with the feedback system
- YAML/ZIP data handling

## Distribution

Built as a Chrome extension package (`.zip`) via `vite-plugin-zip-pack`, uploaded to the distribution channel via the `upload-release` script.

---

*Consolidated from: `apps/extension/package.json` (both projects).*
