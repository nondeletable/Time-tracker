// The Appearance view: the theme card, the transition between modes, the
// background and its live preview. Its state is either the theme, which lives in
// theme.js, or data attributes on <html> that the rest of the renderer reads -
// so nothing here needs to be shared back, and app.js sees three entry points:
// open the view, apply a background at startup, and press one button of a
// segmented switch, which the language switch uses too.

import { FX } from './fx.js'
import { IDLE_FX } from './idle-fx.js'
import { getLang } from './lang.js'
import { getTheme, setTheme, applyTheme } from './theme.js'
import { flashSaved } from './flash.js'
import { getCurrentView } from './current-view.js'
import {
  tbtn, appearanceGrid, themeModeSw, themeLightSelect, themeDarkSelect,
  dotLight, dotDark, animSw, animSpeedSw, animSpeedRow, animReplay,
  fxParticlesSelect, fxBlobsSelect, fxIdleSw, fxPreview, langSw,
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

export function pressOne(container, attr, value) {
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

// Превью — не второй движок, а сокращённая модель существующего: те же пять
// вариантов частиц и четыре засветов, цвет из того же акцента. Без неё
// дропдаун не говорит ничего: «Эмиссия» и «Вселенная» названием не отличаются.
const fxCtx = fxPreview.getContext('2d')
const fxDots = Array.from({ length: 70 }, () => ({
  x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + .4,
  vx: (Math.random() - .5) * .0055, vy: (Math.random() - .5) * .0055,
  phase: Math.random() * 6.28
}))

function fitFxPreview() {
  const ratio = devicePixelRatio || 1
  const box = fxPreview.getBoundingClientRect()
  fxPreview.width  = box.width * ratio
  fxPreview.height = box.height * ratio
  fxCtx.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function accentRGBA(alpha) {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`
}

function drawFxPreview(time) {
  requestAnimationFrame(drawFxPreview)
  if (getCurrentView() !== 'appearance' || document.documentElement.dataset.mode !== 'dash') return

  const w = fxPreview.clientWidth
  const h = fxPreview.clientHeight
  if (!w || !h) return
  if (fxPreview.width !== Math.round(w * (devicePixelRatio || 1))) fitFxPreview()
  fxCtx.clearRect(0, 0, w, h)

  const blobs = document.documentElement.dataset.fxl
  if (blobs && blobs !== 'off') {
    const spots = blobs === 'bottom' ? [[.5, 1.15, .9]]
      : blobs === 'all' ? [[.2, .25, .55], [.8, .35, .5], [.5, 1.05, .8]]
      : [[.3 + Math.sin(time / 2600) * .16, .3, .6], [.72 + Math.cos(time / 3100) * .12, .55, .5]]
    spots.forEach(([bx, by, br]) => {
      const g = fxCtx.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, br * h)
      g.addColorStop(0, accentRGBA(blobs === 'aurora' ? .3 : .22))
      g.addColorStop(1, accentRGBA(0))
      fxCtx.fillStyle = g
      fxCtx.fillRect(0, 0, w, h)
    })
  }

  const particles = document.documentElement.dataset.fxp
  if (particles === 'grid') {
    fxCtx.strokeStyle = accentRGBA(.16)
    fxCtx.lineWidth = 1
    const step = 22
    const shift = (time / 90) % step
    for (let x = -step + shift; x < w; x += step) {
      fxCtx.beginPath(); fxCtx.moveTo(x, 0); fxCtx.lineTo(x, h); fxCtx.stroke()
    }
    for (let y = -step + shift; y < h; y += step) {
      fxCtx.beginPath(); fxCtx.moveTo(0, y); fxCtx.lineTo(w, y); fxCtx.stroke()
    }
  } else if (particles && particles !== 'off') {
    fxDots.forEach(p => {
      let x, y, alpha
      if (particles === 'emit') {
        const t = (time * .00004 + p.phase / 6.28) % 1
        x = w / 2 + Math.cos(p.phase) * t * w * .62
        y = h / 2 + Math.sin(p.phase) * t * h * .9
        alpha = (1 - t) * .75
      } else if (particles === 'universe') {
        x = p.x * w; y = p.y * h
        alpha = (Math.sin(time / 620 + p.phase) * .5 + .5) * .8
      } else {
        p.x = (p.x + p.vx / 60 + 1) % 1
        p.y = (p.y + p.vy / 60 + 1) % 1
        x = p.x * w; y = p.y * h; alpha = .45
      }
      fxCtx.fillStyle = accentRGBA(alpha)
      fxCtx.beginPath(); fxCtx.arc(x, y, p.r, 0, 6.29); fxCtx.fill()
    })
  }
}

requestAnimationFrame(drawFxPreview)
