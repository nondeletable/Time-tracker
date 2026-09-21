const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const HEX = /#[0-9a-fA-F]{3,8}\b/

// Raw hex is allowed ONLY in custom-property definitions (--x: #hex), which
// includes the :root fallback and the per-theme anchor blocks. Anywhere else
// (color:/background:/border: …) colors must go through var(--…)/color-mix.
//
// Разбор идёт по декларациям, а не по строкам: блоки тем написаны в одну
// строку по нескольку деклараций сразу (`--bg:#0b0f14; --surface:#11161d;`),
// и построчная проверка пропускала бы любой `background:#ff0000` по соседству
// с определением токена.
function hexOffenders(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '))
  const offenders = []
  let start = 0

  for (let i = 0; i <= src.length; i++) {
    const ch = src[i]
    if (i < src.length && ch !== ';' && ch !== '{' && ch !== '}') continue

    const chunk = src.slice(start, i)
    start = i + 1
    // `{` закрывает селектор или прелюдию at-правила, а не декларацию
    if (ch === '{') continue

    const hex = chunk.match(HEX)
    if (!hex) continue
    const prop = chunk.match(/([-\w]+)\s*:/)
    if (prop && prop[1].startsWith('--')) continue

    const line = src.slice(0, start - chunk.length + hex.index).split('\n').length
    offenders.push(`${line}: ${chunk.trim()}`)
  }
  return offenders
}

test('style.css uses raw hex only in custom-property definitions', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'renderer', 'css', 'style.css'),
    'utf8'
  )
  const offenders = hexOffenders(css)
  assert.deepEqual(offenders, [], `raw hex outside token definitions:\n${offenders.join('\n')}`)
})

test('the guard reads declarations, not lines', () => {
  const themeBlock = ':root {\n  --bg:#0b0f14; --surface:#11161d; --border:#212b37;\n}\n'
  assert.deepEqual(hexOffenders(themeBlock), [])

  // тот же формат, но с настоящим цветом в соседней декларации
  const smuggled = ':root {\n  --bg:#0b0f14; background:#ff0000; --border:#212b37;\n}\n'
  assert.deepEqual(hexOffenders(smuggled), ['2: background:#ff0000'])
})

test('the guard ignores hex inside comments', () => {
  assert.deepEqual(hexOffenders('.x {\n  /* было #ff0000 */\n  color: var(--text);\n}\n'), [])
})
