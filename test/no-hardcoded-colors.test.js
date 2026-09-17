const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'css', 'style.css'),
  'utf8'
)

// Raw hex is allowed ONLY in custom-property definitions (--x: #hex), which
// includes the :root fallback and the per-theme anchor blocks. Anywhere else
// (color:/background:/border: …) colors must go through var(--…)/color-mix.
test('style.css uses raw hex only in custom-property definitions', () => {
  const offenders = CSS
    .split('\n')
    .map((line, i) => ({ n: i + 1, line }))
    .filter(({ line }) => /#[0-9a-fA-F]{3,8}\b/.test(line))
    .filter(({ line }) => !/^\s*--[a-z0-9-]+\s*:/.test(line))
    .map(({ n, line }) => `${n}: ${line.trim()}`)
  assert.deepEqual(offenders, [], `raw hex outside token definitions:\n${offenders.join('\n')}`)
})
