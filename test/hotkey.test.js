const test = require('node:test')
const assert = require('node:assert/strict')

const { isValidAccelerator, DEFAULT_HOTKEY } = require('../src/main/hotkey')

test('сочетание с Ctrl, Alt или Super и обычной клавишей принимается', () => {
  for (const accel of ['CommandOrControl+Alt+S', 'Alt+F9', 'Super+Shift+Space', 'CommandOrControl+Shift+7', 'Alt+F24']) {
    assert.equal(isValidAccelerator(accel), true, accel)
  }
})

test('без Ctrl, Alt и Super отклоняется — это обычный набор текста', () => {
  for (const accel of ['S', 'Shift+S', 'Shift+Space', 'F9']) {
    assert.equal(isValidAccelerator(accel), false, accel)
  }
})

test('одни модификаторы, неизвестная клавиша или повтор отклоняются', () => {
  for (const accel of ['CommandOrControl+Alt', 'Alt+Tab', 'Alt+F25', 'Alt+s', 'Alt+Alt+S', 'Ctrl+S', '']) {
    assert.equal(isValidAccelerator(accel), false, accel)
  }
})

test('сочетание по умолчанию само проходит проверку', () => {
  assert.equal(isValidAccelerator(DEFAULT_HOTKEY), true)
})

test('не строка — отклоняется, а не роняет', () => {
  for (const accel of [null, undefined, 42, {}]) {
    assert.equal(isValidAccelerator(accel), false, String(accel))
  }
})
