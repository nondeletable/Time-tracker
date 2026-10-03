const test = require('node:test')
const assert = require('node:assert/strict')

const { zoomFor } = require('../src/main/window-zoom')

test('the design size keeps factor 1', () => {
  assert.equal(zoomFor(1280, 812), 1)
})

test('a window smaller than the design size is never shrunk', () => {
  assert.equal(zoomFor(960, 780), 1)
  assert.equal(zoomFor(1920, 700), 1)
})

test('the nearer edge sets the factor', () => {
  assert.equal(zoomFor(2560, 1624), 2)
  assert.equal(zoomFor(2560, 1218), 1.5)
  assert.equal(zoomFor(1920, 1624), 1.5)
})

test('a maximized 2560x1560 window scales by height', () => {
  assert.equal(zoomFor(2560, 1560), 1560 / 812)
})
