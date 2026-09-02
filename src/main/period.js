// Чистая логика периода общего лимита (без зависимостей от Electron/БД — тестируется отдельно).

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Прибавляет один календарный месяц к дате 'YYYY-MM-DD'.
// Если в целевом месяце нет такого числа (напр. 31-е), обрезает до последнего дня месяца.
function addOneMonth(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const nextMonthIdx = m // m — 1-based текущий месяц == 0-based индекс следующего
  const lastDay = new Date(y, nextMonthIdx + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  return fmt(new Date(y, nextMonthIdx, day))
}

// Сдвигает период вперёд по одному месяцу, пока он не покроет today.
// Период активен в день end включительно, поэтому продлеваем только когда end строго раньше today.
// Даты в формате 'YYYY-MM-DD' сравниваются лексикографически = хронологически.
function advancePeriod(start, end, today) {
  let changed = false
  let guard = 0
  while (end < today && guard < 600) {
    start = addOneMonth(start)
    end = addOneMonth(end)
    changed = true
    guard++
  }
  return { start, end, changed }
}

module.exports = { addOneMonth, advancePeriod }
