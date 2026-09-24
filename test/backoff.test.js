const test = require('node:test')
const assert = require('node:assert/strict')

const { reconnectDelay, RECONNECT_BASE_MS, RECONNECT_MAX_MS } = require('../src/main/backoff')

const lowest = () => 0
const highest = () => 1 - Number.EPSILON

// Окно замкнуто с обеих сторон: при random, стремящемся к единице, сумма
// step/2 + random * step/2 в плавающей точке округляется ровно до step.
test('первая попытка ждёт от половины базы до целой базы', () => {
  assert.equal(reconnectDelay(0, lowest), RECONNECT_BASE_MS / 2)
  assert.ok(reconnectDelay(0, highest) <= RECONNECT_BASE_MS)
  assert.ok(reconnectDelay(0, highest) > RECONNECT_BASE_MS * 0.99)
})

test('окно удваивается с каждой попыткой', () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const floor = reconnectDelay(attempt, lowest)
    assert.equal(floor, RECONNECT_BASE_MS * 2 ** attempt / 2)
    assert.equal(reconnectDelay(attempt + 1, lowest), floor * 2)
  }
})

test('лестница упирается в потолок и дальше не растёт', () => {
  assert.equal(reconnectDelay(50, lowest), RECONNECT_MAX_MS / 2)
  assert.ok(reconnectDelay(50, highest) <= RECONNECT_MAX_MS)
  assert.equal(reconnectDelay(50, lowest), reconnectDelay(99, lowest))
})

test('пол окна держится: разброс не может вернуть задержку к нулю', () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    assert.ok(reconnectDelay(attempt, lowest) >= RECONNECT_BASE_MS / 2)
  }
})

test('разброс реально разводит два экземпляра, а не совпадает', () => {
  const rolls = new Set()
  for (let i = 0; i < 200; i++) rolls.add(reconnectDelay(4))
  assert.ok(rolls.size > 150, `ожидался разброс, получено уникальных значений: ${rolls.size}`)
})
