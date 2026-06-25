# Sync Settings Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить вкладку «Синхронизация» в настройках (выбор интервала + время последней синхронизации) и заменить emoji-кнопку синхронизации в шапке на текстовую.

**Architecture:** Интервал синхронизации хранится в SQLite (`settings.sync_interval_seconds`). `sync.js` экспортирует `setSyncInterval()` и `getLastSyncAt()`; main process читает интервал при старте и вызывает `setSyncInterval`. Renderer управляет вкладкой через три новых IPC-хендлера.

**Tech Stack:** Electron, vanilla JS/HTML/CSS, sql.js (SQLite WASM), ws (WebSocket)

## Global Constraints

- Нет тестового фреймворка — верификация ручная: `npm run dev`
- Стиль шапки: цвет текста `#b0b0d0`, фон кнопки `#1e1e2e`, hover `#2a2a3e`
- Интервалы (секунды): 60, 120, 300, 600, 900, 1200, 1800, 3600; дефолт 300
- Время последней синхронизации не персистируется — сбрасывается при перезапуске
- `id="sync-btn"` на кнопке синхронизации сохраняется (JS ищет по id)

---

## File Map

| Файл | Изменение |
|---|---|
| `src/main/sync.js` | `setSyncInterval()`, `getLastSyncAt()`, запись `lastSyncAt`, событие `sync:synced` |
| `src/main/index.js` | seed `sync_interval_seconds`, 3 новых IPC-хендлера, импорт новых экспортов, вызов `setSyncInterval` при старте |
| `src/preload/index.js` | 4 новых метода в `contextBridge` |
| `src/renderer/index.html` | новая кнопка в шапке + обёртка `.sync-controls`, новая вкладка + панель в настройках |
| `src/renderer/css/style.css` | убрать `.sync-btn`, добавить `.sync-text-btn` и `.sync-controls` |
| `src/renderer/js/app.js` | `loadSyncTab()`, `formatLastSync()`, обработчик `change` на select, подписка на `onSyncDone`, добавление `sync` в таб-хендлер |

---

## Task 1: sync.js — configurable interval + last sync tracking

**Files:**
- Modify: `src/main/sync.js`

**Interfaces:**
- Produces:
  - `setSyncInterval(seconds: number): void` — меняет интервал, перезапускает таймер если активен
  - `getLastSyncAt(): number | null` — возвращает timestamp последней успешной отправки
  - Event `sync:synced` с payload `timestamp: number` через `_win.webContents.send`

- [ ] **Step 1: Заменить константу `SYNC_INTERVAL_MS` на переменную и добавить `lastSyncAt`**

В `src/main/sync.js` заменить строку:
```js
const SYNC_INTERVAL_MS      = 5 * 60 * 1000
```
на:
```js
let syncIntervalMs = 5 * 60 * 1000
let lastSyncAt     = null
```

- [ ] **Step 2: Обновить все вхождения `SYNC_INTERVAL_MS` → `syncIntervalMs`**

В функции `connectToPeer` строка:
```js
syncTimer = setInterval(() => sendSyncPayload(ws), SYNC_INTERVAL_MS)
```
заменить на:
```js
syncTimer = setInterval(() => sendSyncPayload(ws), syncIntervalMs)
```

- [ ] **Step 3: Записывать `lastSyncAt` и отправлять событие в `sendSyncPayload`**

Функция `sendSyncPayload` сейчас:
```js
function sendSyncPayload(ws) {
  if (ws.readyState !== WebSocket.OPEN) return
  const payload = buildPayload()
  if (!payload) return
  ws.send(JSON.stringify(payload))
}
```

Заменить на:
```js
function sendSyncPayload(ws) {
  if (ws.readyState !== WebSocket.OPEN) return
  const payload = buildPayload()
  if (!payload) return
  ws.send(JSON.stringify(payload))
  lastSyncAt = Date.now()
  if (_win && !_win.isDestroyed()) {
    _win.webContents.send('sync:synced', lastSyncAt)
  }
}
```

- [ ] **Step 4: Добавить `setSyncInterval` и `getLastSyncAt`**

Перед строкой `module.exports = { startSync, syncNow }` добавить:
```js
function setSyncInterval(seconds) {
  syncIntervalMs = seconds * 1000
  if (syncTimer && peerSocket && peerSocket.readyState === WebSocket.OPEN) {
    clearInterval(syncTimer)
    syncTimer = setInterval(() => sendSyncPayload(peerSocket), syncIntervalMs)
  }
}

function getLastSyncAt() {
  return lastSyncAt
}
```

- [ ] **Step 5: Обновить экспорт**

```js
module.exports = { startSync, syncNow, setSyncInterval, getLastSyncAt }
```

- [ ] **Step 6: Проверить запуск**

```bash
npm run dev
```

Приложение должно запуститься без ошибок. В консоли при обнаружении peer должна появиться строка `[sync] Connecting to peer ...`.

- [ ] **Step 7: Commit**

```bash
git add src/main/sync.js
git commit -m "feat: configurable sync interval and last-sync tracking in sync.js"
```

---

## Task 2: index.js — IPC handlers + startup init

**Files:**
- Modify: `src/main/index.js`

**Interfaces:**
- Consumes: `setSyncInterval(seconds)`, `getLastSyncAt()` из `./sync`
- Produces IPC-хендлеры:
  - `sync:get-interval` → `number` (секунды)
  - `sync:set-interval(_, seconds: number)` → `void`
  - `sync:get-last-sync` → `number | null`

- [ ] **Step 1: Обновить импорт из sync.js**

Строку:
```js
const { startSync, syncNow } = require('./sync')
```
заменить на:
```js
const { startSync, syncNow, setSyncInterval, getLastSyncAt } = require('./sync')
```

- [ ] **Step 2: Добавить seed для `sync_interval_seconds` в `initDB`**

После строки:
```js
seedSetting('avatar_Maxim', 'user.svg')
```
добавить:
```js
seedSetting('sync_interval_seconds', '300')
```

- [ ] **Step 3: Добавить три IPC-хендлера в `setupIPC`**

После строки `ipcMain.handle('sync:now', () => syncNow())` добавить:
```js
ipcMain.handle('sync:get-interval', () => {
  const stmt = db.prepare("SELECT value FROM settings WHERE key = 'sync_interval_seconds'")
  const val  = stmt.step() ? Number(stmt.getAsObject().value) : 300
  stmt.free()
  return val
})

ipcMain.handle('sync:set-interval', (_, seconds) => {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['sync_interval_seconds', String(seconds)])
  saveDB()
  setSyncInterval(seconds)
})

ipcMain.handle('sync:get-last-sync', () => getLastSyncAt())
```

- [ ] **Step 4: Применить сохранённый интервал при старте**

В `app.whenReady().then(...)` заменить:
```js
startSync(db, saveDB, win)
```
на:
```js
startSync(db, saveDB, win)

const intStmt = db.prepare("SELECT value FROM settings WHERE key = 'sync_interval_seconds'")
if (intStmt.step()) setSyncInterval(Number(intStmt.getAsObject().value))
intStmt.free()
```

- [ ] **Step 5: Проверить запуск**

```bash
npm run dev
```

В DevTools (Ctrl+Shift+I в окне приложения) выполнить в Console:
```js
await window.api.getSyncInterval()
// ожидается: 300
```

(API ещё не добавлен в preload — эта проверка будет на Task 3. Пока достаточно что приложение стартует без ошибок.)

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js
git commit -m "feat: sync_interval_seconds setting and IPC handlers"
```

---

## Task 3: preload — expose new API

**Files:**
- Modify: `src/preload/index.js`

**Interfaces:**
- Consumes IPC: `sync:get-interval`, `sync:set-interval`, `sync:get-last-sync`, event `sync:synced`
- Produces `window.api`:
  - `getSyncInterval(): Promise<number>`
  - `setSyncInterval(seconds: number): Promise<void>`
  - `getLastSync(): Promise<number | null>`
  - `onSyncDone(cb: (ts: number) => void): void`

- [ ] **Step 1: Добавить четыре метода в contextBridge**

В `src/preload/index.js` добавить после строки `onSyncStatus: ...`:
```js
getSyncInterval:  ()        => ipcRenderer.invoke('sync:get-interval'),
setSyncInterval:  (seconds) => ipcRenderer.invoke('sync:set-interval', seconds),
getLastSync:      ()        => ipcRenderer.invoke('sync:get-last-sync'),
onSyncDone:       (cb)      => ipcRenderer.on('sync:synced', (_, ts) => cb(ts)),
```

- [ ] **Step 2: Проверить API в консоли**

```bash
npm run dev
```

В DevTools Console:
```js
await window.api.getSyncInterval()
// ожидается: 300

await window.api.getLastSync()
// ожидается: null (синхронизации ещё не было)
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.js
git commit -m "feat: expose sync interval and last-sync API in preload"
```

---

## Task 4: HTML + CSS — new sync button and sync settings pane

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/css/style.css`

**Interfaces:**
- Produces элементы DOM:
  - `#sync-btn` — текстовая кнопка `Синхронизация` (класс `sync-text-btn`)
  - `#sync-dot` — индикатор соединения (без изменений)
  - `.sync-controls` — flex-обёртка для dot + button
  - `[data-tab="sync"]` — кнопка вкладки в `<nav>`
  - `#pane-sync` — панель с `#sync-interval-select` и `#sync-last-time`

- [ ] **Step 1: Заменить кнопку синхронизации в шапке**

В `src/renderer/index.html` найти:
```html
        <button class="sync-btn" id="sync-btn" title="Синхронизировать сейчас">⟳</button>
        <div class="sync-dot" id="sync-dot" title="Синхронизация"></div>
```
Заменить на:
```html
        <div class="sync-controls">
          <div class="sync-dot" id="sync-dot" title="Синхронизация"></div>
          <button class="sync-text-btn" id="sync-btn">Синхронизация</button>
        </div>
```

- [ ] **Step 2: Добавить вкладку «Синхронизация» в nav настроек**

Найти:
```html
        <button class="settings-tab" data-tab="hours">Правка часов</button>
```
После неё добавить:
```html
        <button class="settings-tab" data-tab="sync">Синхронизация</button>
```

- [ ] **Step 3: Добавить панель `#pane-sync`**

Найти закрывающий тег панели `pane-hours`:
```html
        </div>
      </div>
    </div>
  </div>
```
(это конец `.settings-pane#pane-hours`, затем `.settings-body`, `.settings-modal`, `#settings-modal`)

Перед закрывающим `</div>` блока `.settings-body` (после всех существующих `settings-pane`) добавить:
```html
        <div class="settings-pane hidden" id="pane-sync">
          <div class="settings-row">
            <span class="settings-row-label">Интервал</span>
            <select class="settings-input" id="sync-interval-select">
              <option value="60">1 мин</option>
              <option value="120">2 мин</option>
              <option value="300">5 мин</option>
              <option value="600">10 мин</option>
              <option value="900">15 мин</option>
              <option value="1200">20 мин</option>
              <option value="1800">30 мин</option>
              <option value="3600">60 мин</option>
            </select>
          </div>
          <div class="settings-row">
            <span class="settings-row-label">Последняя синхронизация</span>
            <span class="settings-row-value" id="sync-last-time">—</span>
          </div>
        </div>
```

- [ ] **Step 4: Убрать старые стили `.sync-btn` в CSS**

В `src/renderer/css/style.css` найти и удалить весь блок:
```css
.sync-btn {
  margin-left: auto;
  background: none;
  border: none;
  ...
  transition: color 0.2s;
}

.sync-btn:hover {
  color: #e0e0ff;
}
```

- [ ] **Step 5: Добавить стили для `.sync-controls` и `.sync-text-btn`**

На место удалённых стилей (перед `.sync-dot`) добавить:
```css
.sync-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.sync-text-btn {
  background: #1e1e2e;
  border: 1px solid #2e2e4e;
  border-radius: 6px;
  color: #b0b0d0;
  font-size: 13px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.sync-text-btn:hover,
.sync-text-btn:active {
  background: #2a2a3e;
}
```

- [ ] **Step 6: Проверить визуально**

```bash
npm run dev
```

Проверить:
- В шапке вместо `⟳` — кнопка «Синхронизация» с тёмным фоном
- Dot слева от кнопки с зазором ~6px
- Hover на кнопке — фон становится светлее
- В настройках — пятая вкладка «Синхронизация» (пока без логики)
- Клик по вкладке «Синхронизация» — открывается пустая панель с select и строкой времени

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.html src/renderer/css/style.css
git commit -m "feat: replace sync emoji button with text button, add sync settings pane"
```

---

## Task 5: app.js — renderer logic for sync tab

**Files:**
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Consumes: `window.api.getSyncInterval()`, `window.api.setSyncInterval(s)`, `window.api.getLastSync()`, `window.api.onSyncDone(cb)`
- Consumes DOM: `#sync-interval-select`, `#sync-last-time`

- [ ] **Step 1: Добавить функцию `formatLastSync`**

В `src/renderer/js/app.js` найти функцию `secsToHHMM` (строка ~547) и перед ней добавить:
```js
function formatLastSync(ts) {
  if (!ts) return '—'
  const d   = new Date(ts)
  const now = new Date()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  if (d.toDateString() === now.toDateString()) {
    return `Сегодня в ${hh}:${mm}`
  }
  const dd   = String(d.getDate()).padStart(2, '0')
  const mo   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mo}.${yyyy} ${hh}:${mm}`
}
```

- [ ] **Step 2: Добавить функцию `loadSyncTab`**

После функции `formatLastSync` добавить:
```js
async function loadSyncTab() {
  const seconds = await window.api.getSyncInterval()
  document.getElementById('sync-interval-select').value = String(seconds || 300)
  const ts = await window.api.getLastSync()
  document.getElementById('sync-last-time').textContent = formatLastSync(ts)
}
```

- [ ] **Step 3: Добавить обработчик `change` на select интервала**

Найти строку:
```js
syncBtn.addEventListener('click', () => window.api.syncNow())
```
После неё добавить:
```js
document.getElementById('sync-interval-select').addEventListener('change', async (e) => {
  await window.api.setSyncInterval(Number(e.target.value))
})
```

- [ ] **Step 4: Подписаться на событие `sync:synced`**

После предыдущего блока добавить:
```js
window.api.onSyncDone(ts => {
  const el = document.getElementById('sync-last-time')
  if (el) el.textContent = formatLastSync(ts)
})
```

- [ ] **Step 5: Добавить `sync` в обработчик переключения вкладок**

Найти блок:
```js
    if (tab.dataset.tab === 'limit') loadLimitTab()
    if (tab.dataset.tab === 'user') loadUserTab()
    if (tab.dataset.tab === 'categories') loadCategoriesTab()
    if (tab.dataset.tab === 'hours') loadHoursTab()
```
Добавить строку после `loadHoursTab()`:
```js
    if (tab.dataset.tab === 'sync') loadSyncTab()
```

- [ ] **Step 6: Проверить полный сценарий**

```bash
npm run dev
```

Открыть Настройки → вкладка «Синхронизация»:
- Select показывает «5 мин» (дефолт 300 сек)
- Строка «Последняя синхронизация» показывает `—`
- Изменить select на «1 мин» → закрыть настройки → снова открыть «Синхронизация» → select должен показывать «1 мин»
- Кнопка «Синхронизация» в шапке → вызывает ручную синхронизацию (если peer доступен, строка «Последняя синхронизация» обновляется)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/js/app.js
git commit -m "feat: sync settings tab — interval selector and last sync display"
```
