let currentUser = null
let categories = []
let selectedCategoryId = null

let running = false
let startTime = 0
let elapsed = 0
let interval = null
let sessionStartedAt = null

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

// ── Start ─────────────────────────────────────────────────────────────────────

init()
