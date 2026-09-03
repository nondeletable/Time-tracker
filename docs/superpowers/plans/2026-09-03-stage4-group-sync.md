# Этап 4 — Группа + защищённый синк (+ синк лимита) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю создать/присоединиться к группе-паре, синхронизировать часы и лимит/период (owner→member) по LAN с проверкой кода в handshake, при этом соло-режим остаётся офлайн.

**Architecture:** Чистая логика группы — в `src/main/group.js` (UMD, node:test). DB-запись данных напарника с self-guard по стабильному `install_id` — в `src/main/peer.js`. Протокол (handshake, payload, apply-limit, start/stop) — в `src/main/sync.js`. Управление группой — IPC `group:create/join/leave` в `index.js`. UI — два состояния вкладки «Синхронизация».

**Tech Stack:** Electron main (Node), sql.js, ws, dgram, vanilla JS renderer, i18n через `data-i18n`.

## Global Constraints

- Рендерер — плоский `<script>` без сборщика; общий код — только через UMD-обёртку (тот же файл работает и в node-тестах). Значения копировать дословно.
- Чистая логика → тесты `node --test` (`npm test`); сеть/UI → ручная проверка `npm run dev`.
- Порты синка — константы `WS_PORT = 43210`, `UDP_PORT = 43211`. В UI не выносятся.
- Алфавит кода: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, длина 6.
- Все новые UI-строки — ключи и в `ru`, и в `en` (тест паритета ключей в `test/i18n.test.js` обязан оставаться зелёным).
- Роль grouped = `group_role ∈ {owner, member}` И непустой `group_code`.
- Команда тестов (PowerShell): `npm test`.
- Роль/код в рендерере читаются существующим `window.api.getSetting(key)` — отдельный IPC `group:get-state` не вводим.

---

### Task 1: Чистый модуль группы `group.js`

**Files:**
- Create: `src/main/group.js`
- Test: `test/group.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `generateCode(rng?) → string` (6 символов из алфавита; `rng` по умолчанию `Math.random`)
  - `normalizeCode(s) → string` (`trim().toUpperCase()`, null-safe)
  - `validateHandshake(localCode, msg) → boolean` (`msg.code` непустой и `=== localCode`)
  - `isSelf(payload, myInstallId) → boolean` (`payload.installId === myInstallId`)
  - `shouldApplyLimit(receiverRole, senderRole) → boolean` (`receiver==='member' && sender==='owner'`)
  - экспорт-константы `ALPHABET`, `CODE_LEN`

- [ ] **Step 1: Написать падающий тест** — `test/group.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')

const {
  ALPHABET, CODE_LEN, generateCode, normalizeCode,
  validateHandshake, isSelf, shouldApplyLimit,
} = require('../src/main/group')

test('generateCode: длина CODE_LEN, только символы из ALPHABET', () => {
  // Детерминированный rng: прогоняем по всем индексам алфавита
  let i = 0
  const rng = () => (i++ % ALPHABET.length) / ALPHABET.length
  const code = generateCode(rng)
  assert.equal(code.length, CODE_LEN)
  assert.ok([...code].every(ch => ALPHABET.includes(ch)))
})

test('generateCode: rng=0 → первый символ алфавита повторён', () => {
  assert.equal(generateCode(() => 0), ALPHABET[0].repeat(CODE_LEN))
})

test('generateCode: без похожих символов (0,O,1,I,L)', () => {
  assert.ok(!/[01OIL]/.test(ALPHABET))
})

test('normalizeCode: trim + upper, null-safe', () => {
  assert.equal(normalizeCode('  ab2c  '), 'AB2C')
  assert.equal(normalizeCode(null), '')
  assert.equal(normalizeCode(undefined), '')
})

test('validateHandshake: совпадение/несовпадение/пустой', () => {
  assert.equal(validateHandshake('ABC234', { code: 'ABC234' }), true)
  assert.equal(validateHandshake('ABC234', { code: 'XXX999' }), false)
  assert.equal(validateHandshake('ABC234', { code: '' }), false)
  assert.equal(validateHandshake('', { code: '' }), false)
  assert.equal(validateHandshake('ABC234', null), false)
})

test('isSelf: по install_id', () => {
  assert.equal(isSelf({ installId: 'me' }, 'me'), true)
  assert.equal(isSelf({ installId: 'other' }, 'me'), false)
  assert.equal(isSelf({}, 'me'), false)
})

test('shouldApplyLimit: только member принимает от owner', () => {
  assert.equal(shouldApplyLimit('member', 'owner'), true)
  assert.equal(shouldApplyLimit('member', 'member'), false)
  assert.equal(shouldApplyLimit('owner', 'owner'), false)
  assert.equal(shouldApplyLimit('solo', 'owner'), false)
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/main/group'`.

- [ ] **Step 3: Реализовать `src/main/group.js`:**

```js
// Чистая логика группы — без DOM/сети. UMD: node (require) + браузер (window.GROUP).
(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.GROUP = api
})(typeof self !== 'undefined' ? self : this, function () {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const CODE_LEN = 6

  function generateCode(rng) {
    const rand = rng || Math.random
    let out = ''
    for (let i = 0; i < CODE_LEN; i++) {
      out += ALPHABET[Math.floor(rand() * ALPHABET.length)]
    }
    return out
  }

  function normalizeCode(s) {
    return String(s == null ? '' : s).trim().toUpperCase()
  }

  function validateHandshake(localCode, msg) {
    return !!(msg && msg.code && localCode && msg.code === localCode)
  }

  function isSelf(payload, myInstallId) {
    return !!(payload && myInstallId && payload.installId === myInstallId)
  }

  function shouldApplyLimit(receiverRole, senderRole) {
    return receiverRole === 'member' && senderRole === 'owner'
  }

  return { ALPHABET, CODE_LEN, generateCode, normalizeCode, validateHandshake, isSelf, shouldApplyLimit }
})
```

- [ ] **Step 4: Прогнать — убедиться, что проходит**

Run: `npm test`
Expected: PASS (все `group.test.js` зелёные, прежние тесты не тронуты).

- [ ] **Step 5: Commit**

```bash
git add src/main/group.js test/group.test.js
git commit -m "feat(group): pure group logic (code/handshake/roles) + tests"
```

---

### Task 2: Запись данных напарника с self-guard по install_id (`peer.js`)

**Files:**
- Modify: `src/main/peer.js`
- Test: `test/peer.test.js`

**Interfaces:**
- Consumes: `isSelf` из `./group` (Task 1).
- Produces: `storePeerAggregates(db, payload, myInstallId) → boolean` — пишет `peer_data` (ключ по имени) и аватар напарника; возвращает `false` (без записи), если `isSelf` или нет `user`/`days`. `Date.now()` для `updated_at` (main-процесс — доступен).

- [ ] **Step 1: Добавить падающие тесты в `test/peer.test.js`** (в конец файла; и расширить `makeDb`, чтобы была таблица `settings` для аватара):

```js
const { storePeerAggregates } = require('../src/main/peer')

async function makeDbWithSettings() {
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(`CREATE TABLE peer_data (
    user TEXT NOT NULL, day TEXT NOT NULL, total_seconds INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, PRIMARY KEY (user, day))`)
  db.run('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)')
  return db
}

test('storePeerAggregates: свой install_id не пишется даже при совпадении имени', async () => {
  const db = await makeDbWithSettings()
  const stored = storePeerAggregates(
    db,
    { user: 'Alex', installId: 'me', avatar: 'a.svg', days: [{ day: '2026-09-01', total_seconds: 100 }] },
    'me'
  )
  assert.equal(stored, false)
  const total = db.exec('SELECT COUNT(*) FROM peer_data')[0].values[0][0]
  assert.equal(total, 0)
})

test('storePeerAggregates: чужой install_id пишется (дни + аватар)', async () => {
  const db = await makeDbWithSettings()
  const stored = storePeerAggregates(
    db,
    { user: 'Alex', installId: 'other', avatar: 'a.svg', days: [{ day: '2026-09-01', total_seconds: 100 }] },
    'me'
  )
  assert.equal(stored, true)
  assert.equal(db.exec("SELECT total_seconds FROM peer_data WHERE user='Alex'")[0].values[0][0], 100)
  assert.equal(db.exec("SELECT value FROM settings WHERE key='avatar_Alex'")[0].values[0][0], 'a.svg')
})

test('storePeerAggregates: перезапись — старые дни удаляются', async () => {
  const db = await makeDbWithSettings()
  storePeerAggregates(db, { user: 'Alex', installId: 'other', days: [{ day: '2026-09-01', total_seconds: 100 }] }, 'me')
  storePeerAggregates(db, { user: 'Alex', installId: 'other', days: [{ day: '2026-09-02', total_seconds: 50 }] }, 'me')
  const days = db.exec("SELECT day FROM peer_data WHERE user='Alex' ORDER BY day")[0].values.map(r => r[0])
  assert.deepEqual(days, ['2026-09-02'])
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `storePeerAggregates is not a function`.

- [ ] **Step 3: Реализовать в `src/main/peer.js`** — добавить `require` и функцию, дополнить экспорт:

```js
// (в начало файла, после комментария-инварианта)
const { isSelf } = require('./group')
```

```js
// (перед module.exports)
// Записывает суточные агрегаты напарника в peer_data (ключ по имени) + его аватар.
// Возвращает true, если данные записаны. Свои данные (по install_id) игнорируются —
// это корневая защита от задвоения (см. spec Этапа 4).
function storePeerAggregates(db, payload, myInstallId) {
  if (!payload || !Array.isArray(payload.days)) return false
  if (isSelf(payload, myInstallId)) return false
  const user = payload.user
  if (!user) return false

  db.run('DELETE FROM peer_data WHERE user = ?', [user])
  const now = Date.now()
  payload.days.forEach(d => {
    if (d.day && d.total_seconds != null) {
      db.run(
        'INSERT INTO peer_data (user, day, total_seconds, updated_at) VALUES (?, ?, ?, ?)',
        [user, d.day, d.total_seconds, now]
      )
    }
  })
  if (payload.avatar) {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`avatar_${user}`, payload.avatar])
  }
  return true
}
```

```js
// (заменить строку экспорта)
module.exports = { purgeSelfFromPeerData, storePeerAggregates }
```

- [ ] **Step 4: Прогнать — убедиться, что проходит**

Run: `npm test`
Expected: PASS (новые + прежние peer-тесты зелёные).

- [ ] **Step 5: Commit**

```bash
git add src/main/peer.js test/peer.test.js
git commit -m "feat(peer): storePeerAggregates with install_id self-guard + tests"
```

---

### Task 3: Протокол синка — handshake, payload, apply-limit, start/stop (`sync.js`)

**Files:**
- Modify (полная замена содержимого): `src/main/sync.js`

**Interfaces:**
- Consumes: `validateHandshake`, `isSelf`, `shouldApplyLimit` (Task 1); `storePeerAggregates` (Task 2). Читает из `settings`: `install_id`, `group_role`, `group_code`, `user_name`, `avatar_<user>`, `monthly_limit_seconds`, `period_start`, `period_end`.
- Produces: `startSync(db, saveDB, win)` (идемпотентный), `stopSync()`, `syncNow()`, `setSyncInterval(seconds)`, `getLastSyncAt()`. События в renderer: `sync:status-changed`, `sync:synced`, `sync:peer-updated`, `sync:limit-updated`.

- [ ] **Step 1: Заменить `src/main/sync.js` целиком:**

```js
const WebSocket = require('ws')
const dgram     = require('dgram')
const { validateHandshake, isSelf, shouldApplyLimit } = require('./group')
const { storePeerAggregates } = require('./peer')

const WS_PORT  = 43210
const UDP_PORT = 43211
let syncIntervalMs = 5 * 60 * 1000
let lastSyncAt     = null
const BROADCAST_INTERVAL_MS = 30 * 1000
const RECONNECT_DELAY_MS    = 30 * 1000
const INSTANCE_ID = Math.random().toString(36).slice(2)

let _db     = null
let _saveDB = null
let _win    = null

let started        = false
let _wss           = null
let _udp           = null
let _broadcastTimer = null
let peerSocket     = null
let peerIP         = null
let peerPort       = WS_PORT
let syncTimer      = null
let reconnectTimer = null
let serverClients  = new Set()

// ── Локальные настройки ────────────────────────────────────────────────────

function readLocal(key) {
  const stmt = _db.prepare('SELECT value FROM settings WHERE key = ?')
  stmt.bind([key])
  const v = stmt.step() ? stmt.getAsObject().value : null
  stmt.free()
  return v
}
const myInstallId = () => readLocal('install_id')
const myRole      = () => readLocal('group_role') || 'solo'
const myCode      = () => readLocal('group_code') || ''

// ── Жизненный цикл ──────────────────────────────────────────────────────────

function startSync(db, saveDB, win) {
  _db = db; _saveDB = saveDB; _win = win
  if (started) return
  started = true
  startWSServer()
  startUDP()
}

function stopSync() {
  started = false
  if (_wss)            { try { _wss.close() } catch (_) {} _wss = null }
  if (_udp)            { try { _udp.close() } catch (_) {} _udp = null }
  if (peerSocket)      { try { peerSocket.close() } catch (_) {} peerSocket = null }
  if (syncTimer)       { clearInterval(syncTimer); syncTimer = null }
  if (reconnectTimer)  { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (_broadcastTimer) { clearInterval(_broadcastTimer); _broadcastTimer = null }
  serverClients.clear()
  notifyStatus(false)
}

// ── WebSocket-сервер (входящие соединения) ─────────────────────────────────

function sendHello(ws) {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'hello', installId: myInstallId(), code: myCode() }))
}

function startWSServer() {
  try {
    _wss = new WebSocket.Server({ port: WS_PORT })
    console.log(`[sync] WS server listening on port ${WS_PORT}`)
    _wss.on('connection', ws => {
      ws._verified = false
      ws.on('message', data => {
        let msg
        try { msg = JSON.parse(data) } catch (_) { return }
        if (msg.type === 'hello') {
          if (!validateHandshake(myCode(), msg)) { ws.close(); return }
          ws._verified = true
          serverClients.add(ws)
          notifyStatus(true)
          sendHello(ws)
          sendSyncPayload(ws)
          return
        }
        if (msg.type === 'sync' && ws._verified) receiveSync(msg)
      })
      ws.on('close', () => {
        serverClients.delete(ws)
        if (serverClients.size === 0 && (!peerSocket || peerSocket.readyState !== WebSocket.OPEN)) {
          notifyStatus(false)
        }
      })
      ws.on('error', () => {})
    })
    _wss.on('error', err => console.log('[sync] WS server error:', err.message))
  } catch (err) {
    console.log('[sync] WS server failed to start:', err.message)
  }
}

// ── UDP-broadcast (discovery, без кода) ────────────────────────────────────

function startUDP() {
  _udp = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  _udp.bind(UDP_PORT, () => {
    _udp.setBroadcast(true)
    const sendBroadcast = () => {
      const msg = Buffer.from(JSON.stringify({ instanceId: INSTANCE_ID, port: WS_PORT }))
      _udp.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255', () => {})
    }
    sendBroadcast()
    _broadcastTimer = setInterval(sendBroadcast, BROADCAST_INTERVAL_MS)

    _udp.on('message', (buf, rinfo) => {
      try {
        const data = JSON.parse(buf.toString())
        if (data.instanceId === INSTANCE_ID) return
        connectToPeer(rinfo.address, data.port || WS_PORT)
      } catch (_) {}
    })
    _udp.on('error', err => console.log('[sync] UDP error:', err.message))
  })
}

// ── WebSocket-клиент (исходящее соединение) ────────────────────────────────

function connectToPeer(ip, port) {
  if (!started) return
  if (peerSocket && (
    peerSocket.readyState === WebSocket.OPEN ||
    peerSocket.readyState === WebSocket.CONNECTING
  )) return

  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  peerIP = ip; peerPort = port

  const ws = new WebSocket(`ws://${ip}:${port}`)

  ws.on('open', () => {
    peerSocket = ws
    ws._verified = false
    sendHello(ws)                       // handshake первым
    if (syncTimer) clearInterval(syncTimer)
    syncTimer = setInterval(() => { if (ws._verified) sendSyncPayload(ws) }, syncIntervalMs)
  })

  ws.on('message', data => {
    let msg
    try { msg = JSON.parse(data) } catch (_) { return }
    if (msg.type === 'hello') {
      if (!validateHandshake(myCode(), msg)) { ws.close(); return }
      ws._verified = true
      notifyStatus(true)
      sendSyncPayload(ws)
      return
    }
    if (msg.type === 'sync' && ws._verified) receiveSync(msg)
  })

  ws.on('close', () => {
    peerSocket = null
    notifyStatus(false)
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
    if (started) reconnectTimer = setTimeout(() => connectToPeer(peerIP, peerPort), RECONNECT_DELAY_MS)
  })

  ws.on('error', () => {})
}

// ── Payload ────────────────────────────────────────────────────────────────

function buildPayload() {
  const user = readLocal('user_name')
  if (!user) return null
  const avatar = readLocal(`avatar_${user}`) || 'user.svg'

  const daysStmt = _db.prepare(`
    SELECT
      date(s.started_at / 1000, 'unixepoch', 'localtime') AS day,
      SUM(s.duration_seconds) AS total_seconds
    FROM sessions s
    JOIN categories c ON s.category_id = c.id
    WHERE s.user = ? AND c.deleted = 0
    GROUP BY day
  `)
  daysStmt.bind([user])
  const days = []
  while (daysStmt.step()) days.push(daysStmt.getAsObject())
  daysStmt.free()

  const role = myRole()
  const payload = { type: 'sync', installId: myInstallId(), role, user, avatar, days }
  if (role === 'owner') {
    payload.limit  = Number(readLocal('monthly_limit_seconds')) || 0
    payload.period = { start: readLocal('period_start'), end: readLocal('period_end') }
  }
  return payload
}

function sendSyncPayload(ws) {
  if (ws.readyState !== WebSocket.OPEN) return
  const payload = buildPayload()
  if (!payload) return
  ws.send(JSON.stringify(payload))
  lastSyncAt = Date.now()
  if (_win && !_win.isDestroyed()) _win.webContents.send('sync:synced', lastSyncAt)
}

// ── Приём данных ────────────────────────────────────────────────────────────

function receiveSync(payload) {
  if (isSelf(payload, myInstallId())) return

  const stored = storePeerAggregates(_db, payload, myInstallId())

  let limitApplied = false
  if (shouldApplyLimit(myRole(), payload.role) && payload.limit) {
    _db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('monthly_limit_seconds', ?)", [String(payload.limit)])
    if (payload.period && payload.period.start && payload.period.end) {
      _db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('period_start', ?)", [payload.period.start])
      _db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('period_end', ?)", [payload.period.end])
    }
    limitApplied = true
  }

  if (stored || limitApplied) _saveDB()
  if (stored && _win && !_win.isDestroyed())       _win.webContents.send('sync:peer-updated')
  if (limitApplied && _win && !_win.isDestroyed()) _win.webContents.send('sync:limit-updated')
}

// ── Статус / ручной синк / интервал ─────────────────────────────────────────

function notifyStatus(connected) {
  if (_win && !_win.isDestroyed()) _win.webContents.send('sync:status-changed', connected)
}

function syncNow() {
  if (peerSocket && peerSocket.readyState === WebSocket.OPEN && peerSocket._verified) {
    sendSyncPayload(peerSocket)
  }
  serverClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN && ws._verified) sendSyncPayload(ws)
  })
}

function setSyncInterval(seconds) {
  syncIntervalMs = seconds * 1000
  if (syncTimer && peerSocket && peerSocket.readyState === WebSocket.OPEN) {
    clearInterval(syncTimer)
    syncTimer = setInterval(() => { if (peerSocket && peerSocket._verified) sendSyncPayload(peerSocket) }, syncIntervalMs)
  }
}

function getLastSyncAt() { return lastSyncAt }

module.exports = { startSync, stopSync, syncNow, setSyncInterval, getLastSyncAt }
```

- [ ] **Step 2: Прогнать тесты — регрессий нет**

Run: `npm test`
Expected: PASS (sync.js не покрыт unit-тестами; главное — прежние тесты и Task 1/2 зелёные, `require('./sync')` не падает при загрузке).

- [ ] **Step 3: Sanity-загрузка модуля** (проверить, что файл валиден и экспорт на месте):

Run: `node -e "console.log(Object.keys(require('./src/main/sync')))"`
Expected: печатает `[ 'startSync', 'stopSync', 'syncNow', 'setSyncInterval', 'getLastSyncAt' ]`.

- [ ] **Step 4: Commit**

```bash
git add src/main/sync.js
git commit -m "feat(sync): code handshake, install_id guard, owner limit sync, start/stop"
```

---

### Task 4: install_id, IPC группы, gated boot (`index.js` + preload)

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/preload/index.js`

**Interfaces:**
- Consumes: `generateCode`, `normalizeCode` (Task 1); `startSync`, `stopSync`, `setSyncInterval` (Task 3).
- Produces: IPC `group:create → {role,code}`, `group:join(code) → {role,code}`, `group:leave → {role,code}`; preload-методы `createGroup()`, `joinGroup(code)`, `leaveGroup()`, `onSyncLimitUpdated(cb)`. Настройка `install_id` засеяна.

- [ ] **Step 1: `src/main/index.js` — импорты.** Заменить строку require sync и добавить group/crypto:

Найти:
```js
const { startSync, syncNow, setSyncInterval, getLastSyncAt } = require('./sync')
```
Заменить на:
```js
const { startSync, stopSync, syncNow, setSyncInterval, getLastSyncAt } = require('./sync')
const { generateCode, normalizeCode } = require('./group')
const crypto = require('crypto')
```

- [ ] **Step 2: Сид `install_id`.** После строки `seedSetting('group_role', 'solo')` добавить:

```js
  seedSetting('install_id',            crypto.randomUUID())
```

- [ ] **Step 3: Модульная ссылка на окно.** Найти в `app.whenReady`:
```js
  const win = createWindow()
```
Заменить на:
```js
  mainWin = createWindow()
  const win = mainWin
```
И объявить рядом с другими модульными переменными (там же, где `let db`), добавить:
```js
let mainWin = null
```

- [ ] **Step 4: Gated boot.** Заменить закомментированный блок авто-синка в `app.whenReady`:

Найти:
```js
  // Авто-синк отключён: соло-режим = без сети. Синк вернётся в Этапе 4 как opt-in
  // (запуск только при активной группе, со стабильным per-install ID отправителя).
  // startSync(db, saveDB, win)
  // const intStmt = db.prepare("SELECT value FROM settings WHERE key = 'sync_interval_seconds'")
  // if (intStmt.step()) setSyncInterval(Number(intStmt.getAsObject().value))
  // intStmt.free()
```
Заменить на:
```js
  // Синк — opt-in: стартует только при активной группе (owner/member + код).
  {
    const roleStmt = db.prepare("SELECT value FROM settings WHERE key = 'group_role'")
    const bootRole = roleStmt.step() ? roleStmt.getAsObject().value : 'solo'
    roleStmt.free()
    const codeStmt = db.prepare("SELECT value FROM settings WHERE key = 'group_code'")
    const bootCode = codeStmt.step() ? codeStmt.getAsObject().value : ''
    codeStmt.free()
    if ((bootRole === 'owner' || bootRole === 'member') && bootCode) {
      startSync(db, saveDB, win)
      const intStmt = db.prepare("SELECT value FROM settings WHERE key = 'sync_interval_seconds'")
      if (intStmt.step()) setSyncInterval(Number(intStmt.getAsObject().value))
      intStmt.free()
    }
  }
```

- [ ] **Step 5: IPC группы.** В теле `setupIPC()` (например, сразу после хендлера `sync:set-interval`) добавить:

```js
  ipcMain.handle('group:create', () => {
    const code = generateCode()
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('group_role', 'owner')")
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('group_code', ?)", [code])
    saveDB()
    startSync(db, saveDB, mainWin)
    return { role: 'owner', code }
  })

  ipcMain.handle('group:join', (_, rawCode) => {
    const code = normalizeCode(rawCode)
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('group_role', 'member')")
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('group_code', ?)", [code])
    saveDB()
    startSync(db, saveDB, mainWin)
    return { role: 'member', code }
  })

  ipcMain.handle('group:leave', () => {
    stopSync()
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('group_role', 'solo')")
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('group_code', '')")
    db.run('DELETE FROM peer_data')
    saveDB()
    return { role: 'solo', code: '' }
  })
```

- [ ] **Step 6: preload — новые методы.** В `src/preload/index.js`, внутри объекта `api`, добавить (например, после `restoreCategory`):

```js
  createGroup:        ()      => ipcRenderer.invoke('group:create'),
  joinGroup:          (code)  => ipcRenderer.invoke('group:join', code),
  leaveGroup:         ()      => ipcRenderer.invoke('group:leave'),
  onSyncLimitUpdated: (cb)    => ipcRenderer.on('sync:limit-updated', cb),
```

- [ ] **Step 7: Прогнать тесты — регрессий нет**

Run: `npm test`
Expected: PASS (все прежние тесты зелёные; main не покрыт unit-тестами).

- [ ] **Step 8: Commit**

```bash
git add src/main/index.js src/preload/index.js
git commit -m "feat(group): install_id seed + create/join/leave IPC + gated boot sync"
```

---

### Task 5: i18n-ключи для UI группы (`dict.js`)

**Files:**
- Modify: `src/renderer/js/i18n/dict.js`

**Interfaces:**
- Produces: ключи `group_create`, `group_join`, `group_join_placeholder`, `group_leave`, `group_role_label`, `group_code_label`, `group_role_solo`, `group_role_owner`, `group_role_member` — в обоих словарях.

- [ ] **Step 1: Добавить ключи в `ru`.** После строки `sync_last: 'Последняя синхронизация',` вставить:

```js
    group_create: 'Создать группу',
    group_join: 'Присоединиться',
    group_join_placeholder: 'Код',
    group_leave: 'Покинуть группу',
    group_role_label: 'Роль',
    group_code_label: 'Код группы',
    group_role_solo: 'Соло',
    group_role_owner: 'Владелец',
    group_role_member: 'Участник',
```

- [ ] **Step 2: Добавить ключи в `en`.** После строки `sync_last: 'Last sync',` вставить:

```js
    group_create: 'Create group',
    group_join: 'Join',
    group_join_placeholder: 'Code',
    group_leave: 'Leave group',
    group_role_label: 'Role',
    group_code_label: 'Group code',
    group_role_solo: 'Solo',
    group_role_owner: 'Owner',
    group_role_member: 'Member',
```

- [ ] **Step 3: Прогнать тесты — паритет ключей ru/en зелёный**

Run: `npm test`
Expected: PASS (тест паритета словарей в `test/i18n.test.js` проходит — ключи добавлены в оба).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/js/i18n/dict.js
git commit -m "feat(i18n): group UI strings (ru/en)"
```

---

### Task 6: UI вкладки «Синхронизация» — два состояния (`index.html` + `app.js`)

**Files:**
- Modify: `src/renderer/index.html:190-208` (блок `#pane-sync`)
- Modify: `src/renderer/js/app.js` (`loadSyncTab` + обработчики в секции `// ── Sync`)

**Interfaces:**
- Consumes: `window.api.getSetting`, `createGroup`, `joinGroup`, `leaveGroup`, `getSyncInterval`, `getLastSync`, `onSyncLimitUpdated` (Task 4); `window.ROLES.isGrouped` (Этап 3); `t()`, `refreshStats()`, `loadLimitTab()`, `formatLastSync()`, `settingsModal` (существуют).
- Produces: рабочий UI Create/Join/Leave.

- [ ] **Step 1: Заменить содержимое `#pane-sync`** в `src/renderer/index.html`.

Найти блок:
```html
        <div class="settings-pane hidden" id="pane-sync">
          <div class="settings-row">
            <span class="settings-row-label" data-i18n="sync_interval">Интервал</span>
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
            <span class="settings-row-label" data-i18n="sync_last">Последняя синхронизация</span>
            <span class="settings-row-value" id="sync-last-time">—</span>
          </div>
        </div>
```
Заменить на:
```html
        <div class="settings-pane hidden" id="pane-sync">
          <!-- Соло: создать / присоединиться -->
          <div id="sync-solo">
            <button class="settings-save-btn" id="group-create-btn" data-i18n="group_create">Создать группу</button>
            <div class="settings-row">
              <input type="text" id="group-join-input" class="settings-input" maxlength="6"
                     data-i18n-placeholder="group_join_placeholder" placeholder="Код">
              <button class="settings-row-btn" id="group-join-btn" data-i18n="group_join">Присоединиться</button>
            </div>
          </div>
          <!-- В группе: статус + интервал + покинуть -->
          <div id="sync-grouped" class="hidden">
            <div class="settings-row">
              <span class="settings-row-label" data-i18n="group_role_label">Роль</span>
              <span class="settings-row-value" id="group-role-value"></span>
            </div>
            <div class="settings-row">
              <span class="settings-row-label" data-i18n="group_code_label">Код группы</span>
              <span class="settings-row-value" id="group-code-value"></span>
            </div>
            <div class="settings-row">
              <span class="settings-row-label" data-i18n="sync_interval">Интервал</span>
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
              <span class="settings-row-label" data-i18n="sync_last">Последняя синхронизация</span>
              <span class="settings-row-value" id="sync-last-time">—</span>
            </div>
            <button class="settings-save-btn" id="group-leave-btn" data-i18n="group_leave">Покинуть группу</button>
          </div>
        </div>
```

- [ ] **Step 2: Переписать `loadSyncTab`** в `src/renderer/js/app.js`.

Найти:
```js
async function loadSyncTab() {
  const seconds = await window.api.getSyncInterval()
  document.getElementById('sync-interval-select').value = String(seconds || 300)
  const ts = await window.api.getLastSync()
  document.getElementById('sync-last-time').textContent = formatLastSync(ts)
}
```
Заменить на:
```js
async function loadSyncTab() {
  const role    = (await window.api.getSetting('group_role')) || 'solo'
  const code    = (await window.api.getSetting('group_code')) || ''
  const grouped = window.ROLES.isGrouped(role)

  document.getElementById('sync-solo').classList.toggle('hidden', grouped)
  document.getElementById('sync-grouped').classList.toggle('hidden', !grouped)

  if (grouped) {
    document.getElementById('group-role-value').textContent = t(`group_role_${role}`)
    document.getElementById('group-code-value').textContent = code
    const seconds = await window.api.getSyncInterval()
    document.getElementById('sync-interval-select').value = String(seconds || 300)
    const ts = await window.api.getLastSync()
    document.getElementById('sync-last-time').textContent = formatLastSync(ts)
  } else {
    document.getElementById('group-join-input').value = ''
  }
}
```

- [ ] **Step 3: Добавить обработчики Create/Join/Leave + слушатель лимита.** В `src/renderer/js/app.js`, в секции `// ── Sync`, после блока `document.getElementById('sync-interval-select').addEventListener(...)` добавить:

```js
document.getElementById('group-create-btn').addEventListener('click', async () => {
  await window.api.createGroup()
  await loadSyncTab()
})

document.getElementById('group-join-btn').addEventListener('click', async () => {
  const code = document.getElementById('group-join-input').value.trim()
  if (code.length < 4) return
  await window.api.joinGroup(code)
  await loadSyncTab()
})

document.getElementById('group-leave-btn').addEventListener('click', async () => {
  await window.api.leaveGroup()
  await loadSyncTab()
  await refreshStats()
})

window.api.onSyncLimitUpdated(async () => {
  await refreshStats()
  if (!settingsModal.classList.contains('hidden')) await loadLimitTab()
})
```

- [ ] **Step 4: Проверка разметки i18n + регрессии**

Run: `npm test`
Expected: PASS — тест «каждый `data-i18n` ключ из `index.html` резолвится в обоих словарях» проходит (ключи добавлены в Task 5).

- [ ] **Step 5: Ручная проверка `npm run dev`** (одиночный инстанс):

```bash
npm run dev
```
Проверить:
1. Настройки → «Синхронизация»: в соло видно «Создать группу» + поле кода; интервал/последняя синхронизация скрыты.
2. «Создать группу» → появляется бейдж «Владелец» + 6-символьный код, кнопка «Покинуть группу», интервал виден.
3. «Покинуть группу» → вернулось соло-состояние.
4. Переключить язык на вкладке «Общие» → строки группы переведены (en).
Ожидаемо: всё как выше, ошибок в консоли нет.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/index.html src/renderer/js/app.js
git commit -m "feat(sync-ui): group create/join/leave states in Sync tab"
```

---

### Task 7: Ручная проверка синка между двумя инстансами (verification)

**Files:** нет (только проверка).

- [ ] **Step 1: Запустить два инстанса с разными профилями данных.** В двух терминалах:

```bash
npm run dev
```
и
```bash
# второй инстанс с отдельным userData, чтобы не делить БД
".\node_modules\electron\dist\electron.exe" . --user-data-dir="%TEMP%\tt-peer"
```
(При первом запуске второго инстанса — ввести другое имя пользователя.)

- [ ] **Step 2: Создать группу на инстансе A (owner), присоединиться на B (member) по коду.**
Проверить: индикатор `sync-dot` в шапке обоих зелёный; на member во вкладке «Лимит» поля read-only и показана заметка `limit_readonly_note`.

- [ ] **Step 3: Проверить синк данных.**
- Наработать сессию на A → на B в календаре появляется день A; общий лимит на обоих учитывает сумму.
- Изменить лимит у owner (A) → у member (B) лимит/период обновились (событие `sync:limit-updated`), шкала перерисовалась.
- Ввести неверный код при Join на B → соединение не поднимается (индикатор серый), данные не текут (handshake отклонён).

- [ ] **Step 4: Проверить Leave.**
На B «Покинуть группу» → роль соло, `peer_data` очищен (день A исчез из календаря B), синк остановлен, лимит снова редактируем.

- [ ] **Step 5: Обновить PROGRESS.md и память** (после подтверждения пользователем — по правилу проекта спросить перед записью), затем push ветки.

---

## Self-Review

**Spec coverage:**
- §1 install_id/настройки → Task 4 (сид) + Task 3 (чтение). ✅
- §2 group.js чистая логика → Task 1. ✅
- §3 протокол (handshake/UDP/payload/приём/apply-limit) → Task 3. ✅
- §4 жизненный цикл (start идемпотентный/stop/реконнект под `started`) → Task 3. ✅
- §5 IPC create/join/leave + gated boot → Task 4. ✅
- §6 UI два состояния + i18n → Task 5 (ключи) + Task 6 (разметка/логика). ✅
- §7 тесты (group, peer self-guard, ручной синк) → Task 1, Task 2, Task 7. ✅
- §8 YAGNI (peer_data_reset оставлен, порты-константы) → соблюдено, лишнего нет. ✅

**Placeholder scan:** плейсхолдеров нет — весь код приведён дословно.

**Type consistency:**
- `storePeerAggregates(db, payload, myInstallId)` — одинаковая сигнатура в Task 2 (опр.) и Task 3 (вызов). ✅
- `isSelf/validateHandshake/shouldApplyLimit/generateCode/normalizeCode` — сигнатуры из Task 1 совпадают с вызовами в Task 2/3/4. ✅
- События `sync:limit-updated` — отправка Task 3, подписка preload+app.js Task 4/6. ✅
- `window.ROLES.isGrouped` — из Этапа 3 (`roles.js`), используется в Task 6. ✅
- Роль-ключи `group_role_${role}` (`solo/owner/member`) совпадают с ключами словаря Task 5. ✅
