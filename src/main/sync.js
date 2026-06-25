const WebSocket = require('ws')
const dgram     = require('dgram')

const WS_PORT               = 43210
const UDP_PORT              = 43211
const SYNC_INTERVAL_MS      = 5 * 60 * 1000
const BROADCAST_INTERVAL_MS = 30 * 1000
const RECONNECT_DELAY_MS    = 30 * 1000
const INSTANCE_ID = Math.random().toString(36).slice(2)

let _db     = null
let _saveDB = null
let _win    = null

let peerSocket     = null
let peerIP         = null
let peerPort       = WS_PORT
let syncTimer      = null
let reconnectTimer = null
let serverClients  = new Set()

function startSync(db, saveDB, win) {
  _db     = db
  _saveDB = saveDB
  _win    = win
  startWSServer()
  startUDP()
}

// ── WebSocket server (accepts incoming connections from peer) ──────────────

function startWSServer() {
  try {
    const wss = new WebSocket.Server({ port: WS_PORT })
    console.log(`[sync] WS server listening on port ${WS_PORT}`)
    wss.on('connection', (ws, req) => {
      console.log(`[sync] Incoming connection from ${req.socket.remoteAddress}`)
      serverClients.add(ws)
      notifyStatus(true)
      ws.on('message', data => {
        try {
          const payload = JSON.parse(data)
          if (payload.type === 'sync') {
            console.log(`[sync] Received data from ${payload.user}`)
            storePeerData(payload)
            sendSyncPayload(ws)
          }
        } catch (_) {}
      })
      ws.on('close', () => {
        console.log('[sync] Incoming connection closed')
        serverClients.delete(ws)
        if (serverClients.size === 0 && (!peerSocket || peerSocket.readyState !== WebSocket.OPEN)) {
          notifyStatus(false)
        }
      })
    })
    wss.on('error', err => console.log('[sync] WS server error:', err.message))
  } catch (err) {
    console.log('[sync] WS server failed to start:', err.message)
  }
}

// ── UDP broadcast (peer discovery) ─────────────────────────────────────────

function startUDP() {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  sock.bind(UDP_PORT, () => {
    sock.setBroadcast(true)
    console.log(`[sync] UDP socket bound on port ${UDP_PORT}`)

    const sendBroadcast = () => {
      const msg = Buffer.from(JSON.stringify({ instanceId: INSTANCE_ID, port: WS_PORT }))
      sock.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255', () => {})
      console.log('[sync] UDP broadcast sent')
    }
    sendBroadcast()
    setInterval(sendBroadcast, BROADCAST_INTERVAL_MS)

    sock.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString())
        if (data.instanceId === INSTANCE_ID) return
        console.log(`[sync] UDP received from ${rinfo.address} — connecting...`)
        connectToPeer(rinfo.address, data.port || WS_PORT)
      } catch (_) {}
    })

    sock.on('error', err => console.log('[sync] UDP error:', err.message))
  })
}

// ── WebSocket client (outgoing connection to peer) ─────────────────────────

function connectToPeer(ip, port) {
  if (peerSocket && (
    peerSocket.readyState === WebSocket.OPEN ||
    peerSocket.readyState === WebSocket.CONNECTING
  )) return

  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

  peerIP   = ip
  peerPort = port

  console.log(`[sync] Connecting to peer ${ip}:${port}`)
  const ws = new WebSocket(`ws://${ip}:${port}`)

  ws.on('open', () => {
    console.log(`[sync] Connected to peer ${ip}:${port}`)
    peerSocket = ws
    notifyStatus(true)
    sendSyncPayload(ws)
    if (syncTimer) clearInterval(syncTimer)
    syncTimer = setInterval(() => sendSyncPayload(ws), SYNC_INTERVAL_MS)
  })

  ws.on('message', data => {
    try {
      const payload = JSON.parse(data)
      if (payload.type === 'sync') storePeerData(payload)
    } catch (_) {}
  })

  ws.on('close', () => {
    console.log(`[sync] Connection to peer ${ip}:${port} closed`)
    peerSocket = null
    notifyStatus(false)
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
    reconnectTimer = setTimeout(() => connectToPeer(peerIP, peerPort), RECONNECT_DELAY_MS)
  })

  ws.on('error', () => {})
}

// ── Build sync payload from local DB ──────────────────────────────────────

function buildPayload() {
  const userStmt = _db.prepare("SELECT value FROM settings WHERE key = 'user_name'")
  const hasUser  = userStmt.step()
  const user     = hasUser ? userStmt.getAsObject().value : null
  userStmt.free()
  if (!user) return null

  const avatarStmt = _db.prepare('SELECT value FROM settings WHERE key = ?')
  avatarStmt.bind([`avatar_${user}`])
  const hasAvatar = avatarStmt.step()
  const avatar    = hasAvatar ? avatarStmt.getAsObject().value : 'user.svg'
  avatarStmt.free()

  const daysStmt = _db.prepare(`
    SELECT
      date(started_at / 1000, 'unixepoch', 'localtime') AS day,
      SUM(duration_seconds) AS total_seconds
    FROM sessions
    WHERE user = ?
    GROUP BY day
  `)
  daysStmt.bind([user])
  const days = []
  while (daysStmt.step()) days.push(daysStmt.getAsObject())
  daysStmt.free()

  return { type: 'sync', user, avatar, days }
}

function sendSyncPayload(ws) {
  if (ws.readyState !== WebSocket.OPEN) return
  const payload = buildPayload()
  if (!payload) return
  ws.send(JSON.stringify(payload))
}

// ── Store received peer data in DB ─────────────────────────────────────────

function storePeerData(payload) {
  const { user, avatar, days } = payload
  if (!user || !Array.isArray(days)) return

  _db.run('DELETE FROM peer_data WHERE user = ?', [user])
  const now = Date.now()
  days.forEach(d => {
    if (d.day && d.total_seconds != null) {
      _db.run(
        'INSERT INTO peer_data (user, day, total_seconds, updated_at) VALUES (?, ?, ?, ?)',
        [user, d.day, d.total_seconds, now]
      )
    }
  })

  if (avatar) {
    _db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [`avatar_${user}`, avatar]
    )
  }

  _saveDB()

  if (_win && !_win.isDestroyed()) {
    _win.webContents.send('sync:peer-updated')
  }
}

// ── Status notification ────────────────────────────────────────────────────

function notifyStatus(connected) {
  if (_win && !_win.isDestroyed()) {
    _win.webContents.send('sync:status-changed', connected)
  }
}

function syncNow() {
  if (peerSocket && peerSocket.readyState === WebSocket.OPEN) {
    sendSyncPayload(peerSocket)
  }
  serverClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) sendSyncPayload(ws)
  })
}

module.exports = { startSync, syncNow }
