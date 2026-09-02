// Инвариант: peer_data хранит данные ТОЛЬКО других пользователей.
// Локальный пользователь считается через sessions; его имя не должно попадать в peer_data,
// иначе часы задваиваются (общий лимит) и раздваиваются строки в календаре.

function purgeSelfFromPeerData(db, userName) {
  const name = String(userName || '').trim()
  if (!name) return
  db.run('DELETE FROM peer_data WHERE user = ?', [name])
}

module.exports = { purgeSelfFromPeerData }
