// Who is at the app right now. One of the four variables in app.js that really
// were shared - read by nine places across five views, written by three - so it
// cannot travel with any single view and gets a module instead. Same shape as
// lang.js: the value stays private, because an imported binding cannot be
// assigned to.
//
// The name is also the key the rows are filed under, so it is set in exactly two
// situations: restored from the user_name setting at startup, and entered by the
// person - on first run, or when renaming themselves in Profile.

let currentUser = null

export function getUser() {
  return currentUser
}

export function setUser(name) {
  currentUser = name
}
