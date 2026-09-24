// Hours over a period, split by day and by person. Two views ask for it - the
// Focus panel through renderAverage, and the whole Summary screen - so it does
// not belong to either. No DOM, no state: a period in, two maps and two numbers
// out.

// Период не совпадает с календарным месяцем (28 авг — 27 сен пересекает два),
// поэтому собираем каждый месяц, который он задевает, и отбрасываем дни за
// границами. getCalendarMonth отдаёт сразу и свои сессии, и данные партнёра,
// так что суммы получаются общими на двоих — как и полоса лимита рядом.
export async function periodBreakdown(period) {
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
