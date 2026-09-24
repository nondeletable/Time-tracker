// Pure helpers: no DOM, no module state, nothing to mock. They were the only
// part of app.js that could be reasoned about on its own, so they move first.
// formatHM and shortDate deliberately stay behind - both call into the active
// language, and dragging them here would drag that state with them.

// Category names and colours come out of the database, and a group member's name
// arrives from the peer over the network. All of it is rendered through innerHTML,
// so every such value is escaped before it lands in a tag or an attribute. The
// page CSP already stops an injected handler from running; this keeps injected
// markup from rearranging the layout in the first place.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

export function secsToHHMM(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function hhmmToSecs(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 3600 + m * 60
}

export function todayISO() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function daysBetween(fromISO, toISO) {
  const ms = new Date(toISO + 'T00:00:00') - new Date(fromISO + 'T00:00:00')
  return Math.round(ms / 86400000)
}
