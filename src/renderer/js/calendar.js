// The Calendar view: the month it shows, the four elements it owns, and the
// arrows that move it. calYear and calMonth were two of the 23 module-level
// variables in app.js, but nothing outside this view ever read or wrote them -
// so they come along and become private here.
//
// What the rest of the renderer needs is three entry points: open the view,
// reload the month in place (a peer's update lands while the view is open), and
// repaint the weekday row after a language switch.

import { localISODate } from './format.js'
import { t, langDict } from './lang.js'

let calYear  = 0
let calMonth = 0

const calPrev  = document.getElementById('cal-prev')
const calNext  = document.getElementById('cal-next')
const calTitle = document.getElementById('cal-title')
const calGrid  = document.getElementById('calendar-grid')

export function renderWeekdays() {
  const spans = document.querySelectorAll('.calendar-weekdays span')
  const wd = langDict().weekdays
  spans.forEach((span, i) => { if (wd[i]) span.textContent = wd[i] })
}

calPrev.addEventListener('click', () => navigateCalendar(-1))
calNext.addEventListener('click', () => navigateCalendar(1))

// Вид открывается на текущем месяце; пролистанный месяц не запоминается
export async function loadCalendarView() {
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

export async function loadCalendarMonth() {
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

function formatCalDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}${t('unit_m')}`
  if (m === 0) return `${h}${t('unit_h')}`
  return `${h}${t('unit_h')} ${m}${t('unit_m')}`
}
