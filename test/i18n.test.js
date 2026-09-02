const test = require('node:test')
const assert = require('node:assert/strict')

const { detectLang, translate, keySets } = require('../src/renderer/js/i18n/i18n')
const dict = require('../src/renderer/js/i18n/dict')

test('detectLang: русская локаль → ru', () => {
  assert.equal(detectLang('ru'), 'ru')
  assert.equal(detectLang('ru-RU'), 'ru')
  assert.equal(detectLang('RU'), 'ru')
})

test('detectLang: прочие локали → en', () => {
  assert.equal(detectLang('en-US'), 'en')
  assert.equal(detectLang('de'), 'en')
  assert.equal(detectLang(''), 'en')
  assert.equal(detectLang(undefined), 'en')
})

test('translate: берёт строку нужного языка', () => {
  const dict = { ru: { hi: 'Привет' }, en: { hi: 'Hi' } }
  assert.equal(translate(dict, 'ru', 'hi'), 'Привет')
  assert.equal(translate(dict, 'en', 'hi'), 'Hi')
})

test('translate: фолбэк на en, затем на сам ключ', () => {
  const dict = { ru: {}, en: { hi: 'Hi' } }
  assert.equal(translate(dict, 'ru', 'hi'), 'Hi')
  assert.equal(translate(dict, 'ru', 'missing'), 'missing')
})

test('keySets: возвращает отсортированные ключи по языкам без months/weekdays', () => {
  const d = { ru: { b: '1', a: '2', months: [], weekdays: [] }, en: { a: '3', b: '4' } }
  const ks = keySets(d)
  assert.deepEqual(ks.ru, ['a', 'b'])
  assert.deepEqual(ks.en, ['a', 'b'])
})

test('dict: ru и en имеют одинаковый набор ключей', () => {
  const ks = keySets(dict)
  assert.deepEqual(ks.ru, ks.en)
})

test('dict: months и weekdays правильной длины в обоих языках', () => {
  for (const lang of ['ru', 'en']) {
    assert.equal(dict[lang].months.length, 12, `${lang}.months`)
    assert.equal(dict[lang].weekdays.length, 7, `${lang}.weekdays`)
  }
})
