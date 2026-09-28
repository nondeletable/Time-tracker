// What the Start/Stop hotkey may be. The renderer builds the accelerator from a
// key press, but the main process is what hands it to the OS, so the check lives
// here, outside index.js, where node --test can reach it without Electron.
//
// A global hotkey fires in every program on the machine, so it must carry at
// least one of Ctrl, Alt or Super: Shift+letter alone is ordinary typing, and
// grabbing it system-wide would swallow capital letters everywhere.

const MODIFIERS = new Set(['CommandOrControl', 'Alt', 'Shift', 'Super'])
const REQUIRED  = new Set(['CommandOrControl', 'Alt', 'Super'])
const KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/

function isValidAccelerator(accel) {
  if (typeof accel !== 'string') return false
  const parts = accel.split('+')
  const key = parts.pop()
  if (!KEY.test(key)) return false
  if (new Set(parts).size !== parts.length) return false
  if (!parts.every(p => MODIFIERS.has(p))) return false
  return parts.some(p => REQUIRED.has(p))
}

module.exports = { isValidAccelerator }
