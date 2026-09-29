const test = require('node:test')
const assert = require('node:assert/strict')

const { isOurFrame } = require('../src/main/ipc-sender')

// Подставные объекты повторяют ровно то, что читает проверка: у окна —
// isDestroyed() и webContents.mainFrame, у кадра — только его идентичность.
const mainFrame = { name: 'main' }
const window = (destroyed = false) => ({
  isDestroyed: () => destroyed,
  webContents: { mainFrame },
})

test('главный кадр нашего окна пропускается', () => {
  assert.equal(isOurFrame(mainFrame, window()), true)
})

test('чужой кадр отклоняется', () => {
  assert.equal(isOurFrame({ name: 'iframe' }, window()), false)
  // и главный кадр другого окна — тоже чужой
  const otherWindow = { isDestroyed: () => false, webContents: { mainFrame: { name: 'other' } } }
  assert.equal(isOurFrame(mainFrame, otherWindow), false)
})

test('кадр, которого уже нет, отклоняется', () => {
  assert.equal(isOurFrame(null, window()), false)
  assert.equal(isOurFrame(undefined, window()), false)
})

test('разрушенное или ещё не созданное окно отклоняет всё', () => {
  assert.equal(isOurFrame(mainFrame, window(true)), false)
  assert.equal(isOurFrame(mainFrame, null), false)
})
