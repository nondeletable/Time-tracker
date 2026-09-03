// Инвариант: peer_data хранит данные ТОЛЬКО других пользователей.
// Локальный пользователь считается через sessions; его имя не должно попадать в peer_data,
// иначе часы задваиваются (общий лимит) и раздваиваются строки в календаре.

const { isSelf } = require('./group')

function purgeSelfFromPeerData(db, userName) {
  const name = String(userName || '').trim()
  if (!name) return
  db.run('DELETE FROM peer_data WHERE user = ?', [name])
}

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

module.exports = { purgeSelfFromPeerData, storePeerAggregates }
