// The Summary view: the period limit shared by the group, today, the daily
// average, the category donut, the day chart and the category table. It owns no
// mutable state at all - every render reads the period and the stats fresh over
// IPC - so the only thing the rest of the renderer needs is one entry point.
//
// shortDate and userColor were counted as Settings helpers by the coupling
// measurement; reading the code shows nothing outside this view calls them, so
// they come along and stay private here.

import { esc, todayISO, localISODate, daysBetween, formatHM } from './format.js'
import { t, langDict } from './lang.js'
import { periodBreakdown } from './breakdown.js'
import { CAT_COLORS } from './palette.js'
import { getUser } from './user.js'

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

export async function loadSummaryView() {
  if (!getUser()) return
  const [stats, sharedTotal, period, todaySessions] = await Promise.all([
    window.api.getMonthlyStats(getUser()),
    window.api.getSharedTotal(),
    window.api.getPeriodSettings(),
    window.api.getSessionsByDate(getUser(), todayISO()),
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
    .sort((a, b) => (a[0] === getUser() ? -1 : b[0] === getUser() ? 1 : b[1] - a[1]))

  sumStack.innerHTML = users.map(([, seconds], i) =>
    `<span style="width:${limit > 0 ? (seconds / limit) * 100 : 0}%;background:${userColor(i)}"></span>`
  ).join('')

  sumLegend.innerHTML = users.map(([name, seconds], i) =>
    `<b><i class="legend-dot" style="background:${userColor(i)}"></i>${esc(name)} <span class="v">${formatHM(seconds)}</span></b>`
  ).join('') + (left > 0
    ? `<b><i class="legend-dot" style="background:var(--surface-2)"></i>${t('sum_free')} <span class="v">${formatHM(left)}</span></b>`
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
    `<div class="dl-row"><i class="dl-dot" style="background:${esc(row.color)}"></i><span class="n">${esc(row.name)}</span><span class="v">${Math.round(row.total / total * 100)}%</span></div>`
  ).join('') + (rest.length
    ? `<div class="dl-row"><i class="dl-dot" style="background:var(--surface-2)"></i><span class="n">${t('sum_more')} ${rest.length}</span><span class="v">${Math.round(rest.reduce((s, r) => s + r.total, 0) / total * 100)}%</span></div>`
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
      <td><span class="mini"><span class="mini-fill" style="width:${row.total / max * 100}%;background:${esc(row.color)}"></span></span></td>
      <td class="num">${row.sessions}</td>
      <td class="num">${formatHM(row.total)}</td>
    </tr>`).join('')
}
