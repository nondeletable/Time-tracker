// Пресет-категории для первого запуска — без зависимостей от Electron/БД (тестируется отдельно).

const PRESET_CATEGORIES_RU = [
  { name: 'Работа',       color: '#60a5fa', sort_order: 0 },
  { name: 'Учёба',        color: '#c084fc', sort_order: 1 },
  { name: 'Встречи',      color: '#fb923c', sort_order: 2 },
  { name: 'Коммуникация', color: '#f472b6', sort_order: 3 },
  { name: 'Перерыв',      color: '#f87171', sort_order: 4 },
  { name: 'Личное',       color: '#34d399', sort_order: 5 },
]

const PRESET_CATEGORIES_EN = [
  { name: 'Work',          color: '#60a5fa', sort_order: 0 },
  { name: 'Study',         color: '#c084fc', sort_order: 1 },
  { name: 'Meetings',      color: '#fb923c', sort_order: 2 },
  { name: 'Communication', color: '#f472b6', sort_order: 3 },
  { name: 'Break',         color: '#f87171', sort_order: 4 },
  { name: 'Personal',      color: '#34d399', sort_order: 5 },
]

function pickPresetCategories(lang) {
  return lang === 'ru' ? PRESET_CATEGORIES_RU : PRESET_CATEGORIES_EN
}

module.exports = { pickPresetCategories }
