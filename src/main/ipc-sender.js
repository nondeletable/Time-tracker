// Whether an IPC call came from the main frame of our own window. Lives outside
// index.js so that the refusing branch can be checked without Electron: in the
// running app it cannot be triggered at all - there is no second frame, and the
// preload does not run in subframes - so a bug that made this always true would
// leave the app looking perfectly healthy while the check guards nothing.
//
// It becomes a real barrier the day the app gets an <iframe>, a webview or a
// window opened from code, and the test has to exist before that day, not after.

function isOurFrame(frame, win) {
  return Boolean(frame && win && !win.isDestroyed() && frame === win.webContents.mainFrame)
}

module.exports = { isOurFrame }
