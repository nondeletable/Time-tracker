// The "saved" mark that blinks next to a setting's label. Settings, Appearance
// and the language switch all call it, so it cannot stay inside Settings once
// Appearance leaves app.js - importing it back from app.js would make a cycle.

// Кнопок «Сохранить» в карточках нет: значение уходит в базу по change, а
// справа от подписи коротко мигает «сохранено».
export function flashSaved(el) {
  const mark = el?.closest('.row')?.querySelector('.saved')
  if (!mark) return
  mark.classList.add('on')
  clearTimeout(mark._t)
  mark._t = setTimeout(() => mark.classList.remove('on'), 1400)
}
