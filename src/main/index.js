const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const initSqlJs = require('sql.js')
const { startSync, stopSync, syncNow, setSyncInterval, getLastSyncAt } = require('./sync')
const { advancePeriod } = require('./period')
const { pickPresetCategories } = require('./presets')
const { purgeSelfFromPeerData } = require('./peer')
const { generateCode, normalizeCode } = require('./group')
const { clampBoundsToScreen } = require('./window-bounds')
const crypto = require('crypto')
const { detectLang } = require('../renderer/js/i18n/i18n')

let db = null
let dbPath = null
let mainWin = null

function saveDB() {
  if (db && dbPath) fs.writeFileSync(dbPath, Buffer.from(db.export()))
}

function defaultPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based
  // период: 28-е прошлого месяца — 27-е текущего
  const start = new Date(year, month - 1, 28)
  const end   = new Date(year, month, 27)
  const fmt = d => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return { start: fmt(start), end: fmt(end) }
}

async function initDB() {
  const SQL = await initSqlJs({
    locateFile: file => {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', file)
      }
      return path.join(__dirname, '../../node_modules/sql.js/dist', file)
    }
  })

  dbPath = path.join(app.getPath('userData'), 'timetracker.db')

  db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database()

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user             TEXT NOT NULL,
      category_id      INTEGER NOT NULL,
      started_at       INTEGER NOT NULL,
      ended_at         INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE TABLE IF NOT EXISTS peer_data (
      user          TEXT NOT NULL,
      day           TEXT NOT NULL,
      total_seconds INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      PRIMARY KEY (user, day)
    );
  `)

  const catCount = db.exec('SELECT COUNT(*) FROM categories')[0].values[0][0]
  if (catCount === 0) {
    const presets = pickPresetCategories(detectLang(app.getLocale()))
    presets.forEach(cat =>
      db.run('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
        [cat.name, cat.color, cat.sort_order])
    )
  }

  // Сидируем настройки периода и лимита при первом запуске
  const seedSetting = (key, value) => {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    stmt.bind([key])
    const exists = stmt.step()
    stmt.free()
    if (!exists) db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value])
  }

  const period = defaultPeriod()
  seedSetting('period_start',         period.start)
  seedSetting('period_end',           period.end)
  seedSetting('monthly_limit_seconds', String(160 * 3600))
  seedSetting('sync_interval_seconds', '300')
  seedSetting('group_role',            'solo')
  seedSetting('install_id',            crypto.randomUUID())

  // Migration: move old 'avatar' key to avatar_<user>
  const oldAvatarStmt = db.prepare("SELECT value FROM settings WHERE key = 'avatar'")
  const oldAvatarExists = oldAvatarStmt.step()
  const oldAvatarVal = oldAvatarExists ? oldAvatarStmt.getAsObject().value : null
  oldAvatarStmt.free()
  if (oldAvatarVal) {
    const userStmt = db.prepare("SELECT value FROM settings WHERE key = 'user_name'")
    const userExists = userStmt.step()
    const userName = userExists ? userStmt.getAsObject().value : null
    userStmt.free()
    if (userName) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [`avatar_${userName}`, oldAvatarVal])
    }
    db.run("DELETE FROM settings WHERE key = 'avatar'")
  }

  try {
    db.exec('ALTER TABLE categories ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0')
  } catch (_) {}

  // Одноразовая чистка peer_data: убираем накопленные самодубли (данные локального
  // пользователя под старыми/новыми именами), попавшие туда легаси-синком.
  // Соло-режим = свои часы только из sessions; напарник вернётся в Этапе 4 через синк.
  const resetDone = db.prepare("SELECT 1 FROM settings WHERE key = 'peer_data_reset_v1'")
  const alreadyReset = resetDone.step()
  resetDone.free()
  if (!alreadyReset) {
    db.run('DELETE FROM peer_data')
    db.run("INSERT INTO settings (key, value) VALUES ('peer_data_reset_v1', '1')")
  }

  saveDB()
}

// Вспомогательная функция: дата ISO → начало дня в мс
function dateToMs(isoDate) {
  return new Date(isoDate + 'T00:00:00').getTime()
}
// дата ISO → конец дня в мс (23:59:59.999)
function dateToMsEnd(isoDate) {
  return new Date(isoDate + 'T23:59:59.999').getTime()
}

function getPeriodSettings() {
  const get = key => {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    stmt.bind([key])
    const val = stmt.step() ? stmt.getAsObject().value : null
    stmt.free()
    return val
  }
  return {
    period_start:          get('period_start'),
    period_end:            get('period_end'),
    monthly_limit_seconds: Number(get('monthly_limit_seconds') ?? 160 * 3600),
  }
}

// Автопродление периода: если today вышло за period_end, сдвигаем период вперёд помесячно.
// Период локальный (по LAN не синхронизируется) и вычисляется детерминированно.
function advancePeriodIfNeeded() {
  const { period_start, period_end } = getPeriodSettings()
  if (!period_start || !period_end) return false
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const { start, end, changed } = advancePeriod(period_start, period_end, today)
  if (changed) {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['period_start', start])
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['period_end', end])
    saveDB()
  }
  return changed
}

function setupIPC() {
  ipcMain.handle('app:get-default-name', () => {
    try { return os.userInfo().username || '' } catch { return '' }
  })

  ipcMain.handle('db:rename-user', (_, newName) => {
    const name = String(newName || '').trim()
    if (!name) return false
    const stmt = db.prepare("SELECT value FROM settings WHERE key = 'user_name'")
    const old = stmt.step() ? stmt.getAsObject().value : null
    stmt.free()
    if (!old || old === name) {
      db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', ?)", [name])
      saveDB()
      return true
    }
    db.run('UPDATE sessions SET user = ? WHERE user = ?', [name, old])
    purgeSelfFromPeerData(db, old)  // старое имя не должно остаться как «напарник»
    const av = db.prepare('SELECT value FROM settings WHERE key = ?')
    av.bind([`avatar_${old}`])
    const avatar = av.step() ? av.getAsObject().value : null
    av.free()
    if (avatar) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`avatar_${name}`, avatar])
      db.run('DELETE FROM settings WHERE key = ?', [`avatar_${old}`])
    }
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', ?)", [name])
    saveDB()
    return true
  })

  ipcMain.handle('db:get-setting', (_, key) => {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    stmt.bind([key])
    const result = stmt.step() ? stmt.getAsObject().value : null
    stmt.free()
    return result
  })

  ipcMain.handle('db:set-setting', (_, key, value) => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
    saveDB()
  })

  ipcMain.handle('db:get-categories', () => {
    const stmt = db.prepare('SELECT id, name, color, sort_order FROM categories WHERE deleted = 0 ORDER BY sort_order')
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  })

  ipcMain.handle('db:save-session', (_, session) => {
    db.run(
      'INSERT INTO sessions (user, category_id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?, ?)',
      [session.user, session.category_id, session.started_at, session.ended_at, session.duration_seconds]
    )
    saveDB()
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  })

  ipcMain.handle('db:get-period-settings', () => getPeriodSettings())

  ipcMain.handle('db:get-monthly-stats', (_, user) => {
    const { period_start, period_end } = getPeriodSettings()
    const from = dateToMs(period_start)
    const to   = dateToMsEnd(period_end)
    const stmt = db.prepare(`
      SELECT c.name, c.color, SUM(s.duration_seconds) as total
      FROM sessions s
      JOIN categories c ON s.category_id = c.id
      WHERE s.user = ?
        AND s.started_at >= ? AND s.started_at <= ?
        AND c.deleted = 0
      GROUP BY s.category_id
      HAVING total > 0
      ORDER BY total DESC
    `)
    const rows = []
    stmt.bind([user, from, to])
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  })

  ipcMain.handle('db:get-sessions-by-date', (_, user, isoDate) => {
    const from = dateToMs(isoDate)
    const to   = dateToMsEnd(isoDate)
    const stmt = db.prepare(`
      SELECT s.id, s.duration_seconds, s.category_id, c.name, c.color
      FROM sessions s
      JOIN categories c ON s.category_id = c.id
      WHERE s.user = ? AND s.started_at >= ? AND s.started_at <= ?
        AND c.deleted = 0
      ORDER BY s.started_at
    `)
    const rows = []
    stmt.bind([user, from, to])
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  })

  ipcMain.handle('db:update-session', (_, id, categoryId, durationSeconds) => {
    db.run(
      'UPDATE sessions SET category_id = ?, duration_seconds = ?, ended_at = started_at + ? WHERE id = ?',
      [categoryId, durationSeconds, durationSeconds * 1000, id]
    )
    saveDB()
  })

  ipcMain.handle('db:delete-session', (_, id) => {
    db.run('DELETE FROM sessions WHERE id = ?', [id])
    saveDB()
  })

  ipcMain.handle('db:add-category', (_, name, color) => {
    const maxResult = db.exec('SELECT MAX(sort_order) as mx FROM categories')
    const mx = maxResult[0]?.values[0][0] ?? -1
    db.run('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)', [name, color, mx + 1])
    saveDB()
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  })

  ipcMain.handle('db:update-category', (_, id, name, color) => {
    db.run('UPDATE categories SET name = ?, color = ? WHERE id = ?', [name, color, id])
    saveDB()
  })

  ipcMain.handle('db:get-user-avatars', () => {
    const stmt = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'avatar_%'")
    const avatars = {}
    while (stmt.step()) {
      const row = stmt.getAsObject()
      avatars[row.key.slice('avatar_'.length)] = row.value || 'user.svg'
    }
    stmt.free()
    return avatars
  })

  ipcMain.handle('db:get-calendar-month', (_, { year, month }) => {
    const y = String(year)
    const m = String(month).padStart(2, '0')

    const sessStmt = db.prepare(`
      SELECT
        user,
        date(started_at / 1000, 'unixepoch', 'localtime') AS day,
        SUM(duration_seconds) AS total_seconds
      FROM sessions
      WHERE strftime('%Y', datetime(started_at / 1000, 'unixepoch', 'localtime')) = ?
        AND strftime('%m', datetime(started_at / 1000, 'unixepoch', 'localtime')) = ?
      GROUP BY user, day
      ORDER BY day
    `)
    const results = []
    sessStmt.bind([y, m])
    while (sessStmt.step()) results.push(sessStmt.getAsObject())
    sessStmt.free()

    const peerStmt = db.prepare(
      'SELECT user, day, total_seconds FROM peer_data WHERE day LIKE ? ORDER BY day'
    )
    peerStmt.bind([`${y}-${m}-%`])
    while (peerStmt.step()) results.push(peerStmt.getAsObject())
    peerStmt.free()

    return results
  })

  ipcMain.handle('db:get-shared-total', () => {
    const { period_start, period_end } = getPeriodSettings()
    const from = dateToMs(period_start)
    const to   = dateToMsEnd(period_end)

    const sessStmt = db.prepare(`
      SELECT SUM(s.duration_seconds) as total
      FROM sessions s
      JOIN categories c ON s.category_id = c.id
      WHERE s.started_at >= ? AND s.started_at <= ?
        AND c.deleted = 0
    `)
    sessStmt.bind([from, to])
    const localTotal = sessStmt.step() ? (sessStmt.getAsObject().total ?? 0) : 0
    sessStmt.free()

    const peerStmt = db.prepare(
      'SELECT SUM(total_seconds) as total FROM peer_data WHERE day >= ? AND day <= ?'
    )
    peerStmt.bind([period_start, period_end])
    const peerTotal = peerStmt.step() ? (peerStmt.getAsObject().total ?? 0) : 0
    peerStmt.free()

    return localTotal + peerTotal
  })

  ipcMain.handle('sync:now', () => syncNow())

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

  ipcMain.handle('win:minimize', () => { if (mainWin) mainWin.minimize() })
  ipcMain.handle('win:maximize-toggle', () => {
    if (!mainWin) return
    if (mainWin.isMaximized()) mainWin.unmaximize()
    else mainWin.maximize()
  })
  ipcMain.handle('win:close', () => { if (mainWin) mainWin.close() })

  ipcMain.handle('db:get-deleted-categories', () => {
    const stmt = db.prepare('SELECT id, name FROM categories WHERE deleted = 1 ORDER BY name')
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  })

  ipcMain.handle('db:soft-delete-category', (_, id) => {
    db.run('UPDATE categories SET deleted = 1 WHERE id = ?', [id])
    saveDB()
  })

  ipcMain.handle('db:restore-category', (_, id) => {
    db.run('UPDATE categories SET deleted = 0 WHERE id = ?', [id])
    saveDB()
  })
}

function createWindow() {
  const opts = {
    // Высота Focus складывается из шапки, кольца 330px, кнопки, двух-трёх
    // рядов бейджей и подвала периода. Ниже 780 они начинают наезжать друг
    // на друга, поэтому минимум поднят с 600.
    width: 700,
    height: 780,
    minWidth: 700,
    minHeight: 780,
    frame: false,
    resizable: true,
    icon: path.join(__dirname, '../../assets/icons/time-management.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  }

  let restoreMaximized = false
  const saved = readBoundsSetting()
  if (saved) {
    const clamped = clampBoundsToScreen(saved, screen.getAllDisplays())
    if (clamped) {
      opts.width = clamped.width
      opts.height = clamped.height
      opts.x = clamped.x
      opts.y = clamped.y
      restoreMaximized = !!saved.maximized
    }
  }

  const win = new BrowserWindow(opts)
  if (restoreMaximized) win.maximize()

  win.on('maximize',   () => { if (!win.isDestroyed()) win.webContents.send('win:maximized') })
  win.on('unmaximize', () => { if (!win.isDestroyed()) win.webContents.send('win:unmaximized') })

  win.on('close', () => {
    try {
      const b = win.getNormalBounds()
      const rec = { width: b.width, height: b.height, x: b.x, y: b.y, maximized: win.isMaximized() }
      db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('window_bounds', ?)", [JSON.stringify(rec)])
      saveDB()
    } catch (_) {}
  })

  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
  return win
}

function readBoundsSetting() {
  const stmt = db.prepare("SELECT value FROM settings WHERE key = 'window_bounds'")
  const val = stmt.step() ? stmt.getAsObject().value : null
  stmt.free()
  if (!val) return null
  try { return JSON.parse(val) } catch (_) { return null }
}

app.whenReady().then(async () => {
  await initDB()
  advancePeriodIfNeeded() // при запуске: окно откроется уже с актуальным периодом
  setupIPC()
  mainWin = createWindow()
  const win = mainWin

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

  // Периодическая проверка: приложение может работать сутками, дата сменится без перезапуска.
  setInterval(() => {
    if (advancePeriodIfNeeded() && !win.isDestroyed()) {
      win.webContents.send('period:advanced')
    }
  }, 60 * 60 * 1000)
})

app.on('window-all-closed', () => app.quit())
