const test = require('node:test')
const assert = require('node:assert/strict')

const { addOneMonth, advancePeriod } = require('../src/main/period')

test('addOneMonth: обычный месяц', () => {
  assert.equal(addOneMonth('2026-05-27'), '2026-06-27')
})

test('addOneMonth: переход через год', () => {
  assert.equal(addOneMonth('2026-12-27'), '2027-01-27')
})

test('addOneMonth: clamp к последнему дню короткого месяца', () => {
  assert.equal(addOneMonth('2026-01-31'), '2026-02-28')
})

test('addOneMonth: clamp в високосном году', () => {
  assert.equal(addOneMonth('2028-01-31'), '2028-02-29')
})

test('advancePeriod: пропущено два месяца — реальный кейс со скрина', () => {
  const r = advancePeriod('2026-05-27', '2026-06-26', '2026-08-14')
  assert.deepEqual(r, { start: '2026-07-27', end: '2026-08-26', changed: true })
})

test('advancePeriod: сегодня внутри периода — без изменений', () => {
  const r = advancePeriod('2026-08-01', '2026-08-31', '2026-08-14')
  assert.deepEqual(r, { start: '2026-08-01', end: '2026-08-31', changed: false })
})

test('advancePeriod: сегодня равно последнему дню периода — период ещё активен', () => {
  const r = advancePeriod('2026-05-27', '2026-08-26', '2026-08-26')
  assert.deepEqual(r, { start: '2026-05-27', end: '2026-08-26', changed: false })
})

test('advancePeriod: ровно один месяц вперёд', () => {
  const r = advancePeriod('2026-05-27', '2026-06-26', '2026-06-27')
  assert.deepEqual(r, { start: '2026-06-27', end: '2026-07-26', changed: true })
})
