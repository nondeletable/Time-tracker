// Чистая логика i18n — без DOM. UMD: работает и в node (require), и в браузере (window.I18N).
(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.I18N = api
})(globalThis, function () {
  function detectLang(locale) {
    return String(locale || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'
  }

  function translate(dict, lang, key) {
    const table = dict[lang] || {}
    if (key in table) return table[key]
    const en = dict.en || {}
    if (key in en) return en[key]
    return key
  }

  function keySets(dict) {
    const out = {}
    for (const lang of Object.keys(dict)) {
      out[lang] = Object.keys(dict[lang])
        .filter(k => k !== 'months' && k !== 'weekdays')
        .sort()
    }
    return out
  }

  return { detectLang, translate, keySets }
})
