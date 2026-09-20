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
  window.FX?.refresh()
}

async function toggleThemeMode() {
  themeMode = themeMode === 'light' ? 'dark' : 'light'
  await window.api.setSetting('theme_mode', themeMode)
  applyTheme()
}

function applyFx(particles, leaks) {
  document.documentElement.dataset.fxp = particles
  document.documentElement.dataset.fxl = leaks
  window.FX?.refresh()
}

function t(key) {
  return window.I18N.translate(window.DICT, currentLang, key)
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
  const savedFxL = await window.api.getSetting('fx_leaks')
  applyFx(savedFxP || 'off', savedFxL || 'off')

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
  await refreshStats()
  mainScreen.classList.remove('hidden')
}

// ── Categories ────────────────────────────────────────────────────────────────

function renderCategories() {
  // Часы на бейдже берутся из той же статистики, что рисует панель «Подробно»,
  // отдельного запроса на это не нужно. Сопоставление по имени, а не по id:
  // db:get-monthly-stats группирует по категории, но самого id не возвращает,
  // а трогать main-процесс на этом этапе нельзя.
  const hours = new Map(lastStats.map(row => [row.name, row.total]))
  chips.innerHTML = ''
  categories.forEach(cat => {
    const btn = document.createElement('button')
    btn.className = 'chip'
    btn.dataset.id = cat.id
    btn.setAttribute('aria-pressed', String(cat.id === selectedCategoryId))
    const spent = hours.get(cat.name)
    btn.innerHTML = `
      <span class="sw" style="background:${cat.color}"></span>${cat.name}
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
    ? `<span class="sw" style="background:${cat.color}"></span>${cat.name}`
    : ''
  timerBtn.disabled = false
  dialogCategorySelect.value = id
  paintDock()
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}${t('unit_h')} ${m}${t('unit_m')} ${s}${t('unit_s')}`
}

// Без секунд: на бейджах, в кольце и в подвале они только шумят.
// Нулевая часть тоже опускается — «160ч», а не «160ч 0м».
function formatHM(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (!h) return `${m}${t('unit_m')}`
  if (!m) return `${h}${t('unit_h')}`
  return `${h}${t('unit_h')} ${m}${t('unit_m')}`
}

function todayISO() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
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
  renderAverage(await periodBreakdown(period))
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
  rows.forEach(row => {
    if (row.day < period.period_start || row.day > period.period_end) return
    perDay.set(row.day, (perDay.get(row.day) || 0) + (row.total_seconds || 0))
  })

  const worked = [...perDay.values()].filter(v => v > 0)
  const total = worked.reduce((a, b) => a + b, 0)

  return {
    perDay,
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
    const months = window.DICT[currentLang].months_short
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
      <span class="n">${row.name}</span>
      <span class="t"><span style="width:${pct}%;background:${row.color}"></span></span>
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

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

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

function stop() {
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
  if (running) stop()
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
  if (view === 'settings') loadSettingsView()
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

async function setMode(next) {
  const root = document.documentElement
  if (root.dataset.mode === next || modeBusy) return

  await window.api.setSetting('ui_mode', next)

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.dataset.mode = next
    window.FX?.refresh()
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
    window.FX?.refresh()
  })
}

tbtn.addEventListener('click', () => {
  setMode(document.documentElement.dataset.mode === 'focus' ? 'dash' : 'focus')
})

// Док показывает то же состояние, что кольцо в Focus: это один таймер.
function paintDock() {
  const cat = categories.find(c => c.id === selectedCategoryId)
  dockCat.innerHTML = cat
    ? `<span class="sw" style="background:${cat.color}"></span>${cat.name}`
    : ''
  dockTime.textContent = timerDisplay.textContent
  dock.classList.toggle('running', running)
  dockBtn.classList.toggle('stop', running)
  dockBtn.textContent = running ? 'STOP' : 'START'
  dockBtn.disabled = timerBtn.disabled
}

dockBtn.addEventListener('click', () => {
  if (running) stop()
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

function secsToHHMM(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToSecs(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 3600 + m * 60
}

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
  input.addEventListener('click', () => { try { input.showPicker() } catch (e) {} })
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
    ? `<tr data-id="${cat.id}" data-name="${cat.name}" data-color="${cat.color}">
         <td><span class="nm"><i style="background:${cat.color}"></i>${cat.name}</span></td>
         ${actsCell(editDeleteButtons())}</tr>`
    : `<tr data-id="${cat.id}"><td><span class="nm">${cat.name}</span></td>
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
       <td><span class="nm"><i style="background:${s.color}"></i>${s.name}</span></td>
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

// ── Calendar ──────────────────────────────────────────────────────────────────

const calendarModal = document.getElementById('calendar-modal')
const calendarClose = document.getElementById('calendar-close')
const calPrev       = document.getElementById('cal-prev')
const calNext       = document.getElementById('cal-next')
const calTitle      = document.getElementById('cal-title')
const calGrid       = document.getElementById('calendar-grid')

function renderWeekdays() {
  const spans = document.querySelectorAll('.calendar-weekdays span')
  const wd = window.DICT[currentLang].weekdays
  spans.forEach((span, i) => { if (wd[i]) span.textContent = wd[i] })
}

calendarClose.addEventListener('click', () => {
  calendarModal.classList.add('hidden')
})

calendarModal.addEventListener('click', e => {
  if (e.target === calendarModal) calendarModal.classList.add('hidden')
})

calPrev.addEventListener('click', () => navigateCalendar(-1))
calNext.addEventListener('click', () => navigateCalendar(1))

async function openCalendar() {
  const now = new Date()
  calYear  = now.getFullYear()
  calMonth = now.getMonth() + 1
  calendarModal.classList.remove('hidden')
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
  calTitle.textContent = `${window.DICT[currentLang].months[calMonth - 1]} ${calYear}`
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
  if (!calendarModal.classList.contains('hidden')) {
    await loadCalendarMonth()
  }
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
window.api.onWinMaximized(()   => { winMaxIcon.src = '../../assets/icons/win-restore.svg' })
window.api.onWinUnmaximized(() => { winMaxIcon.src = '../../assets/icons/win-max.svg' })

// Период продлился автоматически (сменился день во время работы приложения)
window.api.onPeriodAdvanced(async () => {
  await refreshStats()
  if (currentView === 'settings') await loadTimeCard()
})

// ── Start ─────────────────────────────────────────────────────────────────────

init()
