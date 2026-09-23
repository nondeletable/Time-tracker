// Достаёт фон темы из style.css — чистый разбор строки, без Electron и без fs.
// UMD: node + браузер, как window-bounds.
//
// Зачем разбирать CSS, а не прописать четыре цвета константой в main: анкеры
// тем живут в одном месте (style.css), и правка палитры не должна требовать
// синхронной правки главного процесса. Молча разъехавшийся фон окна — ровно
// тот баг, который никто не заметит до релиза.
(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.THEME_BG = api
})(globalThis, function () {
  const BG = /--bg\s*:\s*(#[0-9a-fA-F]{3,8})/

  // Возвращает значение --bg для темы, либо фон :root, если такой темы в
  // файле нет, либо null, если не нашлось и его.
  function backgroundFromCss(css, theme) {
    if (typeof css !== 'string') return null
    const safe = String(theme || '').replace(/[^a-z0-9-]/gi, '')
    const block = safe && new RegExp('\\[data-theme="' + safe + '"\\]\\s*\\{([^}]*)\\}').exec(css)
    const found = block && BG.exec(block[1])
    if (found) return found[1]
    const fallback = BG.exec(css)
    return fallback ? fallback[1] : null
  }

  // Какая тема активна: режим хранится отдельно от самих тем, поэтому
  // светлая и тёмная не затирают друг друга при переключении.
  function activeTheme(mode, light, dark) {
    return mode === 'light' ? (light || 'emerald-light') : (dark || 'emerald-dark')
  }

  return { backgroundFromCss, activeTheme }
})
