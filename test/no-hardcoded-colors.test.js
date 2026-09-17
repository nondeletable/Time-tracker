const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'css', 'style.css'),
  'utf8'
)

// Everything outside the :root token block must reference colors via var(--…),
// never raw hex. The :root block is the single source of truth for the palette.
function stripRootBlock(css) {
  const start = css.indexOf(':root')
  if (start === -1) return css
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open) // :root has no nested braces
  return css.slice(0, start) + css.slice(close + 1)
}

test('style.css has no raw hex colors outside the :root token block', () => {
  const body = stripRootBlock(CSS)
  const offenders = body
    .split('\n')
    .map((line, i) => ({ n: i + 1, line }))
    .filter(({ line }) => /#[0-9a-fA-F]{3,8}\b/.test(line))
    .map(({ n, line }) => `${n}: ${line.trim()}`)
  assert.deepEqual(offenders, [], `raw hex found:\n${offenders.join('\n')}`)
})
