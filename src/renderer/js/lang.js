// The active language and the three wrappers around it. t() alone is called 42
// times from every corner of app.js, so while it sat there no other domain could
// leave the file without dragging the language state along. currentLang stays
// private here: the six places that used to assign it now go through setLang.
//
// I18N and DICT keep coming off window - i18n/i18n.js and i18n/dict.js are still
// classic scripts, loaded ahead of the module, because node --test requires them
// as CommonJS.

let currentLang = 'ru'

export function getLang() {
  return currentLang
}

export function setLang(lang) {
  currentLang = lang
}

export function t(key) {
  return window.I18N.translate(window.DICT, currentLang, key)
}

// Названия месяцев и дней недели лежат массивами и через translate() не
// проходят. Для языков без своего словаря — DE и ES — отдаём английский, тем
// же правилом, по которому фолбэчит translate().
export function langDict() {
  return window.DICT[currentLang] || window.DICT.en
}

export function applyI18n() {
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
