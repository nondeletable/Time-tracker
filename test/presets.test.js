const test = require('node:test')
const assert = require('node:assert/strict')

const { pickPresetCategories } = require('../src/main/presets')

test('pickPresetCategories: ru набор', () => {
  const cats = pickPresetCategories('ru')
  assert.equal(cats.length, 6)
  assert.equal(cats[0].name, 'Работа')
  assert.ok(cats.every(c => c.color && typeof c.sort_order === 'number'))
})

test('pickPresetCategories: en набор (и фолбэк)', () => {
  assert.equal(pickPresetCategories('en')[0].name, 'Work')
  assert.equal(pickPresetCategories('de')[0].name, 'Work')
})
