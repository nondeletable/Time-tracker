const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const initSqlJs = require('sql.js')

let db = null
let dbPath = null

const PRESET_CATEGORIES = [
  { name: 'Engine Development',           color: '#60a5fa', sort_order: 0 },
  { name: 'Research, Writing, Scenario',  color: '#c084fc', sort_order: 1 },
  { name: 'Design Document',             color: '#fb923c', sort_order: 2 },
  { name: 'Illustrations, Content, Music',color: '#f472b6', sort_order: 3 },
  { name: 'Bugfixes',                    color: '#f87171', sort_order: 4 },
  { name: 'Administrative',              color: '#34d399', sort_order: 5 },
]

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
    locateFile: file => path.join(__dirname, '../../node_modules/sql.js/dist', file)
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
  `)

  const catCount = db.exec('SELECT COUNT(*) FROM categories')[0].values[0][0]
  if (catCount === 0) {
    PRESET_CATEGORIES.forEach(cat =>
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
  seedSetting('avatar', 'user.svg')

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

function setupIPC() {
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
    const stmt = db.prepare('SELECT id, name, color, sort_order FROM categories ORDER BY sort_order')
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

  ipcMain.handle('db:get-shared-total', () => {
    const { period_start, period_end } = getPeriodSettings()
    const from = dateToMs(period_start)
    const to   = dateToMsEnd(period_end)
    const stmt = db.prepare(
      'SELECT SUM(duration_seconds) as total FROM sessions WHERE started_at >= ? AND started_at <= ?'
    )
    stmt.bind([from, to])
    const total = stmt.step() ? (stmt.getAsObject().total ?? 0) : 0
    stmt.free()
    return total
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 700,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  await initDB()
  setupIPC()
  createWindow()
})

app.on('window-all-closed', () => app.quit())
