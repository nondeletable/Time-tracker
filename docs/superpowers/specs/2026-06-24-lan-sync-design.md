# LAN Sync — Design Spec
Date: 2026-06-24

## Overview

Both machines (Sasha's desktop, Maxim's laptop) exchange per-day work totals and the current user's avatar over a local Wi-Fi network every 5 minutes. This feeds the shared monthly limit bar and the calendar view on both machines. Individual sessions and categories are never transmitted.

---

## 1. What Gets Synced

Each machine sends a single payload describing its own user:

```js
{
  type: 'sync',
  user: 'Sasha',          // 'Sasha' | 'Maxim'
  avatar: 'man.png',      // filename from assets/icons/
  days: [
    { day: '2026-06-24', total_seconds: 5400 },
    { day: '2026-06-23', total_seconds: 7200 },
    // ... all days with non-zero sessions
  ]
}
```

- `days` is the full history — not filtered by period. Volume is negligible (≤365 rows/user/year).
- No category breakdown. No individual session data.

---

## 2. Local Storage of Peer Data

New table added to the existing SQLite database:

```sql
CREATE TABLE IF NOT EXISTS peer_data (
  user          TEXT NOT NULL,
  day           TEXT NOT NULL,   -- 'YYYY-MM-DD'
  total_seconds INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL, -- Unix ms timestamp
  PRIMARY KEY (user, day)
);
```

On receiving a sync payload:
1. Delete all existing rows for `payload.user`.
2. Insert new rows from `payload.days`.
3. Write `avatar_<payload.user>` to `settings` table.
4. Save DB to disk.
5. Notify renderer to refresh stats.

This means peer data survives app restarts — the calendar and limit bar show last-known peer data even when the other machine is offline.

---

## 3. Transport Architecture

### Both machines run a WebSocket server

- Port: `43210` (hardcoded, no configuration needed for now).
- Each app starts a `ws` server on startup in the main process (`src/main/sync.js`).
- If the port is already in use (e.g., two instances on one machine), log and skip — sync is optional.

### Peer discovery via UDP broadcast

- Each machine sends a UDP broadcast every 30 seconds to `255.255.255.255:43211`.
- Payload: `{ user: 'Sasha', port: 43210 }` (JSON, UTF-8).
- On receiving a broadcast: record the sender's IP + port. If not already connected to this peer, initiate a WebSocket connection to `ws://<ip>:43210`.

### Connection lifecycle

- On connect: immediately send own sync payload.
- On disconnect: log, attempt reconnect after 30 seconds. Retry indefinitely with 30s interval.
- Multiple connect attempts to the same IP are deduplicated — only one outgoing connection per peer IP.

### Sync timer

- After the initial sync on connect, resend own payload every **5 minutes** via `setInterval`.
- Timer resets on reconnect (no double-fire).

---

## 4. Changes to Existing IPC Handlers

### `db:get-shared-total`

Currently: sums `sessions` for the current period for both users on the local machine.

After change: sums local `sessions` (both users present locally) **plus** `peer_data` for users not present locally, filtered to the current period.

```js
// Pseudocode
// Each machine has only its own user's sessions locally.
// peer_data contains the other user's per-day totals received over sync.
const localTotal = SUM(sessions WHERE started_at >= period_start AND started_at <= period_end)
const peerTotal  = SUM(peer_data WHERE day >= period_start AND day <= period_end)
return localTotal + peerTotal
```

### `db:get-calendar-month`

Currently: queries only `sessions` table.

After change: UNION of local sessions grouped by day + `peer_data` rows, merged by user+day.

```js
// Returns Array<{ user, day, total_seconds }>
// Local rows: sessions grouped by (user, day) for the requested month
// Peer rows: peer_data rows for the requested month (different user, no overlap)
// UNION both result sets — same user never appears in both tables on the same machine
```

### `db:get-user-avatars`

No change needed — avatar sync writes `avatar_Maxim` / `avatar_Sasha` into `settings`, which this handler already reads.

---

## 5. Renderer Notifications

When the main process receives a sync payload and updates the DB, it pushes a notification to the renderer:

```js
win.webContents.send('sync:peer-updated')
```

Renderer listens:

```js
window.api.onPeerUpdated(() => refreshStats())
```

If the calendar modal is open, it also re-renders the current month.

`window.api.onPeerUpdated` is a one-way push (not invoke/handle). Exposed via `contextBridge` using `ipcRenderer.on`.

---

## 6. Sync Status Indicator (minimal)

A small dot in the app header shows connection state:

- Grey dot: no peer connected / offline
- Green dot: peer connected

No tooltip, no error messages — just the dot. Wired to a `sync:status-changed` IPC push from the main process.

---

## 7. Offline Behavior

- App starts with no peer — works fully standalone.
- UDP broadcast runs regardless; when peer comes online, it hears the broadcast, connects, and sync happens automatically.
- `peer_data` table retains last-received data across restarts — stale but better than nothing.
- No "last synced at" display for now (future task).

---

## 8. New File

All sync logic lives in **`src/main/sync.js`** — a new file imported by `src/main/index.js`.

```
src/main/sync.js   — WS server, UDP broadcast/discovery, sync timer, peer management
```

This keeps `index.js` clean. `sync.js` receives `db`, `saveDB`, and `win` as arguments and exports a single `startSync(db, saveDB, win)` function.

---

## 9. Files Changed

| File | Changes |
|---|---|
| `src/main/sync.js` | **New file.** WebSocket server, UDP broadcast + listener, peer connection management, sync timer, DB writes on receive |
| `src/main/index.js` | Add `peer_data` table to schema; call `startSync(db, saveDB, win)` after `setupIPC()`; update `db:get-shared-total` and `db:get-calendar-month` to include peer data |
| `src/preload/index.js` | Expose `onPeerUpdated` and `onSyncStatus` one-way listeners |
| `src/renderer/js/app.js` | Listen to `peer-updated` → `refreshStats()` + re-render calendar if open; listen to `sync-status` → update status dot |
| `src/renderer/index.html` | Add sync status dot to `.app-header` |
| `src/renderer/css/style.css` | Style for sync status dot |

No new npm packages beyond `ws` (already in dependencies per CLAUDE.md) and Node's built-in `dgram` (UDP — no install needed).

---

## 10. Out of Scope

- Syncing categories or limit settings (each machine manages its own).
- Configurable sync interval (noted as future task in PROGRESS.md).
- Encryption or authentication (LAN-only, trusted network).
- More than 2 users.
- Sync history / "last synced at" display.
