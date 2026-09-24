// Helpers with no DOM and no state of their own. They were the only part of
// app.js that could be reasoned about on its own, so they moved first.
//
// formatHM stayed behind in 3b because it calls into the active language and
// that language was a local in app.js. Once the language became a module of its
// own the reason was gone, so it joined the rest and this file now imports
// lang.js. shortDate is still out: it belongs to the Summary view and is used
// nowhere else.

import { t } from './lang.js'

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

// Local calendar date, not UTC: toISOString() would hand back yesterday for
// anyone east of Greenwich in the evening. The calendar and the Summary chart
// both need it for an arbitrary day, todayISO needs it for now - one formula.
export function localISODate(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayISO() {
  return localISODate(new Date())
}

export function daysBetween(fromISO, toISO) {
  const ms = new Date(toISO + 'T00:00:00') - new Date(fromISO + 'T00:00:00')
  return Math.round(ms / 86400000)
}

// Hours and minutes for a human: "5h 41m", and just one unit when the other is
// zero. The unit labels come from the dictionary, so this one is language-aware.
export function formatHM(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (!h) return `${m}${t('unit_m')}`
  if (!m) return `${h}${t('unit_h')}`
  return `${h}${t('unit_h')} ${m}${t('unit_m')}`
}
