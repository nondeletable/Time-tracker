// Reconnect timing lives here rather than inside sync.js so that it can be checked
// without opening a socket. Getting it wrong is invisible at runtime: a flat retry
// and a backed-off one behave identically until the peer has been gone for an hour,
// and by then nobody is watching the log.

const RECONNECT_BASE_MS = 5 * 1000
const RECONNECT_MAX_MS  = 5 * 60 * 1000

// Half the window is kept and half is re-rolled, so a delay always lands between
// 50% and 100% of the step for that attempt. Re-rolling the whole window - full
// jitter - would now and then retry almost immediately after a long wait, which
// undoes the ladder; keeping the floor means the wait can only ever grow.
function reconnectDelay(attempt, random = Math.random) {
  const step = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS)
  return step / 2 + random() * (step / 2)
}

module.exports = { reconnectDelay, RECONNECT_BASE_MS, RECONNECT_MAX_MS }
