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

const userSelectScreen     = document.getElementById('user-select-screen')
const mainScreen           = document.getElementById('main-screen')
const categoriesList       = document.getElementById('categories-list')
const limitBarWrap         = document.getElementById('limit-bar-wrap')
const limitBarLabel        = document.getElementById('limit-bar-label')
const limitBarTime         = document.getElementById('limit-bar-time')
const limitBarFill         = document.getElementById('limit-bar-fill')
const statsContainer       = document.getElementById('stats-container')
const timerDisplay         = document.getElementById('timer-display')
const timerBtn             = document.getElementById('timer-btn')
const timerRing            = document.getElementById('timer-ring')
const resetBtn             = document.getElementById('reset-btn')
const noCategoryHint       = document.getElementById('no-category-hint')
const saveDialog           = document.getElementById('save-dialog')
const dialogTime           = document.getElementById('dialog-time')
const dialogCategorySelect = document.getElementById('dialog-category-select')
const dialogCancel         = document.getElementById('dialog-cancel')
const dialogSave           = document.getElementById('dialog-save')
const burgerBtn            = document.getElementById('burger-btn')
const burgerDropdown       = document.getElementById('burger-dropdown')
const menuSettings         = document.getElementById('menu-settings')
const menuAbout            = document.getElementById('menu-about')
const settingsModal        = document.getElementById('settings-modal')
const settingsClose        = document.getElementById('settings-close')
const settingsTabs         = document.querySelectorAll('.settings-tab')
const settingsPanes        = document.querySelectorAll('.settings-pane')
const aboutModal           = document.getElementById('about-modal')
const aboutClose           = document.getElementById('about-close')
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
  const userName = await window.api.getSetting('user_name')
  if (userName) {
    currentUser = userName
    await showMainScreen()
  } else {
    userSelectScreen.classList.remove('hidden')
  }
}

document.querySelectorAll('.user-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    currentUser = btn.dataset.user
    await window.api.setSetting('user_name', currentUser)
    userSelectScreen.classList.add('hidden')
    await showMainScreen()
  })
})

async function showMainScreen() {
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await refreshStats()
  mainScreen.classList.remove('hidden')
}

// ── Categories ────────────────────────────────────────────────────────────────

function renderCategories() {
  categoriesList.innerHTML = ''
  categories.forEach(cat => {
    const li = document.createElement('li')
    li.className = 'category-item'
    li.dataset.id = cat.id
    li.style.setProperty('--cat-color', cat.color)
    li.innerHTML = `
      <span class="category-dot" style="background:${cat.color}"></span>
      <span class="category-name">${cat.name}</span>
    `
    li.addEventListener('click', () => selectCategory(cat.id))
    categoriesList.appendChild(li)
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
  document.querySelectorAll('.category-item').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.id) === id)
  })
  timerBtn.disabled = false
  noCategoryHint.classList.add('hidden')
  dialogCategorySelect.value = id
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}h ${m}m ${s}s`
}

async function refreshStats() {
  const [stats, sharedTotal, period] = await Promise.all([
    window.api.getMonthlyStats(currentUser),
    window.api.getSharedTotal(),
    window.api.getPeriodSettings(),
  ])
  renderLimitBar(sharedTotal, period)
  renderStats(stats)
}

function renderLimitBar(totalSeconds, period) {
  const limit = period.monthly_limit_seconds
  const over  = totalSeconds > limit

  let pct, color
  if (!over) {
    pct   = limit > 0 ? Math.round((totalSeconds / limit) * 100) : 0
    color = '#4ade80'
  } else {
    // перезаполняем красным: показываем сколько сверх лимита
    const overflow = totalSeconds - limit
    pct   = Math.min(Math.round((overflow / limit) * 100), 100)
    color = '#f87171'
  }

  limitBarFill.style.width      = pct + '%'
  limitBarFill.style.background = color
  limitBarTime.textContent      = `${formatDuration(totalSeconds)} / ${formatDuration(limit)}`
  limitBarTime.style.color      = over ? '#f87171' : '#5a5a7a'

  const fmtDate = iso => {
    const [, m, d] = iso.split('-')
    const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
    return `${Number(d)} ${months[Number(m) - 1]}`
  }
  limitBarLabel.textContent = `${fmtDate(period.period_start)} — ${fmtDate(period.period_end)}`
}

function renderStats(stats) {
  statsContainer.innerHTML = ''
  if (!stats.length) return

  const maxTotal = stats[0].total

  stats.forEach(row => {
    const pct = Math.round((row.total / maxTotal) * 100)

    const item = document.createElement('div')
    item.className = 'stat-item'
    item.innerHTML = `
      <div class="stat-header">
        <span class="stat-dot" style="background:${row.color}"></span>
        <span class="stat-name">${row.name}</span>
        <span class="stat-time">${formatDuration(row.total)}</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width:${pct}%;background:${row.color}"></div>
      </div>
    `
    statsContainer.appendChild(item)
  })
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
}

function start() {
  running = true
  startTime = Date.now()
  if (elapsed === 0) sessionStartedAt = startTime
  interval = setInterval(tick, 500)
  timerBtn.textContent = 'Stop'
  timerBtn.classList.add('stop')
  timerRing.classList.add('running')
  resetBtn.classList.add('hidden')
}

function stop() {
  running = false
  elapsed += Date.now() - startTime
  clearInterval(interval)
  interval = null
  timerDisplay.textContent = formatTime(elapsed)
  timerBtn.textContent = 'Start'
  timerBtn.classList.remove('stop')
  timerRing.classList.remove('running')
  resetBtn.classList.remove('hidden')
  openSaveDialog()
}

function resetTimer() {
  elapsed = 0
  sessionStartedAt = null
  timerDisplay.textContent = '00:00:00'
  resetBtn.classList.add('hidden')
}

timerBtn.addEventListener('click', () => {
  if (running) stop()
  else start()
})

resetBtn.addEventListener('click', () => {
  if (!running) resetTimer()
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

// ── Burger menu ───────────────────────────────────────────────────────────────

burgerBtn.addEventListener('click', e => {
  e.stopPropagation()
  burgerDropdown.classList.toggle('hidden')
})

document.addEventListener('click', () => {
  burgerDropdown.classList.add('hidden')
})

menuSettings.addEventListener('click', () => {
  burgerDropdown.classList.add('hidden')
  openSettings()
})

menuAbout.addEventListener('click', () => {
  burgerDropdown.classList.add('hidden')
  openAbout()
})

function openSettings() {
  // reset to user tab
  settingsTabs.forEach(t => t.classList.remove('active'))
  settingsPanes.forEach(p => p.classList.add('hidden'))
  document.querySelector('[data-tab="user"]').classList.add('active')
  document.getElementById('pane-user').classList.remove('hidden')

  settingsModal.classList.remove('hidden')
  loadUserTab()
}

function closeSettings() {
  settingsModal.classList.add('hidden')
}

settingsClose.addEventListener('click', closeSettings)

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

function openAbout() {
  aboutModal.classList.remove('hidden')
}

aboutClose.addEventListener('click', () => {
  aboutModal.classList.add('hidden')
})

const AVATAR_FILES = [
  'user.svg', 'man.png', 'man_1.png', 'man_2.png', 'man_3.png',
  'woman.png', 'woman_1.png', 'woman_2.png', 'woman_3.png'
]

async function loadUserTab() {
  userNameDisplay.textContent = currentUser === 'Sasha' ? 'Саша' : 'Максим'
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

userNameEditBtn.addEventListener('click', () => {
  userNamePicker.classList.remove('hidden')
  userNameEditBtn.classList.add('hidden')
})

document.querySelectorAll('.user-pick-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const newUser = btn.dataset.user
    await window.api.setSetting('user_name', newUser)
    currentUser = newUser
    userNameDisplay.textContent = newUser === 'Sasha' ? 'Саша' : 'Максим'
    userNamePicker.classList.add('hidden')
    userNameEditBtn.classList.remove('hidden')
    await refreshStats()
  })
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

  const isAdmin = currentUser === 'Maxim'
  limitInput.disabled = !isAdmin
  periodStartInput.disabled = !isAdmin
  periodEndInput.disabled = !isAdmin
  limitSaveBtn.classList.toggle('hidden', !isAdmin)
  limitAdminNote.classList.toggle('hidden', isAdmin)
}

limitSaveBtn.addEventListener('click', async () => {
  if (currentUser !== 'Maxim') return
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
let catEditingColor = CAT_COLORS[0]

const catSettingsList = document.getElementById('cat-settings-list')
const catAddBtn       = document.getElementById('cat-add-btn')
const catEditForm     = document.getElementById('cat-edit-form')
const catNameInput    = document.getElementById('cat-name-input')
const catColorSwatch  = document.getElementById('cat-color-swatch')
const catColorPalette = document.getElementById('cat-color-palette')
const catEditCancel   = document.getElementById('cat-edit-cancel')
const catEditSave     = document.getElementById('cat-edit-save')

async function loadCategoriesTab() {
  catEditForm.classList.add('hidden')
  catColorPalette.classList.add('hidden')
  const cats = await window.api.getCategories()
  catSettingsList.innerHTML = ''
  cats.forEach(cat => {
    const li = document.createElement('li')
    li.className = 'cat-settings-item'
    const dot  = document.createElement('span')
    dot.className = 'cat-settings-dot'
    dot.style.background = cat.color
    const name = document.createElement('span')
    name.className = 'cat-settings-name'
    name.textContent = cat.name
    const btn  = document.createElement('button')
    btn.className = 'settings-row-btn'
    btn.textContent = 'Изменить'
    btn.addEventListener('click', () => openCatForm(cat.id, cat.name, cat.color))
    li.append(dot, name, btn)
    catSettingsList.appendChild(li)
  })
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

const calendarBtn   = document.getElementById('calendar-btn')
const calendarModal = document.getElementById('calendar-modal')
const calendarClose = document.getElementById('calendar-close')
const calPrev       = document.getElementById('cal-prev')
const calNext       = document.getElementById('cal-next')
const calTitle      = document.getElementById('cal-title')
const calGrid       = document.getElementById('calendar-grid')
const syncDot       = document.getElementById('sync-dot')
const syncBtn       = document.getElementById('sync-btn')

function formatLastSync(ts) {
  if (!ts) return '—'
  const d   = new Date(ts)
  const now = new Date()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  if (d.toDateString() === now.toDateString()) {
    return `Сегодня в ${hh}:${mm}`
  }
  const dd   = String(d.getDate()).padStart(2, '0')
  const mo   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mo}.${yyyy} ${hh}:${mm}`
}

async function loadSyncTab() {
  const seconds = await window.api.getSyncInterval()
  document.getElementById('sync-interval-select').value = String(seconds || 300)
  const ts = await window.api.getLastSync()
  document.getElementById('sync-last-time').textContent = formatLastSync(ts)
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
  editBtn.textContent = 'Изменить'
  editBtn.addEventListener('click', () => openHoursForm(session))

  const delBtn = document.createElement('button')
  delBtn.className = 'settings-row-btn hours-del-btn'
  delBtn.textContent = 'Удалить'

  btns.append(editBtn, delBtn)

  const confirm = document.createElement('div')
  confirm.className = 'hours-confirm-delete hidden'

  const confirmText = document.createElement('span')
  confirmText.className = 'hours-confirm-text'
  confirmText.textContent = 'Удалить?'

  const yesBtn = document.createElement('button')
  yesBtn.className = 'hours-confirm-yes'
  yesBtn.textContent = 'Да'

  const noBtn = document.createElement('button')
  noBtn.className = 'cat-edit-cancel'
  noBtn.textContent = 'Нет'

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

const RU_MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
]

calendarBtn.addEventListener('click', openCalendar)

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
  calTitle.textContent = `${RU_MONTHS[calMonth - 1]} ${calYear}`
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
      ;['Sasha', 'Maxim'].forEach(user => {
        const secs = dayMap[dayStr][user]
        if (!secs) return
        const row  = document.createElement('div')
        row.className = 'cal-user-row'
        const img  = document.createElement('img')
        img.className = 'cal-avatar'
        img.src = `../../assets/icons/${avatars[user]}`
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
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── Sync ──────────────────────────────────────────────────────────────────────

window.api.onPeerUpdated(async () => {
  await refreshStats()
  if (!calendarModal.classList.contains('hidden')) {
    await loadCalendarMonth()
  }
})

window.api.onSyncStatus(connected => {
  syncDot.classList.toggle('connected', connected)
})

syncBtn.addEventListener('click', () => {
  if (syncBtn.disabled) return
  syncBtn.textContent = 'Sync...'
  syncBtn.disabled = true
  window.api.syncNow()
  setTimeout(() => {
    syncBtn.textContent = 'Sync'
    syncBtn.disabled = false
  }, 1500)
})

document.getElementById('sync-interval-select').addEventListener('change', async (e) => {
  await window.api.setSyncInterval(Number(e.target.value))
})

window.api.onSyncDone(ts => {
  const el = document.getElementById('sync-last-time')
  if (el) el.textContent = formatLastSync(ts)
})

// ── Start ─────────────────────────────────────────────────────────────────────

init()
