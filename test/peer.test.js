const test = require('node:test')
const assert = require('node:assert/strict')
const initSqlJs = require('sql.js')

const { purgeSelfFromPeerData } = require('../src/main/peer')

async function makeDb() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(`CREATE TABLE peer_data (
    user TEXT NOT NULL, day TEXT NOT NULL, total_seconds INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, PRIMARY KEY (user, day))`)
  const ins = (u, d, s) =>
    db.run('INSERT INTO peer_data (user, day, total_seconds, updated_at) VALUES (?,?,?,?)', [u, d, s, 0])
  return { db, ins }
}

test('purgeSelfFromPeerData: удаляет строки локального пользователя, оставляет напарника', async () => {
  const { db, ins } = await makeDb()
  ins('Sasha', '2026-08-16', 12386)   // самодубль
  ins('Sasha', '2026-08-19', 28260)
  ins('Maxim', '2026-08-16', 12386)   // легитимный напарник
  purgeSelfFromPeerData(db, 'Sasha')
  const rows = db.exec('SELECT user, COUNT(*) c FROM peer_data GROUP BY user')
  assert.deepEqual(rows[0].values, [['Maxim', 1]])
})

test('purgeSelfFromPeerData: no-op если своего имени нет в peer_data', async () => {
  const { db, ins } = await makeDb()
  ins('Maxim', '2026-08-16', 12386)
  purgeSelfFromPeerData(db, 'Sashenka')
  const total = db.exec('SELECT COUNT(*) FROM peer_data')[0].values[0][0]
  assert.equal(total, 1)
})

test('purgeSelfFromPeerData: пустое/невалидное имя — ничего не делает', async () => {
  const { db, ins } = await makeDb()
  ins('Maxim', '2026-08-16', 12386)
  purgeSelfFromPeerData(db, '')
  purgeSelfFromPeerData(db, null)
  const total = db.exec('SELECT COUNT(*) FROM peer_data')[0].values[0][0]
  assert.equal(total, 1)
})
