// Which Dashboard view is open. Written only by setView in app.js, but read from
// seven places: the stats refresh, the language switch, four sync events that
// reload whatever view is open, and the background preview, which draws only
// while Appearance is on screen. Same shape as lang.js and user.js - the value stays private, because
// an imported binding cannot be assigned to.

let currentView = 'summary'

export function getCurrentView() {
  return currentView
}

export function setCurrentView(view) {
  currentView = view
}
