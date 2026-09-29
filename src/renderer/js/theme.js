// The active theme: which of the two saved palettes is on, and the two palettes
// themselves. One of the four variables in app.js that really were shared - the
// startup restore, the light/dark hotkey and the Appearance card all write it -
// so it gets a module, the same shape as lang.js and user.js: the values stay
// private, because an imported binding cannot be assigned to. setTheme takes
// only the fields that change.

import { FX } from './fx.js'

// Палитра задаётся одним значением целиком; mode выбирает, какая из двух
// сохранённых тем активна сейчас.
let themeMode  = 'dark'
let themeDark  = 'emerald-dark'
let themeLight = 'emerald-light'

export function getTheme() {
  return { mode: themeMode, dark: themeDark, light: themeLight }
}

export function setTheme({ mode = themeMode, dark = themeDark, light = themeLight }) {
  themeMode  = mode
  themeDark  = dark
  themeLight = light
}

export function applyTheme() {
  document.documentElement.dataset.theme = themeMode === 'light' ? themeLight : themeDark
  // Палитра эффектов строится из --accent, поэтому после смены темы холст
  // надо перерисовать.
  FX.refresh()
}

export async function toggleThemeMode() {
  themeMode = themeMode === 'light' ? 'dark' : 'light'
  await window.api.setSetting('theme_mode', themeMode)
  applyTheme()
}
