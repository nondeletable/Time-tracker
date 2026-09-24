// The entry point of the renderer. i18n.js, dict.js and roles.js stay classic
// scripts loaded ahead of this one: node --test requires them as CommonJS, and a
// module runs after them anyway, so they publish I18N, DICT and ROLES on window
// exactly as before.
import { FX } from './fx.js'
import { IDLE_FX } from './idle-fx.js'
import {
  esc, formatTime, secsToHHMM, hhmmToSecs, todayISO, daysBetween,
} from './format.js'

let currentUser = null
let categories = []
let selectedCategoryId = null

let running = false
let startTime = 0
let elapsed = 0
let interval = null
let sessionStartedAt = null

let calYear  = 0
let calMonth = 0

let currentLang = 'ru'
// Палитра задаётся одним значением целиком; themeMode выбирает, какая из двух
// сохранённых тем активна сейчас.
let themeMode  = 'dark'
let themeDark  = 'emerald-dark'
let themeLight = 'emerald-light'

// Сегодняшние секунды, уже лежащие в базе. Ход текущего таймера прибавляется
// поверх — в базу он попадёт только после сохранения сессии.
let todaySeconds = 0
let dailyGoalSeconds = 8 * 3600
let lastStats = []

// Длина окружности прогресса: r=156 из viewBox кольца
const RING_LEN = 2 * Math.PI * 156


function applyTheme() {
  document.documentElement.dataset.theme = themeMode === 'light' ? themeLight : themeDark
  // Палитра эффектов строится из --accent, поэтому после смены темы холст
  // надо перерисовать.
  FX.refresh()
}

async function toggleThemeMode() {
  themeMode = themeMode === 'light' ? 'dark' : 'light'
  await window.api.setSetting('theme_mode', themeMode)
  applyTheme()
}

function applyFx(particles, leaks) {
  document.documentElement.dataset.fxp = particles
  document.documentElement.dataset.fxl = leaks
  FX.refresh()
}

function t(key) {
  return window.I18N.translate(window.DICT, currentLang, key)
}

// Названия месяцев и дней недели лежат массивами и через translate() не
// проходят. Для языков без своего словаря — DE и ES — отдаём английский, тем
// же правилом, по которому фолбэчит translate().
function langDict() {
  return window.DICT[currentLang] || window.DICT.en
}

function applyI18n() {
  document.documentElement.lang = currentLang
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'))
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')))
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')))
  })
  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    el.dataset.tip = t(el.getAttribute('data-i18n-tip'))
  })
  document.querySelectorAll('#sync-interval-select option').forEach(opt => {
    const min = Math.round(Number(opt.value) / 60)
    opt.textContent = `${min} ${t('sync_min')}`
  })
}

const userSelectScreen     = document.getElementById('user-select-screen')
const mainScreen           = document.getElementById('main-screen')
const focusLayer           = document.getElementById('layer-focus')
const chips                = document.getElementById('chips')
const dialCat              = document.getElementById('dial-cat')
const dialSub              = document.getElementById('dial-sub')
const prog                 = document.getElementById('prog')
const limitBarLabel        = document.getElementById('limit-bar-label')
const limitBarTime         = document.getElementById('limit-bar-time')
const limitBarFill         = document.getElementById('limit-bar-fill')
const expandBtn            = document.getElementById('expand')
const sheet                = document.getElementById('sheet')
const statLeftLabel        = document.getElementById('stat-left-label')
const statLeft             = document.getElementById('stat-left')
const statAvg              = document.getElementById('stat-avg')
const bars                 = document.getElementById('bars')
const timerDisplay         = document.getElementById('timer-display')
const timerBtn             = document.getElementById('timer-btn')
const resetBtn             = document.getElementById('reset-btn')
const saveDialog           = document.getElementById('save-dialog')
const dialogTime           = document.getElementById('dialog-time')
const dialogCategorySelect = document.getElementById('dialog-category-select')
const dialogCancel         = document.getElementById('dialog-cancel')
const dialogSave           = document.getElementById('dialog-save')
const appEl                = document.getElementById('app')
const tbtn                 = document.getElementById('tbtn')
const tglyph               = document.querySelector('.tglyph')
const ringEl               = document.getElementById('ring')
const dashLayer            = document.getElementById('layer-dash')
const dashTitle            = document.getElementById('dash-title')
const dock                 = document.getElementById('dock')
const dockCat              = document.getElementById('dock-cat')
const dockMenu             = document.getElementById('dock-menu')
const dockTime             = document.getElementById('dock-time')
const dockBtn              = document.getElementById('dock-btn')
const profileName          = document.getElementById('profile-name')
const avatarBtn            = document.getElementById('avatar-btn')
const avatarImg            = document.getElementById('avatar-img')
const avatarPop            = document.getElementById('avatar-pop')
const groupModeSw          = document.getElementById('group-mode-sw')
const groupCodeInput       = document.getElementById('group-code-input')
const groupGoBtn           = document.getElementById('group-go-btn')
const groupRoleTag         = document.getElementById('group-role-tag')
const groupCodeValue       = document.getElementById('group-code-value')
const syncIntervalSelect   = document.getElementById('sync-interval-select')
const syncIntervalHelp     = document.getElementById('sync-interval-help')
const syncNowBtn           = document.getElementById('sync-now-btn')
const groupLeaveBtn        = document.getElementById('group-leave-btn')
const limitLeftValue       = document.getElementById('limit-left-value')
const dailyGoalInput       = document.getElementById('daily-goal-input')
const limitInput           = document.getElementById('limit-input')
const periodStartInput     = document.getElementById('period-start-input')
const periodEndInput       = document.getElementById('period-end-input')
const catRows              = document.getElementById('cat-rows')
const catEmpty             = document.getElementById('cat-empty')
const catAddBtn            = document.getElementById('cat-add-btn')
const catTabs              = document.getElementById('cat-tabs')
const hoursRows            = document.getElementById('hours-rows')
const hoursEmpty           = document.getElementById('hours-empty')
const hoursAddBtn          = document.getElementById('hours-add-btn')
const hoursDateInput       = document.getElementById('hours-date-input')
const appearanceGrid       = document.getElementById('appearance-grid')
const themeModeSw          = document.getElementById('theme-mode-sw')
const themeLightSelect     = document.getElementById('theme-light-select')
const themeDarkSelect      = document.getElementById('theme-dark-select')
const dotLight             = document.getElementById('dot-light')
const dotDark              = document.getElementById('dot-dark')
const animSw               = document.getElementById('anim-sw')
const animSpeedSw          = document.getElementById('anim-speed-sw')
const animSpeedRow         = document.getElementById('anim-speed-row')
const animReplay           = document.getElementById('anim-replay')
const fxParticlesSelect    = document.getElementById('fx-particles-select')
const fxBlobsSelect        = document.getElementById('fx-blobs-select')
const fxIdleSw             = document.getElementById('fx-idle-sw')
const fxPreview            = document.getElementById('fx-preview')
const langSw               = document.getElementById('lang-sw')

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const savedLang = await window.api.getSetting('lang')
  currentLang = savedLang || window.I18N.detectLang(navigator.language)
  if (!savedLang) await window.api.setSetting('lang', currentLang)
  applyI18n()

  const savedMode  = await window.api.getSetting('theme_mode')
  const savedDark  = await window.api.getSetting('theme_dark')
  const savedLight = await window.api.getSetting('theme_light')
  themeMode  = savedMode  || themeMode
  themeDark  = savedDark  || themeDark
  themeLight = savedLight || themeLight
  if (!savedMode)  await window.api.setSetting('theme_mode', themeMode)
  if (!savedDark)  await window.api.setSetting('theme_dark', themeDark)
  if (!savedLight) await window.api.setSetting('theme_light', themeLight)
  applyTheme()

  // Режим запоминается, активный вид — нет: Dashboard всегда открывается Сводкой
  const savedUiMode = await window.api.getSetting('ui_mode')
  document.documentElement.dataset.mode = savedUiMode === 'dash' ? 'dash' : 'focus'
  if (!savedUiMode) await window.api.setSetting('ui_mode', 'focus')
  if (savedUiMode === 'dash') spinT(0)
  setView('summary')
  paintDock()

  // Дневная цель локальная и не синхронизируется: общий лимит — ограничение
  // на двоих, а норма дня у каждого своя.
  const savedGoal = await window.api.getSetting('daily_goal_seconds')
  if (savedGoal) dailyGoalSeconds = Number(savedGoal)
  else await window.api.setSetting('daily_goal_seconds', String(dailyGoalSeconds))

  const savedFxP = await window.api.getSetting('fx_particles')
  const savedBlobs = await window.api.getSetting('fx_blobs')
  applyFx(savedFxP || 'universe', savedBlobs || 'all')
  const savedIdle = await window.api.getSetting('fx_idle')
  document.documentElement.dataset.fxi = savedIdle || 'on'

  // Тип и скорость перехода — две настройки, а не одна: иначе Fade затирал бы
  // выбранную скорость, и при возврате к Wave пользователь получал бы дефолт.
  const savedAnim  = await window.api.getSetting('ui_anim')
  const savedSpeed = await window.api.getSetting('ui_wave_speed')
  document.documentElement.dataset.anim = savedAnim || 'wave'
  document.documentElement.dataset.waveSpeed = savedSpeed || 'med'
  if (!savedAnim)  await window.api.setSetting('ui_anim', 'wave')
  if (!savedSpeed) await window.api.setSetting('ui_wave_speed', 'med')

  const userName = await window.api.getSetting('user_name')
  if (userName) {
    currentUser = userName
    await showMainScreen()
  } else {
    await showUserSelect()
  }
}

async function showUserSelect() {
  const input = document.getElementById('onboarding-name-input')
  const btn   = document.getElementById('onboarding-continue')
  input.value = (await window.api.getDefaultName()) || ''
  const sync = () => { btn.disabled = input.value.trim().length === 0 }
  sync()
  input.addEventListener('input', sync)
  const confirm = async () => {
    const name = input.value.trim()
    if (!name) return
    currentUser = name
    await window.api.setSetting('user_name', name)
    userSelectScreen.classList.add('hidden')
    await showMainScreen()
  }
  btn.addEventListener('click', confirm)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm() })
  userSelectScreen.classList.remove('hidden')
}

async function showMainScreen() {
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await restoreSelectedCategory()
  await refreshStats()
  mainScreen.classList.remove('hidden')
  // После показа экрана, а не раньше: кольцо и полоса до этого скрыты, а
  // движку нужна уже посчитанная заливка обоих.
  if (document.documentElement.dataset.fxi === 'on') IDLE_FX.start()
}

// Выбранная категория переживает перезапуск. Без этого Start после запуска
// всегда оставался заблокированным, даже если человек весь день работал в
// одной категории. Категорию, удалённую за время простоя, молча пропускаем:
// Start тогда просто не разблокируется, как при первом запуске.
async function restoreSelectedCategory() {
  const saved = Number(await window.api.getSetting('selected_category_id'))
  if (!saved || !categories.some(c => c.id === saved)) return
  selectCategory(saved)
}

// ── Categories ────────────────────────────────────────────────────────────────

function renderCategories() {
  // Часы на бейдже берутся из той же статистики, что рисует панель «Подробно»,
  // отдельного запроса на это не нужно. Сопоставление по id: одноимённые
  // категории больше не склеиваются.
  const hours = new Map(lastStats.map(row => [row.category_id, row.total]))
  chips.innerHTML = ''
  categories.forEach(cat => {
    const btn = document.createElement('button')
    btn.className = 'chip'
    btn.dataset.id = cat.id
    btn.setAttribute('aria-pressed', String(cat.id === selectedCategoryId))
    const spent = hours.get(cat.id)
    btn.innerHTML = `
      <span class="sw" style="background:${esc(cat.color)}"></span>${esc(cat.name)}
      ${spent ? `<span class="h">${formatHM(spent)}</span>` : ''}
    `
    btn.addEventListener('click', () => selectCategory(cat.id))
    chips.appendChild(btn)
  })
}

function renderDialogCategories() {
  dialogCategorySelect.innerHTML = ''
  categories.forEach(cat => {
    const opt = document.createElement('option')
    opt.value = cat.id
    opt.textContent = cat.name
    dialogCategorySelect.appendChild(opt)
  })
}

function selectCategory(id) {
  if (running) return
  selectedCategoryId = id
  chips.querySelectorAll('.chip').forEach(el => {
    el.setAttribute('aria-pressed', String(Number(el.dataset.id) === id))
  })
  const cat = categories.find(c => c.id === id)
  dialCat.innerHTML = cat
    ? `<span class="sw" style="background:${esc(cat.color)}"></span>${esc(cat.name)}`
    : ''
  timerBtn.disabled = false
  dialogCategorySelect.value = id
  paintDock()
  window.api.setSetting('selected_category_id', String(id))
}

// ── Stats ─────────────────────────────────────────────────────────────────────

// Без секунд: на бейджах, в кольце и в подвале они только шумят.
// Нулевая часть тоже опускается — «160ч», а не «160ч 0м».
function formatHM(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (!h) return `${m}${t('unit_m')}`
  if (!m) return `${h}${t('unit_h')}`
  return `${h}${t('unit_h')} ${m}${t('unit_m')}`
}


async function refreshStats() {
  const [stats, sharedTotal, period, todaySessions] = await Promise.all([
    window.api.getMonthlyStats(currentUser),
    window.api.getSharedTotal(),
    window.api.getPeriodSettings(),
    window.api.getSessionsByDate(currentUser, todayISO()),
  ])
  lastStats = stats
  todaySeconds = todaySessions.reduce((sum, s) => sum + s.duration_seconds, 0)
  renderLimitBar(sharedTotal, period)
  renderStats(stats)
  renderCategories()
  paintRing()
  // Док рисуется и в init(), до загрузки категорий: без этого вызова дропдаун
  // категории так и остался бы заблокированным до первого события таймера.
  paintDock()
  renderAverage(await periodBreakdown(period))
  if (currentView === 'summary') await loadSummaryView()
}

// Период не совпадает с календарным месяцем (28 авг — 27 сен пересекает два),
// поэтому собираем каждый месяц, который он задевает, и отбрасываем дни за
// границами. getCalendarMonth отдаёт сразу и свои сессии, и данные партнёра,
// так что суммы получаются общими на двоих — как и полоса лимита рядом.
async function periodBreakdown(period) {
  const [sy, sm] = period.period_start.split('-').map(Number)
  const [ey, em] = period.period_end.split('-').map(Number)

  const months = []
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push([y, m])
    m++
    if (m > 12) { m = 1; y++ }
  }

  const rows = (await Promise.all(
    months.map(([yy, mm]) => window.api.getCalendarMonth(yy, mm))
  )).flat()

  const perDay = new Map()
  // Участники не хардкодятся: кто встретился в данных, тот и попадёт в полосу
  const perUser = new Map()
  rows.forEach(row => {
    if (row.day < period.period_start || row.day > period.period_end) return
    const seconds = row.total_seconds || 0
    perDay.set(row.day, (perDay.get(row.day) || 0) + seconds)
    perUser.set(row.user, (perUser.get(row.user) || 0) + seconds)
  })

  const worked = [...perDay.values()].filter(v => v > 0)
  const total = worked.reduce((a, b) => a + b, 0)

  return {
    perDay,
    perUser,
    activeDays: worked.length,
    avg: worked.length ? Math.round(total / worked.length) : 0,
  }
}

function renderAverage({ activeDays, avg }) {
  statAvg.innerHTML = activeDays
    ? `${formatHM(avg)} <small>· ${activeDays} ${t('stat_days')}</small>`
    : '—'
}

function renderLimitBar(totalSeconds, period) {
  const limit = period.monthly_limit_seconds
  const over  = totalSeconds > limit

  let pct
  if (!over) {
    pct = limit > 0 ? Math.round((totalSeconds / limit) * 100) : 0
  } else {
    // перезаполняем красным: показываем сколько сверх лимита
    const overflow = totalSeconds - limit
    pct = Math.min(Math.round((overflow / limit) * 100), 100)
  }

  limitBarFill.style.width = pct + '%'
  limitBarFill.classList.toggle('over', over)
  limitBarTime.innerHTML = `${formatHM(totalSeconds)} <span class="of">/ ${formatHM(limit)}</span>`
  limitBarTime.classList.toggle('over', over)

  const fmtDate = iso => {
    const [, m, d] = iso.split('-')
    const months = langDict().months_short
    return `${Number(d)} ${months[Number(m) - 1]}`
  }
  limitBarLabel.textContent = `${fmtDate(period.period_start)} — ${fmtDate(period.period_end)}`

  // «Осталось» живёт в той же арифметике, что и полоса, поэтому считается здесь
  const left = limit - totalSeconds
  statLeftLabel.textContent = over ? t('stat_over') : t('stat_left')
  statLeft.textContent = formatHM(Math.abs(left))
}

// Полосы по категориям в панели «Подробно»: длина относительно первой строки,
// stats приходит уже отсортированным по убыванию.
function renderStats(stats) {
  bars.innerHTML = ''
  if (!stats.length) return

  const maxTotal = stats[0].total

  stats.slice(0, 5).forEach(row => {
    const pct = Math.round((row.total / maxTotal) * 100)
    const item = document.createElement('div')
    item.className = 'bars-row'
    item.innerHTML = `
      <span class="n">${esc(row.name)}</span>
      <span class="t"><span style="width:${pct}%;background:${esc(row.color)}"></span></span>
      <span class="v">${formatHM(row.total)}</span>
    `
    bars.appendChild(item)
  })
}

// Кольцо и подпись под таймером: доля сегодняшнего времени от дневной цели
function paintRing() {
  const done = todaySeconds + (running ? Math.floor((Date.now() - startTime + elapsed) / 1000) : Math.floor(elapsed / 1000))
  const share = dailyGoalSeconds > 0 ? Math.min(done / dailyGoalSeconds, 1) : 0
  prog.style.strokeDasharray  = RING_LEN
  prog.style.strokeDashoffset = RING_LEN * (1 - share)
  dialSub.textContent = t('focus_sub')
    .replace('{done}', formatHM(done))
    .replace('{goal}', formatHM(dailyGoalSeconds))
}

// ── Timer ─────────────────────────────────────────────────────────────────────


function tick() {
  timerDisplay.textContent = formatTime(elapsed + (Date.now() - startTime))
  paintRing()
  paintDock()
}

function start() {
  running = true
  startTime = Date.now()
  if (elapsed === 0) sessionStartedAt = startTime
  interval = setInterval(tick, 500)
  timerBtn.textContent = t('timer_stop')
  timerBtn.classList.add('stop')
  focusLayer.classList.add('running')
  resetBtn.classList.add('hidden')
  paintRing()
  paintDock()
}

function stopTimer() {
  running = false
  elapsed += Date.now() - startTime
  clearInterval(interval)
  interval = null
  timerDisplay.textContent = formatTime(elapsed)
  timerBtn.textContent = t('timer_start')
  timerBtn.classList.remove('stop')
  focusLayer.classList.remove('running')
  resetBtn.classList.remove('hidden')
  paintRing()
  paintDock()
  openSaveDialog()
}

function resetTimer() {
  elapsed = 0
  sessionStartedAt = null
  timerDisplay.textContent = '00:00:00'
  resetBtn.classList.add('hidden')
  paintRing()
  paintDock()
}

timerBtn.addEventListener('click', () => {
  if (running) stopTimer()
  else start()
})

resetBtn.addEventListener('click', () => {
  if (!running) resetTimer()
})

expandBtn.addEventListener('click', () => {
  const open = sheet.classList.toggle('open')
  focusLayer.classList.toggle('sheet-open', open)
  expandBtn.textContent = t(open ? 'focus_collapse' : 'focus_expand')
})

// ── Режимы и виды ─────────────────────────────────────────────────────────────

const VIEW_TITLES = {
  summary:    'title_summary',
  calendar:   'nav_calendar',
  settings:   'nav_settings',
  appearance: 'nav_appearance',
  about:      'nav_about'
}

let currentView = 'summary'
let modeBusy = false
let tGlyphTurns = 0

function setView(view) {
  currentView = view
  railButtons.forEach(b => b.setAttribute('aria-current', String(b.dataset.nav === view)))
  dashViews.forEach(v => v.classList.toggle('on', v.dataset.view === view))
  dashTitle.dataset.i18n = VIEW_TITLES[view]
  dashTitle.textContent = t(VIEW_TITLES[view])
  if (view === 'summary') loadSummaryView()
  if (view === 'calendar') loadCalendarView()
  if (view === 'settings') loadSettingsView()
  if (view === 'appearance') loadAppearanceView()
}

// Свитчер светлая/тёмная: тот же, что будет у кнопки в Appearance
document.addEventListener('keydown', e => {
  if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    toggleThemeMode()
  }
})

const railButtons = [...document.querySelectorAll('[data-nav]')]
const dashViews   = [...document.querySelectorAll('.view')]

railButtons.forEach(b => b.addEventListener('click', () => setView(b.dataset.nav)))

// Вращается только буква: она доворачивает 180° и остаётся в новом положении —
// ровная значит Focus, перевёрнутая Dashboard. Квадрат пульсирует, он же origin
// волны.
function spinT(duration) {
  tGlyphTurns++
  tglyph.style.transitionDuration = Math.min(duration, 700) + 'ms'
  tglyph.style.transform = `rotate(${tGlyphTurns * 180}deg)`
  tbtn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: .28 },
     { transform: 'scale(1.07)', offset: .58 }, { transform: 'scale(1)' }],
    { duration: Math.min(duration, 620), easing: 'cubic-bezier(.16,1,.3,1)' }
  )
}

// Режим Fade: волны нет — уходящий слой гаснет, входящий проявляется снизу
// вверх с подрастанием.
function fadeSwap(from, to) {
  modeBusy = true
  appEl.classList.add('anim')
  from.classList.add('leaving')
  to.classList.add('fading')
  to.querySelectorAll('[data-wave]').forEach((el, i) => el.style.setProperty('--wd', 90 + i * 26 + 'ms'))

  // fill:'forwards' держит прозрачность и после конца анимации, поэтому её
  // обязательно снять: иначе уходящий слой навсегда остаётся с opacity 0 и
  // при следующем переключении экран оказывается пустым.
  const out = from.animate([{ opacity: 1 }, { opacity: 0 }],
    { duration: 240, easing: 'ease-in', fill: 'forwards' })

  setTimeout(() => {
    out.cancel()
    from.classList.remove('leaving')
    appEl.classList.remove('anim')
    to.classList.remove('fading')
    to.querySelectorAll('[data-wave]').forEach(el => el.style.removeProperty('--wd'))
    modeBusy = false
    FX.refresh()
  }, 900)
}

async function setMode(next) {
  const root = document.documentElement
  if (root.dataset.mode === next || modeBusy) return
  IDLE_FX.fade()

  await window.api.setSetting('ui_mode', next)

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.dataset.mode = next
    FX.refresh()
    return
  }

  if (root.dataset.anim === 'fade') {
    const from = next === 'dash' ? focusLayer : dashLayer
    const to   = next === 'dash' ? dashLayer  : focusLayer
    root.dataset.mode = next
    spinT(560)
    fadeSwap(from, to)
    return
  }

  modeBusy = true
  const appBox = appEl.getBoundingClientRect()
  const tBox   = tbtn.getBoundingClientRect()
  const ox = tBox.left - appBox.left + tBox.width / 2
  const oy = tBox.top - appBox.top + tBox.height / 2

  // Радиус до самого дальнего угла: волна обязана накрыть окно целиком
  const R = Math.max(
    Math.hypot(ox, oy), Math.hypot(appBox.width - ox, oy),
    Math.hypot(ox, appBox.height - oy), Math.hypot(appBox.width - ox, appBox.height - oy)
  )
  const duration = Number(getComputedStyle(root).getPropertyValue('--wave-ms')) || 900
  const speed = R / duration

  const to = next === 'dash' ? dashLayer : focusLayer
  appEl.classList.add('anim')
  to.classList.add('incoming')
  root.dataset.mode = next

  to.querySelectorAll('[data-wave]').forEach(el => {
    const b = el.getBoundingClientRect()
    const cx = b.left - appBox.left + b.width / 2
    const cy = b.top - appBox.top + b.height / 2
    el.style.setProperty('--wd', Math.max(0, Math.hypot(cx - ox, cy - oy) / speed - 70) + 'ms')
  })

  spinT(duration)

  ringEl.style.cssText = `left:${ox}px; top:${oy}px; width:0; height:0; transform:translate(-50%,-50%); opacity:1`
  ringEl.animate(
    [{ width: '0px', height: '0px', opacity: .9 }, { width: R * 2 + 'px', height: R * 2 + 'px', opacity: 0 }],
    { duration, easing: 'linear', fill: 'forwards' }
  )

  to.animate(
    [{ clipPath: `circle(0px at ${ox}px ${oy}px)` }, { clipPath: `circle(${R}px at ${ox}px ${oy}px)` }],
    { duration, easing: 'linear' }
  ).finished.finally(() => {
    appEl.classList.remove('anim')
    to.classList.remove('incoming')
    to.querySelectorAll('[data-wave]').forEach(el => el.style.removeProperty('--wd'))
    ringEl.style.opacity = 0
    modeBusy = false
    FX.refresh()
  })
}

tbtn.addEventListener('click', () => {
  setMode(document.documentElement.dataset.mode === 'focus' ? 'dash' : 'focus')
})

// Док показывает то же состояние, что кольцо в Focus: это один таймер.
function paintDock() {
  const cat = categories.find(c => c.id === selectedCategoryId)
  // Без выбранной категории кнопка была бы пустой, и открыть список нечем
  dockCat.innerHTML = cat
    ? `<span class="sw" style="background:${esc(cat.color)}"></span>${esc(cat.name)} ▾`
    : `<span class="sw" style="background:var(--surface-2)"></span>${t('dock_category')} ▾`
  // На ходу категорию не меняют — то же правило, что у чипсов в Focus
  dockCat.disabled = running || categories.length === 0
  if (running) dockMenu.classList.add('hidden')
  dockTime.textContent = timerDisplay.textContent
  dock.classList.toggle('running', running)
  dockBtn.classList.toggle('stop', running)
  dockBtn.textContent = running ? 'STOP' : 'START'
  dockBtn.disabled = timerBtn.disabled
}

// Выбор категории прямо в Dashboard: без него за ней приходится уходить в Focus
dockCat.addEventListener('click', e => {
  e.stopPropagation()
  if (dockCat.disabled) return
  dockMenu.innerHTML = categories.map(cat =>
    `<button data-id="${cat.id}" aria-pressed="${cat.id === selectedCategoryId}">
       <span class="sw" style="background:${esc(cat.color)}"></span>${esc(cat.name)}</button>`
  ).join('')
  dockMenu.classList.toggle('hidden')
})

dockMenu.addEventListener('click', e => {
  const btn = e.target.closest('button[data-id]')
  if (!btn) return
  selectCategory(Number(btn.dataset.id))
  dockMenu.classList.add('hidden')
})

document.addEventListener('click', () => dockMenu.classList.add('hidden'))

dockBtn.addEventListener('click', () => {
  if (running) stopTimer()
  else start()
})

// ── Save dialog ───────────────────────────────────────────────────────────────

function openSaveDialog() {
  dialogTime.textContent = formatTime(elapsed)
  if (selectedCategoryId) dialogCategorySelect.value = selectedCategoryId
  saveDialog.classList.remove('hidden')
}

dialogCancel.addEventListener('click', () => {
  saveDialog.classList.add('hidden')
})

dialogSave.addEventListener('click', async () => {
  const categoryId = Number(dialogCategorySelect.value)
  const endedAt = Date.now()
  const startedAt = sessionStartedAt ?? (endedAt - elapsed)

  await window.api.saveSession({
    user: currentUser,
    category_id: categoryId,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: Math.floor(elapsed / 1000)
  })

  saveDialog.classList.add('hidden')
  resetTimer()
  await refreshStats()
})

// ── Вид «Настройки» ───────────────────────────────────────────────────────────

const ICONS = '../../assets/icons/'

const AVATAR_FILES = [
  'user.svg', 'man.png', 'man_1.png', 'man_2.png', 'man_3.png',
  'woman.png', 'woman_1.png', 'woman_2.png', 'woman_3.png'
]

const CAT_COLORS = [
  '#60a5fa', '#c084fc', '#fb923c', '#f472b6', '#f87171',
  '#34d399', '#EFF74A', '#2AF720', '#3020F5'
]



function formatLastSync(ts) {
  if (!ts) return '—'
  const d   = new Date(ts)
  const now = new Date()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  if (d.toDateString() === now.toDateString()) return `${t('today_at')} ${hh}:${mm}`
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mo}.${d.getFullYear()} ${hh}:${mm}`
}

// Кнопок «Сохранить» в карточках нет: значение уходит в базу по change, а
// справа от подписи коротко мигает «сохранено».
function flashSaved(el) {
  const mark = el?.closest('.row')?.querySelector('.saved')
  if (!mark) return
  mark.classList.add('on')
  clearTimeout(mark._t)
  mark._t = setTimeout(() => mark.classList.remove('on'), 1400)
}

// ── Подсказки ─────────────────────────────────────────────────────────────────

const tipEl = document.createElement('div')
tipEl.className = 'tip'
document.body.appendChild(tipEl)

document.addEventListener('mouseover', e => {
  const help = e.target.closest('.help')
  if (!help) return
  tipEl.textContent = help.dataset.tip || ''
  tipEl.classList.add('on')
  // Границы берём у окна приложения: дальше рамки подсказке уходить некуда
  const r = help.getBoundingClientRect()
  const box = tipEl.getBoundingClientRect()
  const a = appEl.getBoundingClientRect()
  let y = r.top - box.height - 8
  if (y < a.top + 8) y = r.bottom + 8
  tipEl.style.left = Math.max(a.left + 8, Math.min(r.left - 6, a.right - box.width - 8)) + 'px'
  tipEl.style.top  = Math.min(y, a.bottom - box.height - 8) + 'px'
})

document.addEventListener('mouseout', e => {
  if (e.target.closest('.help')) tipEl.classList.remove('on')
})

// ── Поля даты ─────────────────────────────────────────────────────────────────

// Нативное поле в браузерной локали рисует «28 Aug 2026» и требует ~110px, а
// колонка на минимальной ширине даёт 77 — год обрезался. Показываем день и
// месяц, год живёт в значении и всплывает подсказкой.
function paintDateField(input) {
  const val = input.previousElementSibling
  if (!val || !input.value) return
  val.textContent = input.value.slice(8, 10) + '.' + input.value.slice(5, 7)
  input.title = input.value
}

document.querySelectorAll('.date-f input').forEach(input => {
  input.addEventListener('click', () => { try { input.showPicker() } catch { /* unsupported, or blocked outside a user gesture */ } })
})

// ── Карточка «Профиль» ────────────────────────────────────────────────────────

let avatarFile  = 'user.svg'
let groupJoined = false

function renderAvatar() {
  avatarImg.src = ICONS + avatarFile
  avatarPop.innerHTML = AVATAR_FILES.map(file =>
    `<img src="${ICONS}${file}" data-file="${file}" class="${file === avatarFile ? 'on' : ''}" alt="">`
  ).join('')
}

function renderGroupRows(mode) {
  const group = mode === 'group'
  document.querySelectorAll('.g-new').forEach(r => r.classList.toggle('hidden', !group || groupJoined))
  document.querySelectorAll('.g-in').forEach(r => r.classList.toggle('hidden', !group || !groupJoined))
  groupModeSw.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.groupMode === mode)))
}

async function loadProfileCard() {
  profileName.value = currentUser
  avatarFile = (await window.api.getSetting(`avatar_${currentUser}`)) ?? 'user.svg'
  renderAvatar()

  const role = (await window.api.getSetting('group_role')) || 'solo'
  groupJoined = window.ROLES.isGrouped(role)
  groupCodeValue.textContent = (await window.api.getSetting('group_code')) || ''
  groupRoleTag.textContent = t(`group_role_${role}`)

  if (groupJoined) {
    syncIntervalSelect.value = String((await window.api.getSyncInterval()) || 300)
    // Время последней синхронизации не занимает строку — дописано в подсказку
    const ts = await window.api.getLastSync()
    syncIntervalHelp.dataset.tip = `${t('tip_sync_interval')}\n\n${t('sync_last')} ${formatLastSync(ts)}`
  }
  renderGroupRows(groupJoined ? 'group' : 'solo')
}

avatarBtn.addEventListener('click', e => {
  e.stopPropagation()
  avatarPop.classList.toggle('hidden')
})

avatarPop.addEventListener('click', async e => {
  const img = e.target.closest('img')
  if (!img) return
  avatarFile = img.dataset.file
  await window.api.setSetting(`avatar_${currentUser}`, avatarFile)
  renderAvatar()
  avatarPop.classList.add('hidden')
})

document.addEventListener('click', () => avatarPop.classList.add('hidden'))

profileName.addEventListener('change', async () => {
  const name = profileName.value.trim()
  if (!name) {
    profileName.value = currentUser
    return
  }
  await window.api.renameUser(name)
  currentUser = name
  await refreshStats()
})

groupModeSw.addEventListener('click', e => {
  const btn = e.target.closest('button')
  if (!btn) return
  if (btn.dataset.groupMode === 'solo' && !groupJoined) groupCodeInput.value = ''
  renderGroupRows(btn.dataset.groupMode)
})

// Пустое поле — «Создать» и роль owner, чужой код — «Войти» и роль member
groupCodeInput.addEventListener('input', () => {
  groupGoBtn.textContent = t(groupCodeInput.value.trim() ? 'btn_group_join' : 'btn_group_create')
})

groupGoBtn.addEventListener('click', async () => {
  const code = groupCodeInput.value.trim().toUpperCase()
  if (code) {
    if (code.length < 4) return
    await window.api.joinGroup(code)
  } else {
    await window.api.createGroup()
  }
  await loadProfileCard()
  await loadTimeCard()
  await refreshStats()
})

groupLeaveBtn.addEventListener('click', async () => {
  await window.api.leaveGroup()
  groupCodeInput.value = ''
  groupGoBtn.textContent = t('btn_group_create')
  await loadProfileCard()
  await loadTimeCard()
  await refreshStats()
})

syncNowBtn.addEventListener('click', () => window.api.syncNow())

syncIntervalSelect.addEventListener('change', async e => {
  await window.api.setSyncInterval(Number(e.target.value))
})

// ── Карточка «Учёт времени» ───────────────────────────────────────────────────

async function loadTimeCard() {
  dailyGoalInput.value = dailyGoalSeconds / 3600

  const period = await window.api.getPeriodSettings()
  limitInput.value = Math.round(period.monthly_limit_seconds / 3600)
  periodStartInput.value = period.period_start
  periodEndInput.value   = period.period_end
  paintDateField(periodStartInput)
  paintDateField(periodEndInput)

  const total = await window.api.getSharedTotal()
  limitLeftValue.textContent = secsToHHMM(Math.max(0, period.monthly_limit_seconds - total))

  // Норма дня личная и правится всегда, лимит и период — только владельцем
  const role = (await window.api.getSetting('group_role')) || 'solo'
  const editable = window.ROLES.canEditLimit(role)
  limitInput.disabled = !editable
  periodStartInput.disabled = !editable
  periodEndInput.disabled = !editable
}

dailyGoalInput.addEventListener('change', async e => {
  const hours = Number(e.target.value)
  if (!hours || hours < 1 || hours > 24) {
    e.target.value = dailyGoalSeconds / 3600
    return
  }
  dailyGoalSeconds = Math.round(hours * 3600)
  await window.api.setSetting('daily_goal_seconds', String(dailyGoalSeconds))
  paintRing()
  flashSaved(e.target)
})

limitInput.addEventListener('change', async e => {
  const hours = parseInt(e.target.value, 10)
  if (!hours || hours < 1) return
  await window.api.setSetting('monthly_limit_seconds', String(hours * 3600))
  await refreshStats()
  await loadTimeCard()
  flashSaved(e.target)
})

;[periodStartInput, periodEndInput].forEach(input => {
  input.addEventListener('change', async () => {
    const start = periodStartInput.value
    const end   = periodEndInput.value
    if (!start || !end || end < start) {
      await loadTimeCard()
      return
    }
    await window.api.setSetting('period_start', start)
    await window.api.setSetting('period_end', end)
    paintDateField(input)
    await refreshStats()
    await loadTimeCard()
    flashSaved(input)
  })
})

// ── Карточка «Категории» ──────────────────────────────────────────────────────

let catTab = 'active'

// Удаление подтверждается инлайново, в той же ячейке
function actsCell(buttons) {
  return `<td class="acts">
      <span class="btns">${buttons}</span>
      <span class="confirm hidden"><span class="q">${t('confirm_delete_q')}</span>
        <button class="btn-s danger" data-do="yes">${t('btn_yes')}</button>
        <button class="btn-s" data-do="no">${t('btn_no')}</button></span>
    </td>`
}

function editDeleteButtons() {
  return `<button class="btn-s" data-do="edit">${t('btn_edit')}</button>` +
         `<button class="btn-s danger" data-do="del">${t('btn_delete')}</button>`
}

function catFormRow(id, name, color) {
  return `<tr class="form-row" data-form-id="${id ?? ''}">
      <td colspan="2">
        <div class="ed">
          <input class="inp cat-name" value="${name}" placeholder="${t('cat_name_placeholder')}" style="flex:1;min-width:0">
          <button class="swatch" data-do="palette" data-color="${color}" style="background:${color}"></button>
          <button class="btn-s" data-do="cancel">${t('btn_cancel')}</button>
          <button class="btn-s primary" data-do="save">${t('btn_save')}</button>
        </div>
        <div class="palette hidden">${CAT_COLORS.map(c => `<i style="background:${c}" data-color="${c}"></i>`).join('')}</div>
      </td></tr>`
}

async function renderCatTable() {
  const list = catTab === 'active'
    ? await window.api.getCategories()
    : await window.api.getDeletedCategories()

  catRows.innerHTML = list.map(cat => catTab === 'active'
    ? `<tr data-id="${cat.id}" data-name="${esc(cat.name)}" data-color="${esc(cat.color)}">
         <td><span class="nm"><i style="background:${esc(cat.color)}"></i>${esc(cat.name)}</span></td>
         ${actsCell(editDeleteButtons())}</tr>`
    : `<tr data-id="${cat.id}"><td><span class="nm">${esc(cat.name)}</span></td>
         <td class="acts"><button class="btn-s" data-do="restore">${t('btn_restore')}</button></td></tr>`
  ).join('')

  catEmpty.classList.toggle('hidden', !(catTab === 'deleted' && list.length === 0))
  catAddBtn.classList.toggle('hidden', catTab === 'deleted')
}

async function refreshAfterCategoryChange() {
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await renderCatTable()
  await refreshStats()
}

catTabs.addEventListener('click', e => {
  const btn = e.target.closest('button')
  if (!btn) return
  catTab = btn.dataset.catTab
  catTabs.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', String(b === btn)))
  renderCatTable()
})

catAddBtn.addEventListener('click', () => {
  catRows.querySelectorAll('.form-row').forEach(r => r.remove())
  catRows.insertAdjacentHTML('beforeend', catFormRow(null, '', CAT_COLORS[0]))
  catRows.querySelector('.form-row .cat-name').focus()
})

catRows.addEventListener('click', async e => {
  const swatch = e.target.closest('.palette i')
  if (swatch) {
    const form = swatch.closest('.form-row')
    const target = form.querySelector('.swatch')
    target.style.background = swatch.dataset.color
    target.dataset.color = swatch.dataset.color
    form.querySelector('.palette').classList.add('hidden')
    return
  }

  const btn = e.target.closest('button[data-do]')
  if (!btn) return
  const row = btn.closest('tr')
  const id  = Number(row.dataset.id)

  switch (btn.dataset.do) {
    case 'del':
      row.querySelector('.btns').classList.add('hidden')
      row.querySelector('.confirm').classList.remove('hidden')
      break
    case 'no':
      row.querySelector('.confirm').classList.add('hidden')
      row.querySelector('.btns').classList.remove('hidden')
      break
    case 'yes':
      await window.api.softDeleteCategory(id)
      await refreshAfterCategoryChange()
      break
    case 'restore':
      await window.api.restoreCategory(id)
      await refreshAfterCategoryChange()
      break
    case 'edit':
      catRows.querySelectorAll('.form-row').forEach(r => r.remove())
      row.insertAdjacentHTML('afterend', catFormRow(id, row.dataset.name, row.dataset.color))
      break
    case 'palette':
      row.querySelector('.palette').classList.toggle('hidden')
      break
    case 'cancel':
      row.remove()
      break
    case 'save': {
      const name  = row.querySelector('.cat-name').value.trim()
      const color = row.querySelector('.swatch').dataset.color
      if (!name) return
      const formId = row.dataset.formId
      if (formId) await window.api.updateCategory(Number(formId), name, color)
      else await window.api.addCategory(name, color)
      await refreshAfterCategoryChange()
      break
    }
  }
})

// ── Карточка «Правка часов» ───────────────────────────────────────────────────

function hoursFormRow(id, categoryId, time) {
  const options = categories.map(c =>
    `<option value="${c.id}"${c.id === categoryId ? ' selected' : ''}>${c.name}</option>`).join('')
  return `<tr class="form-row" data-form-id="${id ?? ''}">
      <td colspan="3">
        <div class="ed">
          <select class="inp hours-cat">${options}</select>
          <input class="inp num hours-time" type="time" value="${time}">
          <span class="sp"></span>
          <button class="btn-s" data-do="cancel">${t('btn_cancel')}</button>
          <button class="btn-s primary" data-do="save">${t('btn_save')}</button>
        </div>
      </td></tr>`
}

async function loadHoursTable() {
  if (!hoursDateInput.value) {
    hoursDateInput.value = todayISO()
    paintDateField(hoursDateInput)
  }
  const sessions = await window.api.getSessionsByDate(currentUser, hoursDateInput.value)
  hoursRows.innerHTML = sessions.map(s =>
    `<tr data-id="${s.id}" data-cat="${s.category_id}" data-time="${secsToHHMM(s.duration_seconds)}">
       <td><span class="nm"><i style="background:${esc(s.color)}"></i>${esc(s.name)}</span></td>
       <td class="num">${secsToHHMM(s.duration_seconds)}</td>
       ${actsCell(editDeleteButtons())}</tr>`
  ).join('')
  hoursEmpty.classList.toggle('hidden', sessions.length > 0)
}

hoursDateInput.addEventListener('change', async () => {
  paintDateField(hoursDateInput)
  await loadHoursTable()
})

hoursAddBtn.addEventListener('click', () => {
  if (categories.length === 0) return
  hoursRows.querySelectorAll('.form-row').forEach(r => r.remove())
  hoursRows.insertAdjacentHTML('beforeend', hoursFormRow(null, categories[0].id, '01:00'))
})

hoursRows.addEventListener('click', async e => {
  const btn = e.target.closest('button[data-do]')
  if (!btn) return
  const row = btn.closest('tr')

  switch (btn.dataset.do) {
    case 'del':
      row.querySelector('.btns').classList.add('hidden')
      row.querySelector('.confirm').classList.remove('hidden')
      break
    case 'no':
      row.querySelector('.confirm').classList.add('hidden')
      row.querySelector('.btns').classList.remove('hidden')
      break
    case 'yes':
      await window.api.deleteSession(Number(row.dataset.id))
      await loadHoursTable()
      await refreshStats()
      break
    case 'edit':
      hoursRows.querySelectorAll('.form-row').forEach(r => r.remove())
      row.insertAdjacentHTML('afterend',
        hoursFormRow(row.dataset.id, Number(row.dataset.cat), row.dataset.time))
      break
    case 'cancel':
      row.remove()
      break
    case 'save': {
      const time = row.querySelector('.hours-time').value
      if (!time) return
      const seconds = hhmmToSecs(time)
      if (seconds <= 0) return
      const categoryId = Number(row.querySelector('.hours-cat').value)
      const formId = row.dataset.formId
      if (formId) {
        await window.api.updateSession(Number(formId), categoryId, seconds)
      } else {
        const startedAt = new Date(hoursDateInput.value + 'T00:00:00').getTime()
        await window.api.saveSession({
          user: currentUser,
          category_id: categoryId,
          started_at: startedAt,
          ended_at: startedAt + seconds * 1000,
          duration_seconds: seconds
        })
      }
      await loadHoursTable()
      await refreshStats()
      break
    }
  }
})

async function loadSettingsView() {
  await loadProfileCard()
  await loadTimeCard()
  await renderCatTable()
  await loadHoursTable()
}

// ── Вид «Сводка» ──────────────────────────────────────────────────────────────

const sumPeriod      = document.getElementById('sum-period')
const sumTotal       = document.getElementById('sum-total')
const sumLeft        = document.getElementById('sum-left')
const sumStack       = document.getElementById('sum-stack')
const sumLegend      = document.getElementById('sum-legend')
const sumToday       = document.getElementById('sum-today')
const sumTodaySub    = document.getElementById('sum-today-sub')
const sumAvg         = document.getElementById('sum-avg')
const sumAvgSub      = document.getElementById('sum-avg-sub')
const sumDonut       = document.getElementById('sum-donut')
const sumDonutLegend = document.getElementById('sum-donut-legend')
const sumChart       = document.getElementById('sum-chart')
const sumChartX      = document.getElementById('sum-chart-x')
const sumCatRows     = document.getElementById('sum-cat-rows')

const DONUT_LEN = 2 * Math.PI * 54

function shortDate(iso) {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${langDict().months_short[Number(m) - 1]}`
}


// Цвет участника: свои часы идут акцентом темы, остальные разбирают палитру
// категорий по порядку — на двоих выглядит как в прототипе, третий не ломает.
function userColor(index) {
  return index === 0 ? 'var(--accent)' : CAT_COLORS[(index - 1) % CAT_COLORS.length]
}

async function loadSummaryView() {
  if (!currentUser) return
  const [stats, sharedTotal, period, todaySessions] = await Promise.all([
    window.api.getMonthlyStats(currentUser),
    window.api.getSharedTotal(),
    window.api.getPeriodSettings(),
    window.api.getSessionsByDate(currentUser, todayISO()),
  ])
  const breakdown = await periodBreakdown(period)

  renderSummaryLimit(sharedTotal, period, breakdown)
  renderSummaryToday(todaySessions)
  renderSummaryAverage(breakdown, period)
  renderSummaryDonut(stats)
  renderSummaryChart(breakdown, period)
  renderSummaryCategories(stats)
}

function renderSummaryLimit(total, period, { perUser }) {
  const limit = period.monthly_limit_seconds
  sumPeriod.textContent = `${shortDate(period.period_start)} — ${shortDate(period.period_end)}`
  sumTotal.innerHTML = `${formatHM(total)} <span class="of">/ ${formatHM(limit)}</span>`

  const left = limit - total
  const daysLeft = Math.max(0, daysBetween(todayISO(), period.period_end))
  sumLeft.textContent = left >= 0
    ? `${t('sum_left')} ${formatHM(left)} · ${daysLeft} ${t('stat_days')}`
    : `${t('stat_over')} ${formatHM(-left)} · ${daysLeft} ${t('stat_days')}`

  // Свой всегда первым, остальные по убыванию часов
  const users = [...perUser.entries()]
    .sort((a, b) => (a[0] === currentUser ? -1 : b[0] === currentUser ? 1 : b[1] - a[1]))

  sumStack.innerHTML = users.map(([, seconds], i) =>
    `<span style="width:${limit > 0 ? (seconds / limit) * 100 : 0}%;background:${userColor(i)}"></span>`
  ).join('')

  sumLegend.innerHTML = users.map(([name, seconds], i) =>
    `<b><i style="background:${userColor(i)}"></i>${esc(name)} <span class="v">${formatHM(seconds)}</span></b>`
  ).join('') + (left > 0
    ? `<b><i style="background:var(--surface-2)"></i>${t('sum_free')} <span class="v">${formatHM(left)}</span></b>`
    : '')
}

function renderSummaryToday(sessions) {
  const seconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0)
  sumToday.textContent = formatHM(seconds)
  const names = [...new Set(sessions.map(s => s.name))]
  sumTodaySub.textContent = sessions.length
    ? `${t('sum_sessions').replace('{n}', sessions.length)} · ${names.join(', ')}`
    : '—'
}

function renderSummaryAverage({ activeDays, avg }, period) {
  sumAvg.textContent = activeDays ? formatHM(avg) : '—'
  const totalDays = daysBetween(period.period_start, period.period_end) + 1
  sumAvgSub.textContent = t('sum_active_days')
    .replace('{active}', activeDays)
    .replace('{total}', totalDays)
}

function renderSummaryDonut(stats) {
  const total = stats.reduce((sum, row) => sum + row.total, 0)
  if (!total) {
    sumDonut.innerHTML = ''
    sumDonutLegend.innerHTML = ''
    return
  }

  let offset = 0
  sumDonut.innerHTML = stats.map(row => {
    const len = DONUT_LEN * (row.total / total)
    const circle = `<circle cx="62" cy="62" r="54" stroke="${esc(row.color)}" stroke-dasharray="${len} ${DONUT_LEN - len}" stroke-dashoffset="${-offset}"></circle>`
    offset += len
    return circle
  }).join('')

  const top = stats.slice(0, 5)
  const rest = stats.slice(5)
  sumDonutLegend.innerHTML = top.map(row =>
    `<div class="dl-row"><i style="background:${esc(row.color)}"></i><span class="n">${esc(row.name)}</span><span class="v">${Math.round(row.total / total * 100)}%</span></div>`
  ).join('') + (rest.length
    ? `<div class="dl-row"><i style="background:var(--surface-2)"></i><span class="n">${t('sum_more')} ${rest.length}</span><span class="v">${Math.round(rest.reduce((s, r) => s + r.total, 0) / total * 100)}%</span></div>`
    : '')
}

function renderSummaryChart({ perDay }, period) {
  const days = []
  const cursor = new Date(period.period_start + 'T00:00:00')
  const end = new Date(period.period_end + 'T00:00:00')
  while (cursor <= end) {
    const iso = localISODate(cursor)
    days.push([iso, perDay.get(iso) || 0])
    cursor.setDate(cursor.getDate() + 1)
  }

  const max = Math.max(...days.map(([, seconds]) => seconds), 1)
  sumChart.innerHTML = days.map(([iso, seconds]) =>
    `<span class="bar ${seconds ? '' : 'none'}" style="height:${seconds ? Math.max(seconds / max * 100, 6) : 6}%" title="${shortDate(iso)}: ${seconds ? formatHM(seconds) : '—'}"></span>`
  ).join('')

  // Подписи по краям и трети: день месяца, месяц читается из заголовка карточки
  const marks = [0, Math.floor(days.length / 3), Math.floor(days.length * 2 / 3), days.length - 1]
  sumChartX.innerHTML = [...new Set(marks)]
    .map(i => `<span>${Number(days[i][0].slice(8, 10))}</span>`).join('')
}

function renderSummaryCategories(stats) {
  if (!stats.length) {
    sumCatRows.innerHTML = ''
    return
  }
  const max = stats[0].total
  sumCatRows.innerHTML = stats.map(row => `
    <tr>
      <td><span class="nm"><i style="background:${esc(row.color)}"></i>${esc(row.name)}</span></td>
      <td><span class="mini"><span style="width:${row.total / max * 100}%;background:${esc(row.color)}"></span></span></td>
      <td class="num">${row.sessions}</td>
      <td class="num">${formatHM(row.total)}</td>
    </tr>`).join('')
}

// ── Вид «Appearance» ──────────────────────────────────────────────────────────

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
  themeLightSelect.value = themeLight
  themeDarkSelect.value  = themeDark
  dotLight.style.background = THEME_ACCENTS[themeLight]
  dotDark.style.background  = THEME_ACCENTS[themeDark]
  pressOne(themeModeSw, 'themeMode', themeMode)
}

function loadAppearanceView() {
  paintThemeCard()
  pressOne(animSw, 'anim', document.documentElement.dataset.anim)
  pressOne(animSpeedSw, 'speed', document.documentElement.dataset.waveSpeed)
  animSpeedRow.classList.toggle('off', document.documentElement.dataset.anim === 'fade')
  fxParticlesSelect.value = document.documentElement.dataset.fxp || 'off'
  fxBlobsSelect.value     = document.documentElement.dataset.fxl || 'off'
  pressOne(fxIdleSw, 'fxIdle', document.documentElement.dataset.fxi)
  pressOne(langSw, 'lang', currentLang)
}

themeModeSw.addEventListener('click', async e => {
  const btn = e.target.closest('button')
  if (!btn) return
  themeMode = btn.dataset.themeMode
  await window.api.setSetting('theme_mode', themeMode)
  applyTheme()
  paintThemeCard()
})

themeLightSelect.addEventListener('change', async e => {
  themeLight = e.target.value
  await window.api.setSetting('theme_light', themeLight)
  applyTheme()
  paintThemeCard()
  flashSaved(e.target)
})

themeDarkSelect.addEventListener('change', async e => {
  themeDark = e.target.value
  await window.api.setSetting('theme_dark', themeDark)
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
  if (currentView !== 'appearance' || document.documentElement.dataset.mode !== 'dash') return

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

// ── Язык ──────────────────────────────────────────────────────────────────────

langSw.addEventListener('click', async e => {
  const btn = e.target.closest('button')
  if (!btn) return
  currentLang = btn.dataset.lang
  await window.api.setSetting('lang', currentLang)
  applyI18n()
  pressOne(langSw, 'lang', currentLang)
  renderCategories()
  renderDialogCategories()
  renderWeekdays()
  await refreshStats()
  flashSaved(btn)
})

// ── Calendar ──────────────────────────────────────────────────────────────────

const calPrev  = document.getElementById('cal-prev')
const calNext  = document.getElementById('cal-next')
const calTitle = document.getElementById('cal-title')
const calGrid  = document.getElementById('calendar-grid')

function renderWeekdays() {
  const spans = document.querySelectorAll('.calendar-weekdays span')
  const wd = langDict().weekdays
  spans.forEach((span, i) => { if (wd[i]) span.textContent = wd[i] })
}

calPrev.addEventListener('click', () => navigateCalendar(-1))
calNext.addEventListener('click', () => navigateCalendar(1))

// Вид открывается на текущем месяце; пролистанный месяц не запоминается
async function loadCalendarView() {
  const now = new Date()
  calYear  = now.getFullYear()
  calMonth = now.getMonth() + 1
  renderWeekdays()
  await loadCalendarMonth()
}

async function navigateCalendar(delta) {
  calMonth += delta
  if (calMonth > 12) { calMonth = 1; calYear++ }
  if (calMonth < 1)  { calMonth = 12; calYear-- }
  await loadCalendarMonth()
}

async function loadCalendarMonth() {
  const [rows, avatars] = await Promise.all([
    window.api.getCalendarMonth(calYear, calMonth),
    window.api.getUserAvatars(),
  ])
  calTitle.textContent = `${langDict().months[calMonth - 1]} ${calYear}`
  renderWeekdays()
  renderCalendarGrid(calYear, calMonth, rows, avatars)
}

function renderCalendarGrid(year, month, rows, avatars) {
  calGrid.innerHTML = ''

  const dayMap = {}
  rows.forEach(r => {
    if (!dayMap[r.day]) dayMap[r.day] = {}
    dayMap[r.day][r.user] = r.total_seconds
  })

  const firstDay = new Date(year, month - 1, 1)
  const todayStr = localISODate(new Date())
  const startDow = (firstDay.getDay() + 6) % 7  // Mon = 0

  for (let i = 0; i < 42; i++) {
    const d       = new Date(year, month - 1, 1 + (i - startDow))
    const inMonth = d.getMonth() === month - 1
    const dayStr  = localISODate(d)
    const isToday = dayStr === todayStr

    const cell = document.createElement('div')
    cell.className = 'cal-cell'
    if (!inMonth) cell.classList.add('cal-other-month')
    if (isToday)  cell.classList.add('cal-today')

    const numEl = document.createElement('div')
    numEl.className = 'cal-day-num'
    numEl.textContent = d.getDate()
    cell.appendChild(numEl)

    if (inMonth && dayMap[dayStr]) {
      Object.keys(dayMap[dayStr]).forEach(user => {
        const secs = dayMap[dayStr][user]
        if (!secs) return
        const row  = document.createElement('div')
        row.className = 'cal-user-row'
        const img  = document.createElement('img')
        img.className = 'cal-avatar'
        img.src = `../../assets/icons/${avatars[user] || 'user.svg'}`
        const time = document.createElement('span')
        time.className = 'cal-user-time'
        time.textContent = formatCalDuration(secs)
        row.append(img, time)
        cell.appendChild(row)
      })
    }

    calGrid.appendChild(cell)
  }
}

function localISODate(d) {
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function formatCalDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}${t('unit_m')}`
  if (m === 0) return `${h}${t('unit_h')}`
  return `${h}${t('unit_h')} ${m}${t('unit_m')}`
}

// ── Sync ──────────────────────────────────────────────────────────────────────

window.api.onPeerUpdated(async () => {
  await refreshStats()
  if (currentView === 'calendar') await loadCalendarMonth()
  if (currentView === 'summary')  await loadSummaryView()
})

window.api.onSyncLimitUpdated(async () => {
  await refreshStats()
  if (currentView === 'settings') await loadTimeCard()
})

window.api.onSyncDone(async () => {
  if (currentView === 'settings') await loadProfileCard()
})

// ── Titlebar window controls ────────────────────────────────────────────────
document.getElementById('win-min-btn').addEventListener('click', () => window.api.winMinimize())
document.getElementById('win-max-btn').addEventListener('click', () => window.api.winMaximizeToggle())
document.getElementById('win-close-btn').addEventListener('click', () => window.api.winClose())

const winMaxIcon = document.getElementById('win-max-icon')
window.api.onWinMaximized(()   => winMaxIcon.setAttribute('href', '#i-win-restore'))
window.api.onWinUnmaximized(() => winMaxIcon.setAttribute('href', '#i-win-max'))

// Период продлился автоматически (сменился день во время работы приложения)
window.api.onPeriodAdvanced(async () => {
  await refreshStats()
  if (currentView === 'settings') await loadTimeCard()
})

// ── Start ─────────────────────────────────────────────────────────────────────

init()
