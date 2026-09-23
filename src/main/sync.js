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
  if (_wss)            { try { _wss.close() } catch (err) { console.log('[sync] WS server close failed:', err.message) } _wss = null }
  if (_udp)            { try { _udp.close() } catch (err) { console.log('[sync] UDP socket close failed:', err.message) } _udp = null }
  if (peerSocket)      { try { peerSocket.close() } catch (err) { console.log('[sync] peer socket close failed:', err.message) } peerSocket = null }
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
        try { msg = JSON.parse(data) } catch { return }
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
      let data
      try { data = JSON.parse(buf.toString()) } catch { return }
      if (data.instanceId === INSTANCE_ID) return
      try { connectToPeer(rinfo.address, data.port || WS_PORT) }
      catch (err) { console.log('[sync] peer connect failed:', err.message) }
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
    try { msg = JSON.parse(data) } catch { return }
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
