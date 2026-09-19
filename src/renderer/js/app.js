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
const settingsModal        = document.getElementById('settings-modal')
const settingsClose        = document.getElementById('settings-close')
const settingsTabs         = document.querySelectorAll('.settings-tab')
const settingsPanes        = document.querySelectorAll('.settings-pane')
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
const userNameDisplay      = document.getElementById('user-name-display')
const userNameEditBtn      = document.getElementById('user-name-edit-btn')
const userNamePicker       = document.getElementById('user-name-picker')
const avatarPreview        = document.getElementById('avatar-preview')
const avatarEditBtn        = document.getElementById('avatar-edit-btn')
const avatarGrid           = document.getElementById('avatar-grid')
const limitInput           = document.getElementById('limit-input')
const periodStartInput     = document.getElementById('period-start-input')
const periodEndInput       = document.getElementById('period-end-input')
const limitSaveBtn         = document.getElementById('limit-save-btn')
const limitAdminNote       = document.getElementById('limit-admin-note')

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
}

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

// ── Settings ──────────────────────────────────────────────────────────────────

// Точки входа в настройки, календарь и «О программе» появятся в рельсе
// Dashboard на следующем этапе. В шапке Focus их нет по прототипу.

function openSettings() {
  // reset to user tab
  settingsTabs.forEach(t => t.classList.remove('active'))
  settingsPanes.forEach(p => p.classList.add('hidden'))
  document.querySelector('[data-tab="user"]').classList.add('active')
  document.getElementById('pane-user').classList.remove('hidden')

  document.getElementById('lang-select').value = currentLang
  document.getElementById('daily-goal-input').value = dailyGoalSeconds / 3600
  document.getElementById('fx-particles-select').value = document.documentElement.dataset.fxp || 'off'
  document.getElementById('fx-leaks-select').value = document.documentElement.dataset.fxl || 'off'
  settingsModal.classList.remove('hidden')
  loadUserTab()
}

function closeSettings() {
  settingsModal.classList.add('hidden')
}

settingsClose.addEventListener('click', closeSettings)

document.getElementById('lang-select').addEventListener('change', async e => {
  currentLang = e.target.value
  await window.api.setSetting('lang', currentLang)
  applyI18n()
  renderCategories()
  renderDialogCategories()
  await refreshStats()
  if (!calendarModal.classList.contains('hidden')) await loadCalendarMonth()
})

// Свитчер светлая/тёмная: тот же, что будет у кнопки в Appearance.
document.addEventListener('keydown', e => {
  if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    toggleThemeMode()
  }
})

document.getElementById('daily-goal-input').addEventListener('change', async e => {
  const hours = Number(e.target.value)
  if (!hours || hours < 1 || hours > 24) {
    e.target.value = dailyGoalSeconds / 3600
    return
  }
  dailyGoalSeconds = Math.round(hours * 3600)
  await window.api.setSetting('daily_goal_seconds', String(dailyGoalSeconds))
  paintRing()
})

document.getElementById('fx-particles-select').addEventListener('change', async e => {
  await window.api.setSetting('fx_particles', e.target.value)
  applyFx(e.target.value, document.documentElement.dataset.fxl)
})

document.getElementById('fx-leaks-select').addEventListener('change', async e => {
  await window.api.setSetting('fx_leaks', e.target.value)
  applyFx(document.documentElement.dataset.fxp, e.target.value)
})

settingsTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    settingsTabs.forEach(t => t.classList.remove('active'))
    settingsPanes.forEach(p => p.classList.add('hidden'))
    tab.classList.add('active')
    document.getElementById(`pane-${tab.dataset.tab}`).classList.remove('hidden')
    if (tab.dataset.tab === 'limit') loadLimitTab()
    if (tab.dataset.tab === 'user') loadUserTab()
    if (tab.dataset.tab === 'categories') loadCategoriesTab()
    if (tab.dataset.tab === 'hours') loadHoursTab()
    if (tab.dataset.tab === 'sync') loadSyncTab()
  })
})

const AVATAR_FILES = [
  'user.svg', 'man.png', 'man_1.png', 'man_2.png', 'man_3.png',
  'woman.png', 'woman_1.png', 'woman_2.png', 'woman_3.png'
]

async function loadUserTab() {
  userNameDisplay.textContent = currentUser
  userNamePicker.classList.add('hidden')
  userNameEditBtn.classList.remove('hidden')

  const avatar = (await window.api.getSetting(`avatar_${currentUser}`)) ?? 'user.svg'
  avatarPreview.src = `../../assets/icons/${avatar}`
  avatarGrid.classList.add('hidden')
  avatarEditBtn.classList.remove('hidden')
  buildAvatarGrid(avatar)
}

function buildAvatarGrid(currentAvatar) {
  avatarGrid.innerHTML = ''
  AVATAR_FILES.forEach(file => {
    const img = document.createElement('img')
    img.src = `../../assets/icons/${file}`
    img.className = 'avatar-option' + (file === currentAvatar ? ' selected' : '')
    img.dataset.file = file
    img.addEventListener('click', async () => {
      await window.api.setSetting(`avatar_${currentUser}`, file)
      avatarPreview.src = `../../assets/icons/${file}`
      avatarGrid.querySelectorAll('.avatar-option').forEach(i =>
        i.classList.toggle('selected', i.dataset.file === file))
      avatarGrid.classList.add('hidden')
      avatarEditBtn.classList.remove('hidden')
    })
    avatarGrid.appendChild(img)
  })
}

const userNameInput   = document.getElementById('user-name-input')
const userNameSaveBtn = document.getElementById('user-name-save-btn')

userNameEditBtn.addEventListener('click', () => {
  userNameInput.value = currentUser
  userNamePicker.classList.remove('hidden')
  userNameEditBtn.classList.add('hidden')
})

userNameSaveBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim()
  if (!name) return
  await window.api.renameUser(name)
  currentUser = name
  userNameDisplay.textContent = name
  userNamePicker.classList.add('hidden')
  userNameEditBtn.classList.remove('hidden')
  await refreshStats()
})

avatarEditBtn.addEventListener('click', () => {
  avatarGrid.classList.remove('hidden')
  avatarEditBtn.classList.add('hidden')
})

async function loadLimitTab() {
  const period = await window.api.getPeriodSettings()
  limitInput.value = Math.round(period.monthly_limit_seconds / 3600)
  periodStartInput.value = period.period_start
  periodEndInput.value = period.period_end

  const role     = (await window.api.getSetting('group_role')) || 'solo'
  const editable = window.ROLES.canEditLimit(role)

  limitInput.disabled = !editable
  periodStartInput.disabled = !editable
  periodEndInput.disabled = !editable
  limitSaveBtn.classList.toggle('hidden', !editable)
  limitAdminNote.classList.toggle('hidden', editable)
}

limitSaveBtn.addEventListener('click', async () => {
  const hours = parseInt(limitInput.value, 10)
  if (!hours || hours < 1) return
  const start = periodStartInput.value
  const end   = periodEndInput.value
  if (!start || !end || end < start) return
  await window.api.setSetting('monthly_limit_seconds', String(hours * 3600))
  await window.api.setSetting('period_start', start)
  await window.api.setSetting('period_end', end)
  await refreshStats()
})

// ── Categories settings tab ───────────────────────────────────────────────────

const CAT_COLORS = [
  '#60a5fa', '#c084fc', '#fb923c', '#f472b6', '#f87171',
  '#34d399', '#EFF74A', '#2AF720', '#3020F5'
]

let catEditingId    = null
let pendingDeleteId = null
let catEditingColor = CAT_COLORS[0]

const catSettingsList = document.getElementById('cat-settings-list')
const catAddBtn       = document.getElementById('cat-add-btn')
const catEditForm     = document.getElementById('cat-edit-form')
const catNameInput    = document.getElementById('cat-name-input')
const catColorSwatch  = document.getElementById('cat-color-swatch')
const catColorPalette = document.getElementById('cat-color-palette')
const catEditCancel   = document.getElementById('cat-edit-cancel')
const catEditSave     = document.getElementById('cat-edit-save')
const catDeletedList  = document.getElementById('cat-deleted-list')
const catDeletedEmpty = document.getElementById('cat-deleted-empty')
const catDeleteDialog = document.getElementById('cat-delete-dialog')
const catDeleteName   = document.getElementById('cat-delete-name')
const catDeleteCancel = document.getElementById('cat-delete-cancel')
const catDeleteConfirm = document.getElementById('cat-delete-confirm')

async function loadCategoriesTab() {
  catEditForm.classList.add('hidden')
  catColorPalette.classList.add('hidden')
  document.querySelectorAll('.cat-subtab').forEach(t => t.classList.remove('active'))
  document.querySelector('[data-subtab="active"]').classList.add('active')
  await renderActiveCategoriesList()
  showActiveCatPanel()
}

function openCatForm(id, name, color) {
  catEditingId    = id ?? null
  catEditingColor = color ?? CAT_COLORS[0]
  catNameInput.value = name ?? ''
  catColorSwatch.style.background = catEditingColor
  catColorPalette.classList.add('hidden')
  buildColorPalette()
  catEditForm.classList.remove('hidden')
  catEditForm.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function buildColorPalette() {
  catColorPalette.innerHTML = ''
  CAT_COLORS.forEach(c => {
    const el = document.createElement('div')
    el.className = 'cat-color-option' + (c === catEditingColor ? ' selected' : '')
    el.style.background = c
    el.dataset.color = c
    el.addEventListener('click', () => {
      catEditingColor = c
      catColorSwatch.style.background = c
      catColorPalette.querySelectorAll('.cat-color-option').forEach(o =>
        o.classList.toggle('selected', o.dataset.color === c))
      catColorPalette.classList.add('hidden')
    })
    catColorPalette.appendChild(el)
  })
}

function showActiveCatPanel() {
  catSettingsList.classList.remove('hidden')
  catAddBtn.classList.remove('hidden')
  catDeletedList.classList.add('hidden')
  catDeletedEmpty.classList.add('hidden')
}

function showDeletedCatPanel() {
  catSettingsList.classList.add('hidden')
  catAddBtn.classList.add('hidden')
  catEditForm.classList.add('hidden')
  catColorPalette.classList.add('hidden')
}

async function renderActiveCategoriesList() {
  const cats = await window.api.getCategories()
  catSettingsList.innerHTML = ''
  cats.forEach(cat => {
    const li = document.createElement('li')
    li.className = 'cat-settings-item'
    const dot = document.createElement('span')
    dot.className = 'cat-settings-dot'
    dot.style.background = cat.color
    const name = document.createElement('span')
    name.className = 'cat-settings-name'
    name.textContent = cat.name
    const editBtn = document.createElement('button')
    editBtn.className = 'settings-row-btn'
    editBtn.textContent = t('btn_edit')
    editBtn.addEventListener('click', () => openCatForm(cat.id, cat.name, cat.color))
    const delBtn = document.createElement('button')
    delBtn.className = 'cat-delete-btn'
    delBtn.title = t('btn_delete')
    delBtn.innerHTML = '<img src="../../assets/icons/del.svg" width="14" height="14" alt="">'
    delBtn.addEventListener('click', () => openDeleteDialog(cat.id, cat.name))
    li.append(dot, name, editBtn, delBtn)
    catSettingsList.appendChild(li)
  })
}

async function loadDeletedCategoriesTab() {
  showDeletedCatPanel()
  const cats = await window.api.getDeletedCategories()
  catDeletedList.innerHTML = ''
  if (cats.length === 0) {
    catDeletedList.classList.add('hidden')
    catDeletedEmpty.classList.remove('hidden')
    return
  }
  catDeletedList.classList.remove('hidden')
  catDeletedEmpty.classList.add('hidden')
  cats.forEach(cat => {
    const li = document.createElement('li')
    li.className = 'cat-settings-item cat-settings-item--deleted'
    const name = document.createElement('span')
    name.className = 'cat-settings-name'
    name.textContent = cat.name
    const restoreBtn = document.createElement('button')
    restoreBtn.className = 'settings-row-btn'
    restoreBtn.textContent = t('btn_restore')
    restoreBtn.addEventListener('click', () => restoreCategoryById(cat.id))
    li.append(name, restoreBtn)
    catDeletedList.appendChild(li)
  })
}

function openDeleteDialog(id, name) {
  pendingDeleteId = id
  catDeleteName.textContent = `«${name}»`
  catDeleteDialog.classList.remove('hidden')
}

async function restoreCategoryById(id) {
  await window.api.restoreCategory(id)
  await loadDeletedCategoriesTab()
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await refreshStats()
}

catColorSwatch.addEventListener('click', () => {
  catColorPalette.classList.toggle('hidden')
})

catAddBtn.addEventListener('click', () => {
  openCatForm(null, '', CAT_COLORS[0])
})

catEditCancel.addEventListener('click', () => {
  catEditForm.classList.add('hidden')
  catColorPalette.classList.add('hidden')
})

document.querySelectorAll('.cat-subtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cat-subtab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    if (tab.dataset.subtab === 'active') {
      renderActiveCategoriesList().then(() => showActiveCatPanel())
    } else {
      loadDeletedCategoriesTab()
    }
  })
})

catDeleteCancel.addEventListener('click', () => {
  catDeleteDialog.classList.add('hidden')
  pendingDeleteId = null
})

catDeleteConfirm.addEventListener('click', async () => {
  if (pendingDeleteId === null) return
  await window.api.softDeleteCategory(pendingDeleteId)
  catDeleteDialog.classList.add('hidden')
  pendingDeleteId = null
  await loadCategoriesTab()
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await refreshStats()
})

catEditSave.addEventListener('click', async () => {
  const name = catNameInput.value.trim()
  if (!name) return
  if (catEditingId !== null) {
    await window.api.updateCategory(catEditingId, name, catEditingColor)
  } else {
    await window.api.addCategory(name, catEditingColor)
  }
  catEditForm.classList.add('hidden')
  catColorPalette.classList.add('hidden')
  await loadCategoriesTab()
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await refreshStats()
})

// ── Hours settings tab ───────────────────────────────────────────────────────

let hoursEditingId = null

const hoursDateInput  = document.getElementById('hours-date-input')
const hoursList       = document.getElementById('hours-list')
const hoursEmpty      = document.getElementById('hours-empty')
const hoursAddBtn     = document.getElementById('hours-add-btn')
const hoursEditForm   = document.getElementById('hours-edit-form')
const hoursCatSelect  = document.getElementById('hours-cat-select')
const hoursTimeInput  = document.getElementById('hours-time-input')
const hoursEditCancel = document.getElementById('hours-edit-cancel')
const hoursEditSave   = document.getElementById('hours-edit-save')

const calendarModal = document.getElementById('calendar-modal')
const calendarClose = document.getElementById('calendar-close')
const calPrev       = document.getElementById('cal-prev')
const calNext       = document.getElementById('cal-next')
const calTitle      = document.getElementById('cal-title')
const calGrid       = document.getElementById('calendar-grid')

function formatLastSync(ts) {
  if (!ts) return '—'
  const d   = new Date(ts)
  const now = new Date()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  if (d.toDateString() === now.toDateString()) {
    return `${t('today_at')} ${hh}:${mm}`
  }
  const dd   = String(d.getDate()).padStart(2, '0')
  const mo   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mo}.${yyyy} ${hh}:${mm}`
}

async function loadSyncTab() {
  const role    = (await window.api.getSetting('group_role')) || 'solo'
  const code    = (await window.api.getSetting('group_code')) || ''
  const grouped = window.ROLES.isGrouped(role)

  document.getElementById('sync-solo').classList.toggle('hidden', grouped)
  document.getElementById('sync-grouped').classList.toggle('hidden', !grouped)

  if (grouped) {
    document.getElementById('group-role-value').textContent = t(`group_role_${role}`)
    document.getElementById('group-code-value').textContent = code
    const seconds = await window.api.getSyncInterval()
    document.getElementById('sync-interval-select').value = String(seconds || 300)
    const ts = await window.api.getLastSync()
    document.getElementById('sync-last-time').textContent = formatLastSync(ts)
  } else {
    document.getElementById('group-join-input').value = ''
  }
}

function secsToHHMM(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToSecs(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 3600 + m * 60
}

function loadHoursTab() {
  hoursEditForm.classList.add('hidden')
  hoursList.classList.add('hidden')
  hoursList.innerHTML = ''
  hoursEmpty.classList.add('hidden')
  hoursAddBtn.classList.add('hidden')
  hoursCatSelect.innerHTML = ''
  categories.forEach(cat => {
    const opt = document.createElement('option')
    opt.value = cat.id
    opt.textContent = cat.name
    hoursCatSelect.appendChild(opt)
  })
}

async function loadHoursSessions() {
  const date = hoursDateInput.value
  if (!date) return
  const sessions = await window.api.getSessionsByDate(currentUser, date)
  hoursList.innerHTML = ''
  hoursList.classList.remove('hidden')
  hoursEditForm.classList.add('hidden')
  if (sessions.length === 0) {
    hoursEmpty.classList.remove('hidden')
  } else {
    hoursEmpty.classList.add('hidden')
    sessions.forEach(s => renderHoursItem(s))
  }
  hoursAddBtn.classList.remove('hidden')
}

function renderHoursItem(session) {
  const li = document.createElement('li')
  li.className = 'hours-list-item'

  const dot = document.createElement('span')
  dot.className = 'cat-settings-dot'
  dot.style.background = session.color

  const name = document.createElement('span')
  name.className = 'cat-settings-name'
  name.textContent = session.name

  const time = document.createElement('span')
  time.className = 'hours-list-time'
  time.textContent = secsToHHMM(session.duration_seconds)

  const actions = document.createElement('div')
  actions.className = 'hours-item-actions'

  const btns = document.createElement('div')
  btns.className = 'hours-btns'

  const editBtn = document.createElement('button')
  editBtn.className = 'settings-row-btn'
  editBtn.textContent = t('btn_edit')
  editBtn.addEventListener('click', () => openHoursForm(session))

  const delBtn = document.createElement('button')
  delBtn.className = 'settings-row-btn hours-del-btn'
  delBtn.textContent = t('btn_delete')

  btns.append(editBtn, delBtn)

  const confirm = document.createElement('div')
  confirm.className = 'hours-confirm-delete hidden'

  const confirmText = document.createElement('span')
  confirmText.className = 'hours-confirm-text'
  confirmText.textContent = t('confirm_delete_q')

  const yesBtn = document.createElement('button')
  yesBtn.className = 'hours-confirm-yes'
  yesBtn.textContent = t('btn_yes')

  const noBtn = document.createElement('button')
  noBtn.className = 'cat-edit-cancel'
  noBtn.textContent = t('btn_no')

  confirm.append(confirmText, yesBtn, noBtn)
  actions.append(btns, confirm)

  delBtn.addEventListener('click', () => {
    btns.classList.add('hidden')
    confirm.classList.remove('hidden')
  })

  noBtn.addEventListener('click', () => {
    confirm.classList.add('hidden')
    btns.classList.remove('hidden')
  })

  yesBtn.addEventListener('click', async () => {
    await window.api.deleteSession(session.id)
    await loadHoursSessions()
    await refreshStats()
  })

  li.append(dot, name, time, actions)
  hoursList.appendChild(li)
}

function openHoursForm(session) {
  hoursEditingId = session ? session.id : null
  if (session) {
    hoursCatSelect.value = session.category_id
    hoursTimeInput.value = secsToHHMM(session.duration_seconds)
  } else {
    hoursCatSelect.selectedIndex = 0
    hoursTimeInput.value = ''
  }
  hoursEditForm.classList.remove('hidden')
  hoursEditForm.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

hoursDateInput.addEventListener('change', loadHoursSessions)

hoursAddBtn.addEventListener('click', () => openHoursForm(null))

hoursEditCancel.addEventListener('click', () => {
  hoursEditForm.classList.add('hidden')
})

hoursEditSave.addEventListener('click', async () => {
  const time = hoursTimeInput.value
  if (!time) return
  const durationSeconds = hhmmToSecs(time)
  if (durationSeconds <= 0) return
  const categoryId = Number(hoursCatSelect.value)

  if (hoursEditingId !== null) {
    await window.api.updateSession(hoursEditingId, categoryId, durationSeconds)
  } else {
    const startedAt = new Date(hoursDateInput.value + 'T00:00:00').getTime()
    await window.api.saveSession({
      user: currentUser,
      category_id: categoryId,
      started_at: startedAt,
      ended_at: startedAt + durationSeconds * 1000,
      duration_seconds: durationSeconds
    })
  }
  hoursEditForm.classList.add('hidden')
  await loadHoursSessions()
  await refreshStats()
})

// ── Calendar ──────────────────────────────────────────────────────────────────

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

document.getElementById('sync-interval-select').addEventListener('change', async (e) => {
  await window.api.setSyncInterval(Number(e.target.value))
})

document.getElementById('group-create-btn').addEventListener('click', async () => {
  await window.api.createGroup()
  await loadSyncTab()
})

document.getElementById('group-join-btn').addEventListener('click', async () => {
  const code = document.getElementById('group-join-input').value.trim()
  if (code.length < 4) return
  await window.api.joinGroup(code)
  await loadSyncTab()
})

document.getElementById('group-leave-btn').addEventListener('click', async () => {
  await window.api.leaveGroup()
  await loadSyncTab()
  await refreshStats()
})

window.api.onSyncLimitUpdated(async () => {
  await refreshStats()
  if (!settingsModal.classList.contains('hidden')) await loadLimitTab()
})

// ── Titlebar window controls ────────────────────────────────────────────────
document.getElementById('win-min-btn').addEventListener('click', () => window.api.winMinimize())
document.getElementById('win-max-btn').addEventListener('click', () => window.api.winMaximizeToggle())
document.getElementById('win-close-btn').addEventListener('click', () => window.api.winClose())

const winMaxIcon = document.getElementById('win-max-icon')
window.api.onWinMaximized(()   => { winMaxIcon.src = '../../assets/icons/win-restore.svg' })
window.api.onWinUnmaximized(() => { winMaxIcon.src = '../../assets/icons/win-max.svg' })

window.api.onSyncDone(ts => {
  const el = document.getElementById('sync-last-time')
  if (el) el.textContent = formatLastSync(ts)
})

// Период продлился автоматически (сменился день во время работы приложения)
window.api.onPeriodAdvanced(async () => {
  await refreshStats()
  if (!settingsModal.classList.contains('hidden')) {
    await loadLimitTab()
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

init()
