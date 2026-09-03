const test = require('node:test')
const assert = require('node:assert/strict')

const {
  ALPHABET, CODE_LEN, generateCode, normalizeCode,
  validateHandshake, isSelf, shouldApplyLimit,
} = require('../src/main/group')

test('generateCode: длина CODE_LEN, только символы из ALPHABET', () => {
  // Детерминированный rng: прогоняем по всем индексам алфавита
  let i = 0
  const rng = () => (i++ % ALPHABET.length) / ALPHABET.length
  const code = generateCode(rng)
  assert.equal(code.length, CODE_LEN)
  assert.ok([...code].every(ch => ALPHABET.includes(ch)))
})

test('generateCode: rng=0 → первый символ алфавита повторён', () => {
  assert.equal(generateCode(() => 0), ALPHABET[0].repeat(CODE_LEN))
})

test('generateCode: без похожих символов (0,O,1,I,L)', () => {
  assert.ok(!/[01OIL]/.test(ALPHABET))
})

test('normalizeCode: trim + upper, null-safe', () => {
  assert.equal(normalizeCode('  ab2c  '), 'AB2C')
  assert.equal(normalizeCode(null), '')
  assert.equal(normalizeCode(undefined), '')
})

test('validateHandshake: совпадение/несовпадение/пустой', () => {
  assert.equal(validateHandshake('ABC234', { code: 'ABC234' }), true)
  assert.equal(validateHandshake('ABC234', { code: 'XXX999' }), false)
  assert.equal(validateHandshake('ABC234', { code: '' }), false)
  assert.equal(validateHandshake('', { code: '' }), false)
  assert.equal(validateHandshake('ABC234', null), false)
})

test('isSelf: по install_id', () => {
  assert.equal(isSelf({ installId: 'me' }, 'me'), true)
  assert.equal(isSelf({ installId: 'other' }, 'me'), false)
  assert.equal(isSelf({}, 'me'), false)
})

test('shouldApplyLimit: только member принимает от owner', () => {
  assert.equal(shouldApplyLimit('member', 'owner'), true)
  assert.equal(shouldApplyLimit('member', 'member'), false)
  assert.equal(shouldApplyLimit('owner', 'owner'), false)
  assert.equal(shouldApplyLimit('solo', 'owner'), false)
})
