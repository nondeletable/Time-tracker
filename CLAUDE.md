# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desktop time-tracker for 2 users (Саша and Максим) sharing a single Wi-Fi network. Each user tracks their own activity; the monthly work-hour limit (160 h) is shared between both.

### Users & Devices
- Саша — desktop PC, Windows 10
- Максим — laptop, Windows 11
- Both on the same Wi-Fi network

### Core Features
- Work categories (preset + custom) with per-category colors
- Top progress bar: shared monthly limit (160 h), green → turns red when exceeded
- Per-category horizontal progress bars (individual, not shared)
- Big round timer zone with Start/Stop button + category dropdown
- Post-stop dialog: time, category, edit, save (with split-session support)
- Real-time LAN sync: shared limit and category list; time entries stay local
- Future: calendar popup showing daily totals per user

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| UI | Vanilla HTML + JavaScript + CSS |
| Build | No bundler — plain Electron |
| Local storage | SQLite via sql.js (WASM, no native compilation needed) |
| LAN sync | ws (WebSocket, embedded in Electron main process) |
| Packaging | electron-builder |

## Architecture

```
Renderer process  →  Vanilla JS + CSS (UI)
       ↕ IPC (contextBridge)
Main process      →  Electron, sql.js (SQLite), app lifecycle
       ↕
WebSocket server (ws)  →  started by the "host" user
       ↕ Wi-Fi (LAN)
Client Electron app    →  auto-discovers host on LAN
```

### Sync model
- **Shared**: monthly limit (160 h), category list (names, colors)
- **Per-user (local only)**: individual time entries
- **Sync triggers on**: session saved, category changed, limit changed
- **Auto-discovery**: UDP broadcast or mDNS (no manual IP entry)

### IPC pattern
All sql.js access and network calls live in the **main process**. The renderer communicates via `ipcRenderer.invoke` / `ipcMain.handle` (never expose Node APIs directly to the renderer).

## Commands

```bash
npm run dev     # Start app (runs: electron .)
npm run build   # Production build (electron-builder)
```

To run manually: `.\node_modules\electron\dist\electron.exe .`

## Development Approach

**Incremental**: build the smallest working piece first, verify it works, then layer the next feature on top. Current foundation: working stopwatch (Start/Stop with correct accumulated time).

## Progress Tracking

Progress, completed work, and next steps are tracked in `PROGRESS.md`.

**Rule**: at the start of every session, read `PROGRESS.md` and suggest the next step(s) from the "Следующий шаг" and "Отложено" sections. Do not wait for the user to ask.

**Rule**: after completing any significant feature or milestone, ask the user whether to add a new block to `PROGRESS.md` before moving on.
