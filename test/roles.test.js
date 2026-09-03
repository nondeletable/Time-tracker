const test = require('node:test')
const assert = require('node:assert/strict')

const { canEditLimit, isGrouped } = require('../src/renderer/js/roles')

test('canEditLimit: solo и owner редактируют, member — нет', () => {
  assert.equal(canEditLimit('solo'), true)
  assert.equal(canEditLimit('owner'), true)
  assert.equal(canEditLimit('member'), false)
})

test('isGrouped: только owner и member в группе', () => {
  assert.equal(isGrouped('solo'), false)
  assert.equal(isGrouped('owner'), true)
  assert.equal(isGrouped('member'), true)
})
