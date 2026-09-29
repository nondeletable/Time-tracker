// The Appearance view: the theme card, the transition between modes, the
// background and its live preview. Its state is either the theme, which lives in
// theme.js, or data attributes on <html> that the rest of the renderer reads -
// so nothing here needs to be shared back, and app.js sees two entry points:
// open the view, and apply a background at startup.

import { FX } from './fx.js'
import { IDLE_FX } from './idle-fx.js'
import { getLang, t } from './lang.js'
import { getTheme, setTheme, applyTheme } from './theme.js'
import { flashSaved } from './flash.js'
import {
  tbtn, appearanceGrid, themeModeSw, themeLightSelect, themeDarkSelect,
  dotLight, dotDark, animSw, animSpeedSw, animSpeedRow, animReplay,
  fxParticlesSelect, fxBlobsSelect, fxIdleSw, langSw,
} from './dom.js'

export function applyFx(particles, leaks) {
  document.documentElement.dataset.fxp = particles
  document.documentElement.dataset.fxl = leaks
  FX.refresh()
}

// Точка у строки несёт акцент выбранной палитры: превью темы в дропдаун не
// положишь, а «Emerald» и «Indigo» названием ни о чём не говорят.
const THEME_ACCENTS = {
  'emerald-light': '#059669', 'emerald-dark': '#34d399',
  'indigo-light':  '#4f46e5', 'indigo-dark':  '#818cf8'
}

function pressOne(container, attr, value) {
  container.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset[attr] === value)))
}

function paintThemeCard() {
  const { mode, dark, light } = getTheme()
  themeLightSelect.value = light
  themeDarkSelect.value  = dark
  dotLight.style.background = THEME_ACCENTS[light]
  dotDark.style.background  = THEME_ACCENTS[dark]
  pressOne(themeModeSw, 'themeMode', mode)
}

export function loadAppearanceView() {
  paintThemeCard()
  pressOne(animSw, 'anim', document.documentElement.dataset.anim)
  pressOne(animSpeedSw, 'speed', document.documentElement.dataset.waveSpeed)
  animSpeedRow.classList.toggle('off', document.documentElement.dataset.anim === 'fade')
  fxParticlesSelect.value = document.documentElement.dataset.fxp || 'off'
  fxBlobsSelect.value     = document.documentElement.dataset.fxl || 'off'
  pressOne(fxIdleSw, 'fxIdle', document.documentElement.dataset.fxi)
  pressOne(langSw, 'lang', getLang())
  window.api.getHotkey().then(({ saved, active }) => paintHotkey(saved, saved !== active))
}

themeModeSw.addEventListener('click', async e => {
  const btn = e.target.closest('button')
  if (!btn) return
  setTheme({ mode: btn.dataset.themeMode })
  await window.api.setSetting('theme_mode', getTheme().mode)
  applyTheme()
  paintThemeCard()
})

themeLightSelect.addEventListener('change', async e => {
  setTheme({ light: e.target.value })
  await window.api.setSetting('theme_light', getTheme().light)
  applyTheme()
  paintThemeCard()
  flashSaved(e.target)
})

themeDarkSelect.addEventListener('change', async e => {
  setTheme({ dark: e.target.value })
  await window.api.setSetting('theme_dark', getTheme().dark)
  applyTheme()
  paintThemeCard()
  flashSaved(e.target)
})

// ── Переход между режимами ────────────────────────────────────────────────────

animSw.addEventListener('click', async e => {
  const btn = e.target.closest('button')
  if (!btn) return
  document.documentElement.dataset.anim = btn.dataset.anim
  await window.api.setSetting('ui_anim', btn.dataset.anim)
  pressOne(animSw, 'anim', btn.dataset.anim)
  animSpeedRow.classList.toggle('off', btn.dataset.anim === 'fade')
  flashSaved(btn)
  replayTransition()
})

animSpeedSw.addEventListener('click', async e => {
  const btn = e.target.closest('button')
  if (!btn) return
  document.documentElement.dataset.waveSpeed = btn.dataset.speed
  await window.api.setSetting('ui_wave_speed', btn.dataset.speed)
  pressOne(animSpeedSw, 'speed', btn.dataset.speed)
  flashSaved(btn)
  replayTransition()
})

// Прогоняет ту же анимацию, которой рождается вид при смене режима, прямо по
// карточкам Appearance: выбор виден сразу, без ухода из настроек и обратно.
function replayTransition() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const wave = document.documentElement.dataset.anim !== 'fade'
  const duration = Number(getComputedStyle(document.documentElement).getPropertyValue('--wave-ms')) || 900
  const origin = tbtn.getBoundingClientRect()
  const ox = origin.left + origin.width / 2
  const oy = origin.top + origin.height / 2
  const far = Math.hypot(innerWidth, innerHeight)

  appearanceGrid.classList.remove('wavein', 'fadein')
  void appearanceGrid.offsetWidth
  appearanceGrid.querySelectorAll('[data-wave]').forEach((el, i) => {
    const b = el.getBoundingClientRect()
    const delay = wave
      ? Math.hypot(b.left + b.width / 2 - ox, b.top + b.height / 2 - oy) / far * duration
      : 60 + i * 34
    el.style.setProperty('--wd', Math.round(delay) + 'ms')
  })
  appearanceGrid.classList.add(wave ? 'wavein' : 'fadein')
}

animReplay.addEventListener('click', replayTransition)

// ── Фон ───────────────────────────────────────────────────────────────────────

fxIdleSw.addEventListener('click', async e => {
  const btn = e.target.closest('button')
  if (!btn) return
  const state = btn.dataset.fxIdle
  document.documentElement.dataset.fxi = state
  await window.api.setSetting('fx_idle', state)
  pressOne(fxIdleSw, 'fxIdle', state)
  state === 'on' ? IDLE_FX.start() : IDLE_FX.stop()
  flashSaved(fxIdleSw)
})

fxParticlesSelect.addEventListener('change', async e => {
  await window.api.setSetting('fx_particles', e.target.value)
  applyFx(e.target.value, document.documentElement.dataset.fxl)
  flashSaved(e.target)
})

fxBlobsSelect.addEventListener('change', async e => {
  await window.api.setSetting('fx_blobs', e.target.value)
  applyFx(document.documentElement.dataset.fxp, e.target.value)
  flashSaved(e.target)
})


// ── Горячая клавиша ──────────────────────────────────────────────────────────

// Сочетание записывается нажатием: клик по полю включает запись, первое полное
// сочетание уходит в main, Esc и уход фокуса отменяют. Формат — accelerator
// Electron; проверяет его main (hotkey.js), здесь только сборка из события.
const hotkeyField = document.getElementById('hotkey-field')
const hotkeyClear = document.getElementById('hotkey-clear')
let hotkey = ''
let takenTimer = null

const KEY_NAMES = { CommandOrControl: 'Ctrl', Super: 'Win' }

// off — сочетание сохранено, но не работает: при запуске его уже держала
// другая программа. Показываем его с пометкой, чтобы было что перезаписать.
function paintHotkey(accel, off = false) {
  clearTimeout(takenTimer)
  hotkey = accel || ''
  hotkeyField.classList.remove('rec')
  hotkeyField.classList.toggle('none', !hotkey || off)
  const combo = hotkey.split('+').map(k => KEY_NAMES[k] || k).join(' + ')
  hotkeyField.textContent = !hotkey ? t('hotkey_none')
    : off ? `${combo} · ${t('hotkey_taken')}`
    : combo
  hotkeyClear.disabled = !hotkey
}

// null — нажата не завершённая комбинация: один модификатор, неподдержанная
// клавиша или клавиша без Ctrl, Alt и Win (Shift+буква — это просто набор
// текста, main такое не примет). Такие нажатия запись пропускает и ждёт дальше.
// AltGr в Windows приходит как Ctrl+Alt: записать его значило бы глобально
// отнять у раскладки символы вроде ś и €, поэтому такое нажатие тоже пропускаем.
function acceleratorFrom(e) {
  if (!e.ctrlKey && !e.altKey && !e.metaKey) return null
  if (e.getModifierState('AltGraph')) return null
  const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3)
    : /^Digit[0-9]$/.test(e.code) ? e.code.slice(5)
    : /^F([1-9]|1[0-9]|2[0-4])$/.test(e.code) ? e.code
    : e.code === 'Space' ? 'Space'
    : null
  if (!key) return null
  const mods = []
  if (e.ctrlKey)  mods.push('CommandOrControl')
  if (e.altKey)   mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey)  mods.push('Super')
  return [...mods, key].join('+')
}

async function saveHotkey(accel) {
  if (await window.api.setHotkey(accel)) {
    paintHotkey(accel)
    flashSaved(hotkeyField)
    return
  }
  hotkeyField.classList.remove('rec')
  hotkeyField.textContent = t('hotkey_taken')
  takenTimer = setTimeout(() => paintHotkey(hotkey), 1400)
}

hotkeyField.addEventListener('click', () => {
  clearTimeout(takenTimer)
  hotkeyField.classList.add('rec')
  hotkeyField.classList.remove('none')
  hotkeyField.textContent = t('hotkey_press')
})

// Пока идёт запись, нажатия не должны доходить до остальных хоткеев окна —
// Ctrl+L иначе переключил бы тему прямо во время выбора сочетания.
hotkeyField.addEventListener('keydown', e => {
  if (!hotkeyField.classList.contains('rec')) return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') { paintHotkey(hotkey); return }
  const accel = acceleratorFrom(e)
  if (accel) saveHotkey(accel)
})

hotkeyField.addEventListener('blur', () => {
  if (hotkeyField.classList.contains('rec')) paintHotkey(hotkey)
})

hotkeyClear.addEventListener('click', () => saveHotkey(''))
