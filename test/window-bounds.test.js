const test = require('node:test')
const assert = require('node:assert/strict')

const { clampBoundsToScreen } = require('../src/main/window-bounds')

const oneScreen = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }]

test('bounds внутри экрана — возвращается как есть', () => {
  const b = { x: 100, y: 50, width: 700, height: 600 }
  assert.deepEqual(clampBoundsToScreen(b, oneScreen), b)
})

test('окно уехало вправо за экран — null', () => {
  assert.equal(clampBoundsToScreen({ x: 5000, y: 50, width: 700, height: 600 }, oneScreen), null)
})

test('заголовок выше экрана (y<0) — null', () => {
  assert.equal(clampBoundsToScreen({ x: 100, y: -200, width: 700, height: 600 }, oneScreen), null)
})

test('второй монитор — верхний центр на нём — возвращается', () => {
  const two = [
    { workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { workArea: { x: 1920, y: 0, width: 1920, height: 1040 } },
  ]
  const b = { x: 2000, y: 100, width: 700, height: 600 }
  assert.deepEqual(clampBoundsToScreen(b, two), b)
})

test('невалидный bounds / пустые дисплеи — null', () => {
  assert.equal(clampBoundsToScreen(null, oneScreen), null)
  assert.equal(clampBoundsToScreen({ x: 0, y: 0 }, oneScreen), null)
  assert.equal(clampBoundsToScreen({ x: 100, y: 50, width: 700, height: 600 }, []), null)
})
