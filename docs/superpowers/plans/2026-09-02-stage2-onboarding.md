# Этап 2 — Первый запуск + универсальные пресеты Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать хардкод имён «Саша/Максим» из онбординга, переименования и пресет-категорий: первый запуск спрашивает имя (префилл из ОС), пользователь может переименоваться (с переносом данных), пресет-категории универсальные и сидируются на языке ОС.

**Architecture:** Экран первого запуска заменяет кнопки Саша/Максим на поле ввода имени с префиллом `os.userInfo().username` (через новый IPC). Имя хранится в `settings.user_name` как есть и отображается без маппинга. Переименование в настройках — текстовое поле; смена имени переносит `sessions.user` и ключ `avatar_<name>` через IPC-миграцию. Пресеты определяются по локали ОС (`app.getLocale()` → переиспользуем чистый `detectLang` из Этапа 1). Гейт редактирования лимита по имени снимается полностью (соло-режим — редактируют все); роли вернутся в Этапе 3.

**Tech Stack:** Electron (`app.getLocale`, `os.userInfo`), sql.js, vanilla JS, `node:test` для чистой логики, ручная проверка UI через `npm run dev`.

## Global Constraints

- Все новые пользовательские строки — через словари ru/en (Этап 1); хардкод текста запрещён.
- Оба словаря обязаны иметь идентичный набор ключей (тест паритета) и все `data-i18n` ключи из HTML обязаны резолвиться (тест разметки) — оба уже в `test/i18n.test.js`.
- Общий модуль i18n подключается UMD-обёрткой; `src/main` может делать `require('../renderer/js/i18n/i18n')`.
- Переименование пользователя НЕ должно терять его часы: `sessions.user` и `avatar_<user>` переносятся на новое имя.
- Пресеты меняются только для НОВЫХ установок (сидирование при первом запуске); существующие БД не трогаем.
- Стиль коммитов: `feat:` / `test:` / `refactor:` / `docs:`.

---

## Файловая структура

- Create `src/main/presets.js` — универсальные пресеты (ru/en) + чистый `pickPresetCategories(lang)` (без зависимостей от Electron — тестируется отдельно, как `period.js`).
- Modify `src/main/index.js` — сид категорий по `app.getLocale()` через `pickPresetCategories`; убрать сид `avatar_Sasha`/`avatar_Maxim`; IPC `app:get-default-name` и `db:rename-user`.
- Modify `src/preload/index.js` — методы `getDefaultName`, `renameUser`.
- Modify `src/renderer/index.html` — экран первого запуска: поле имени; вкладка «Пользователь»: переименование текстовым полем (вместо кнопок Саша/Максим).
- Modify `src/renderer/js/app.js` — логика первого запуска, переименования, отображение имени как есть, снятие гейта лимита.
- Modify `src/renderer/js/i18n/dict.js` — ключи онбординга/переименования (ru+en).
- Create `test/presets.test.js` — node:test для `pickPresetCategories`.

Ветка этапа: `stage2-onboarding` (от `main`).

---

### Task 0: Ветка этапа

- [ ] **Step 1: Создать ветку от актуального main**

Run:
```bash
git checkout main && git pull --ff-only && git checkout -b stage2-onboarding
```
Expected: `Switched to a new branch 'stage2-onboarding'`

---

### Task 1: Универсальные пресеты по локали + тест

**Files:**
- Create: `src/main/presets.js`
- Create: `test/presets.test.js`
- Modify: `src/main/index.js`

**Interfaces:**
- Produces: `pickPresetCategories(lang: 'ru'|'en'): Array<{name, color, sort_order}>` — экспортируется из `src/main/presets.js` (dependency-free); `'ru'` → русский набор, иначе английский.

- [ ] **Step 1: Написать падающий тест**

Create `test/presets.test.js`:
```js
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/main/presets'`

- [ ] **Step 3: Создать модуль пресетов**

Create `src/main/presets.js`:
```js
// Пресет-категории для первого запуска — без зависимостей от Electron/БД (тестируется отдельно).

const PRESET_CATEGORIES_RU = [
  { name: 'Работа',       color: '#60a5fa', sort_order: 0 },
  { name: 'Учёба',        color: '#c084fc', sort_order: 1 },
  { name: 'Встречи',      color: '#fb923c', sort_order: 2 },
  { name: 'Коммуникация', color: '#f472b6', sort_order: 3 },
  { name: 'Перерыв',      color: '#f87171', sort_order: 4 },
  { name: 'Личное',       color: '#34d399', sort_order: 5 },
]

const PRESET_CATEGORIES_EN = [
  { name: 'Work',          color: '#60a5fa', sort_order: 0 },
  { name: 'Study',         color: '#c084fc', sort_order: 1 },
  { name: 'Meetings',      color: '#fb923c', sort_order: 2 },
  { name: 'Communication', color: '#f472b6', sort_order: 3 },
  { name: 'Break',         color: '#f87171', sort_order: 4 },
  { name: 'Personal',      color: '#34d399', sort_order: 5 },
]

function pickPresetCategories(lang) {
  return lang === 'ru' ? PRESET_CATEGORIES_RU : PRESET_CATEGORIES_EN
}

module.exports = { pickPresetCategories }
```

- [ ] **Step 4: Подключить пресеты и detectLang в index.js**

В `src/main/index.js` вверху (рядом с другими require) добавить:
```js
const { pickPresetCategories } = require('./presets')
const { detectLang } = require('../renderer/js/i18n/i18n')
```
Удалить старый `const PRESET_CATEGORIES = [...]` (строки ~11–18).

- [ ] **Step 5: Использовать локаль при сидировании категорий**

В `src/main/index.js` заменить блок сидирования категорий (строки ~85–91):
```js
  const catCount = db.exec('SELECT COUNT(*) FROM categories')[0].values[0][0]
  if (catCount === 0) {
    const presets = pickPresetCategories(detectLang(app.getLocale()))
    presets.forEach(cat =>
      db.run('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
        [cat.name, cat.color, cat.sort_order])
    )
  }
```

- [ ] **Step 6: Убрать сид name-специфичных аватаров**

В `src/main/index.js` удалить строки:
```js
  seedSetting('avatar_Sasha', 'user.svg')
  seedSetting('avatar_Maxim', 'user.svg')
```
(Аватар читается как `avatar_${currentUser} ?? 'user.svg'` — дефолт не нужен.)

- [ ] **Step 7: Запустить тест — убедиться, что проходит**

Run: `npm test`
Expected: PASS — `presets.test.js` зелёный, остальные не сломаны.

- [ ] **Step 8: Commit**

```bash
git add src/main/presets.js src/main/index.js test/presets.test.js
git commit -m "feat(presets): universal ru/en categories seeded by OS locale"
```

---

### Task 2: OS-username IPC + preload

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/preload/index.js`

**Interfaces:**
- Produces:
  - IPC `app:get-default-name` → `os.userInfo().username` (string; при ошибке — `''`).
  - preload `window.api.getDefaultName(): Promise<string>`.

- [ ] **Step 1: Добавить require os и IPC-хендлер**

В `src/main/index.js` вверху добавить (если ещё нет): `const os = require('os')`.
В функции `setupIPC()` добавить хендлер рядом с прочими:
```js
  ipcMain.handle('app:get-default-name', () => {
    try { return os.userInfo().username || '' } catch { return '' }
  })
```

- [ ] **Step 2: Экспонировать в preload**

В `src/preload/index.js` в объект `api` добавить:
```js
  getDefaultName: () => ipcRenderer.invoke('app:get-default-name'),
```

- [ ] **Step 3: Проверка вручную (dev-консоль)**

Run: `npm run dev`
В DevTools console выполнить: `await window.api.getDefaultName()`
Expected: строка с системным именем пользователя (напр. `"Admin"`).

- [ ] **Step 4: Commit**

```bash
git add src/main/index.js src/preload/index.js
git commit -m "feat(onboarding): IPC to fetch OS username for name prefill"
```

---

### Task 3: Экран первого запуска — ввод имени

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/js/app.js`
- Modify: `src/renderer/js/i18n/dict.js`

**Interfaces:**
- Consumes: `window.api.getDefaultName`, `window.api.setSetting`, `showMainScreen`, `t`.
- Produces: обработчик подтверждения имени на экране первого запуска.

- [ ] **Step 1: Добавить ключи онбординга в оба словаря**

В `src/renderer/js/i18n/dict.js` в блок `ru` (рядом с меню) добавить:
```js
    onboarding_prompt: 'Как тебя зовут?',
    onboarding_placeholder: 'Имя',
    btn_continue: 'Продолжить',
```
В блок `en`:
```js
    onboarding_prompt: 'What is your name?',
    onboarding_placeholder: 'Name',
    btn_continue: 'Continue',
```

- [ ] **Step 2: Переверстать экран первого запуска**

В `src/renderer/index.html` заменить содержимое `#user-select-screen` (кнопки Саша/Максим) на:
```html
  <div id="user-select-screen" class="screen hidden">
    <div class="user-select-box">
      <p class="user-select-label" data-i18n="onboarding_prompt">Как тебя зовут?</p>
      <input type="text" id="onboarding-name-input" class="settings-input"
             data-i18n-placeholder="onboarding_placeholder" placeholder="Имя" maxlength="32">
      <button class="user-btn" id="onboarding-continue" data-i18n="btn_continue">Продолжить</button>
    </div>
  </div>
```

- [ ] **Step 3: Логика первого запуска в app.js**

В `src/renderer/js/app.js` заменить блок `document.querySelectorAll('.user-btn')...` (строки ~94–101) на:
```js
async function showUserSelect() {
  const input = document.getElementById('onboarding-name-input')
  const btn   = document.getElementById('onboarding-continue')
  input.value = (await window.api.getDefaultName()) || ''
  const sync = () => { btn.disabled = input.value.trim().length === 0 }
  sync()
  input.addEventListener('input', sync)
  const confirm = async () => {
    const name = input.value.trim()
    if (!name) return
    currentUser = name
    await window.api.setSetting('user_name', name)
    userSelectScreen.classList.add('hidden')
    await showMainScreen()
  }
  btn.addEventListener('click', confirm)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm() })
  userSelectScreen.classList.remove('hidden')
}
```

- [ ] **Step 4: Вызвать showUserSelect вместо прямого показа экрана**

В `src/renderer/js/app.js` в `init()` заменить ветку `else`:
```js
  const userName = await window.api.getSetting('user_name')
  if (userName) {
    currentUser = userName
    await showMainScreen()
  } else {
    await showUserSelect()
  }
```

- [ ] **Step 5: Проверка вручную**

Внимание: НЕ удаляй свою рабочую БД, если хочешь сохранить часы. Для чистой проверки первого запуска используй временный профиль или переименуй `%APPDATA%\time-tracker\` (вернёшь потом).

Run: `npm run dev` (с чистой БД)
Expected:
- Экран первого запуска: поле имени, префилл системным именем, кнопка «Продолжить»/«Continue».
- Пустое поле — кнопка неактивна.
- Ввод имени + Enter/кнопка → главный экран; имя сохранилось.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/index.html src/renderer/js/app.js src/renderer/js/i18n/dict.js
git commit -m "feat(onboarding): name input on first run with OS-name prefill"
```

---

### Task 4: Переименование в настройках + перенос данных

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/preload/index.js`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Produces:
  - IPC `db:rename-user` (аргумент `newName`) → переносит `sessions.user` (old→new), переносит ключ `avatar_<old>`→`avatar_<new>`, пишет `user_name = new`, сохраняет БД. Возвращает `true`. No-op если `newName` пустое или равно текущему.
  - preload `window.api.renameUser(newName): Promise<boolean>`.

- [ ] **Step 1: IPC-миграция переименования в main**

В `src/main/index.js` в `setupIPC()` добавить:
```js
  ipcMain.handle('db:rename-user', (_, newName) => {
    const name = String(newName || '').trim()
    if (!name) return false
    const stmt = db.prepare("SELECT value FROM settings WHERE key = 'user_name'")
    const old = stmt.step() ? stmt.getAsObject().value : null
    stmt.free()
    if (!old || old === name) {
      db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', ?)", [name])
      saveDB()
      return true
    }
    db.run('UPDATE sessions SET user = ? WHERE user = ?', [name, old])
    const av = db.prepare('SELECT value FROM settings WHERE key = ?')
    av.bind([`avatar_${old}`])
    const avatar = av.step() ? av.getAsObject().value : null
    av.free()
    if (avatar) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`avatar_${name}`, avatar])
      db.run('DELETE FROM settings WHERE key = ?', [`avatar_${old}`])
    }
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', ?)", [name])
    saveDB()
    return true
  })
```

- [ ] **Step 2: preload-метод**

В `src/preload/index.js` в `api` добавить:
```js
  renameUser: (newName) => ipcRenderer.invoke('db:rename-user', newName),
```

- [ ] **Step 3: Переверстать блок переименования в настройках**

В `src/renderer/index.html` заменить `#user-name-picker` (кнопки Саша/Максим, строки со `user-pick-btn`) на текстовое поле:
```html
          <div class="settings-row hidden" id="user-name-picker">
            <input type="text" id="user-name-input" class="settings-input" maxlength="32">
            <button class="settings-row-btn" id="user-name-save-btn" data-i18n="btn_save">Сохранить</button>
          </div>
```

- [ ] **Step 4: Отобразить имя как есть + логика переименования в app.js**

В `src/renderer/js/app.js` в `loadUserTab()` заменить строку отображения имени:
```js
  userNameDisplay.textContent = currentUser
```
Заменить блок `document.querySelectorAll('.user-pick-btn')...` (весь forEach) на:
```js
const userNameInput   = document.getElementById('user-name-input')
const userNameSaveBtn = document.getElementById('user-name-save-btn')

userNameSaveBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim()
  if (!name) return
  await window.api.renameUser(name)
  currentUser = name
  userNameDisplay.textContent = name
  userNamePicker.classList.add('hidden')
  userNameEditBtn.classList.remove('hidden')
  await refreshStats()
})
```
В обработчике `userNameEditBtn` (показывает picker) добавить префилл поля текущим именем:
```js
userNameEditBtn.addEventListener('click', () => {
  userNameInput.value = currentUser
  userNamePicker.classList.remove('hidden')
  userNameEditBtn.classList.add('hidden')
})
```

- [ ] **Step 5: Проверка вручную**

Run: `npm run dev`
Expected:
- Настройки → «Пользователь»: имя показано как есть.
- «Изменить» → поле с текущим именем → ввод нового → «Сохранить»: имя меняется в шапке/настройках.
- Часы за прошлые дни (шкалы, календарь) сохраняются после переименования (данные перенесены).

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js src/preload/index.js src/renderer/index.html src/renderer/js/app.js
git commit -m "feat(user): rename via text input with session/avatar data migration"
```

---

### Task 5: Снять name-хардкод в гейте лимита

**Files:**
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Consumes: `loadLimitTab`, `limitSaveBtn`.
- Produces: лимит редактируется в соло-режиме (без привязки к имени); admin-note скрыт. Роли добавит Этап 3.

- [ ] **Step 1: Сделать поля лимита редактируемыми**

В `src/renderer/js/app.js` заменить тело `loadLimitTab()` (блок с `isAdmin = currentUser === 'Maxim'`):
```js
async function loadLimitTab() {
  const period = await window.api.getPeriodSettings()
  limitInput.value = Math.round(period.monthly_limit_seconds / 3600)
  periodStartInput.value = period.period_start
  periodEndInput.value = period.period_end

  limitInput.disabled = false
  periodStartInput.disabled = false
  periodEndInput.disabled = false
  limitSaveBtn.classList.remove('hidden')
  limitAdminNote.classList.add('hidden')
}
```

- [ ] **Step 2: Убрать name-проверку в обработчике сохранения**

В `src/renderer/js/app.js` в обработчике `limitSaveBtn` удалить строку:
```js
  if (currentUser !== 'Maxim') return
```

- [ ] **Step 3: Проверка вручную**

Run: `npm run dev`
Expected:
- Настройки → «Лимит & Период»: поля активны у любого пользователя, кнопка «Сохранить» видна, admin-note не показывается.
- Изменение лимита/периода сохраняется и отражается на общей шкале.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/js/app.js
git commit -m "refactor(limit): drop name-based edit gate (solo = editable); roles in stage 3"
```

---

## Завершение этапа (после всех задач)

- [ ] Все тесты зелёные: `npm test`
- [ ] Ручная проверка первого запуска, переименования и лимита пройдена
- [ ] Обновить `PROGRESS.md` — блок «Этап 2 — Первый запуск + пресеты»
- [ ] Commit: `docs: PROGRESS — stage 2 (onboarding + presets) done`
- [ ] Push: `git push -u origin stage2-onboarding`
- [ ] Сообщить пользователю: этап готов, ветка запушена — можно открывать PR

---

## Self-Review (выполнено при написании)

- **Покрытие спеки:** поле имени с префиллом ОС ✓; имя как есть (маппинг удалён) ✓; соло по умолчанию ✓; универсальные пресеты по языку ✓; снятие гейта «только Максим» ✓ (роли — Этап 3, явно указано). Аватары уже по `user_name` — сид name-аватаров удалён ✓.
- **Плейсхолдеры:** конкретный код и команды во всех шагах; «найти X, заменить на Y» сопровождается готовым кодом.
- **Согласованность:** `pickPresetCategories`, `getDefaultName`, `renameUser` — имена совпадают между main/preload/renderer/тестами. Новые i18n-ключи (`onboarding_*`, `btn_continue`) добавлены в оба словаря → тест паритета и тест разметки их проверят.
- **Регрессия учтена:** переименование переносит `sessions.user`/аватар (иначе теряются часы); гейт лимита снят, чтобы имя-хардкод не заблокировал редактирование до Этапа 3.
- **Замечание:** admin-note (`#limit-admin-note`) и элемент picker остаются в DOM — Этап 3 переиспользует их под роли.
