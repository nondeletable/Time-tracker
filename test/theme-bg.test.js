const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { backgroundFromCss, activeTheme } = require('../src/main/theme-bg')

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'css', 'style.css'),
  'utf8'
)

const THEMES = ['emerald-dark', 'emerald-light', 'indigo-dark', 'indigo-light']

test('фон находится для всех четырёх тем и все они разные', () => {
  const found = THEMES.map(t => backgroundFromCss(CSS, t))
  found.forEach((bg, i) => assert.match(bg || '', /^#[0-9a-f]{6}$/i, `${THEMES[i]}: ${bg}`))
  assert.equal(new Set(found).size, THEMES.length, `цвета повторяются: ${found.join(' ')}`)
})

test('неизвестная тема — откат на фон :root, а не null', () => {
  assert.equal(backgroundFromCss(CSS, 'no-such-theme'), backgroundFromCss(CSS, 'emerald-dark'))
})

test('мусор на входе не роняет разбор', () => {
  assert.equal(backgroundFromCss(null, 'emerald-dark'), null)
  assert.equal(backgroundFromCss('нет тут цветов', 'emerald-dark'), null)
  // имя темы чистится от всего, кроме [a-z0-9-], поэтому скобки и кавычки из
  // него не могут собрать свою регулярку — остаётся обычный откат на :root
  assert.equal(
    backgroundFromCss(CSS, 'emerald-dark"] { --bg:#ff0000 } ['),
    backgroundFromCss(CSS, 'emerald-dark')
  )
})

test('активная тема выбирается по режиму, а не по последней правке', () => {
  assert.equal(activeTheme('light', 'emerald-light', 'indigo-dark'), 'emerald-light')
  assert.equal(activeTheme('dark', 'emerald-light', 'indigo-dark'), 'indigo-dark')
  assert.equal(activeTheme(undefined, null, null), 'emerald-dark')
  assert.equal(activeTheme('light', null, null), 'emerald-light')
})
