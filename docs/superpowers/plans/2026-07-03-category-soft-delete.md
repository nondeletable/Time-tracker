# Category Soft-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать мягкое удаление категорий: категория помечается `deleted=1` и исчезает из всего активного UI, но её сессии остаются в БД (просто перестают учитываться).

**Architecture:** Колонка `deleted INTEGER NOT NULL DEFAULT 0` добавляется в таблицу `categories` через идемпотентную миграцию при каждом запуске. Все SQL-запросы, считающие сессии, фильтруются по `c.deleted = 0`. Renderer показывает два sub-tab в настройках: «Активные» (с кнопкой удаления) и «Удалённые» (с кнопкой восстановления).

**Tech Stack:** Electron, vanilla JS/CSS, sql.js (SQLite WASM)

## Global Constraints

- Нет тестового фреймворка — верификация ручная: `npm run dev`
- Иконка корзины: `assets/icons/del.svg`, fill изменить с `#000000` на `#9090b0`
- Стиль sub-tab активного: `border-color: #4ade80`, как у `.settings-tab.active`
- Кнопка «Удалить» в диалоге — `.dialog-btn.danger`: фон `#7f1d1d`, текст `#fca5a5`
- После любого delete/restore: перерисовать sidebar, диалог сохранения и шкалы

---

## File Map

| Файл | Изменение |
|---|---|
| `assets/icons/del.svg` | fill `#000000` → `#9090b0` |
| `src/main/index.js` | миграция, 3 новых хендлера, правка 4 существующих |
| `src/main/sync.js` | JOIN categories в `buildPayload`, фильтр `c.deleted = 0` |
| `src/preload/index.js` | 3 новых метода в contextBridge |
| `src/renderer/index.html` | sub-tabs, `#cat-deleted-list`, `#cat-delete-dialog` |
| `src/renderer/css/style.css` | `.cat-subtab`, `.cat-delete-btn`, `.cat-settings-item--deleted`, `.dialog-btn.danger` |
| `src/renderer/js/app.js` | renderActiveCategoriesList, loadDeletedCategoriesTab, диалог удаления, восстановление |

---

## Task 1: SVG icon + DB migration + backend

**Files:**
- Modify: `assets/icons/del.svg`
- Modify: `src/main/index.js`
- Modify: `src/main/sync.js`

**Interfaces:**
- Produces IPC-хендлеры:
  - `db:get-deleted-categories` → `Array<{id: number, name: string}>`
  - `db:soft-delete-category(id: number)` → `void`
  - `db:restore-category(id: number)` → `void`
- Produces изменённые хендлеры: `db:get-categories`, `db:get-monthly-stats`, `db:get-shared-total`, `db:get-sessions-by-date`

- [ ] **Step 1: Исправить fill в del.svg**

В `assets/icons/del.svg` найти строку:
```xml
fill="#000000" stroke="none">
```
Заменить на:
```xml
fill="#9090b0" stroke="none">
```

- [ ] **Step 2: Добавить миграцию в initDB**

В `src/main/index.js`, в конце функции `initDB`, перед строкой `saveDB()`:
```js
try {
  db.exec('ALTER TABLE categories ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0')
} catch (_) {}
```

- [ ] **Step 3: Исправить `db:get-categories` — фильтровать удалённые**

Найти:
```js
ipcMain.handle('db:get-categories', () => {
  const stmt = db.prepare('SELECT id, name, color, sort_order FROM categories ORDER BY sort_order')
```
Заменить строку с prepare на:
```js
  const stmt = db.prepare('SELECT id, name, color, sort_order FROM categories WHERE deleted = 0 ORDER BY sort_order')
```

- [ ] **Step 4: Исправить `db:get-monthly-stats` — не считать удалённые**

Найти в хендлере `db:get-monthly-stats`:
```js
    const stmt = db.prepare(`
      SELECT c.name, c.color, SUM(s.duration_seconds) as total
      FROM sessions s
      JOIN categories c ON s.category_id = c.id
      WHERE s.user = ?
        AND s.started_at >= ? AND s.started_at <= ?
      GROUP BY s.category_id
      HAVING total > 0
      ORDER BY total DESC
    `)
```
Заменить на:
```js
    const stmt = db.prepare(`
      SELECT c.name, c.color, SUM(s.duration_seconds) as total
      FROM sessions s
      JOIN categories c ON s.category_id = c.id
      WHERE s.user = ?
        AND s.started_at >= ? AND s.started_at <= ?
        AND c.deleted = 0
      GROUP BY s.category_id
      HAVING total > 0
      ORDER BY total DESC
    `)
```

- [ ] **Step 5: Исправить `db:get-shared-total` — не считать удалённые**

Найти:
```js
    const sessStmt = db.prepare(
      'SELECT SUM(duration_seconds) as total FROM sessions WHERE started_at >= ? AND started_at <= ?'
    )
    sessStmt.bind([from, to])
```
Заменить на:
```js
    const sessStmt = db.prepare(`
      SELECT SUM(s.duration_seconds) as total
      FROM sessions s
      JOIN categories c ON s.category_id = c.id
      WHERE s.started_at >= ? AND s.started_at <= ?
        AND c.deleted = 0
    `)
    sessStmt.bind([from, to])
```

- [ ] **Step 6: Исправить `db:get-sessions-by-date` — не показывать удалённые**

Найти в хендлере `db:get-sessions-by-date`:
```js
      WHERE s.user = ? AND s.started_at >= ? AND s.started_at <= ?
      ORDER BY s.started_at
```
Заменить на:
```js
      WHERE s.user = ? AND s.started_at >= ? AND s.started_at <= ?
        AND c.deleted = 0
      ORDER BY s.started_at
```

- [ ] **Step 7: Добавить три новых IPC-хендлера**

После строки `ipcMain.handle('sync:get-last-sync', () => getLastSyncAt())` добавить:
```js
  ipcMain.handle('db:get-deleted-categories', () => {
    const stmt = db.prepare('SELECT id, name FROM categories WHERE deleted = 1 ORDER BY name')
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  })

  ipcMain.handle('db:soft-delete-category', (_, id) => {
    db.run('UPDATE categories SET deleted = 1 WHERE id = ?', [id])
    saveDB()
  })

  ipcMain.handle('db:restore-category', (_, id) => {
    db.run('UPDATE categories SET deleted = 0 WHERE id = ?', [id])
    saveDB()
  })
```

- [ ] **Step 8: Исправить `buildPayload` в sync.js — не отправлять удалённые**

В `src/main/sync.js` найти:
```js
  const daysStmt = _db.prepare(`
    SELECT
      date(started_at / 1000, 'unixepoch', 'localtime') AS day,
      SUM(duration_seconds) AS total_seconds
    FROM sessions
    WHERE user = ?
    GROUP BY day
  `)
  daysStmt.bind([user])
```
Заменить на:
```js
  const daysStmt = _db.prepare(`
    SELECT
      date(s.started_at / 1000, 'unixepoch', 'localtime') AS day,
      SUM(s.duration_seconds) AS total_seconds
    FROM sessions s
    JOIN categories c ON s.category_id = c.id
    WHERE s.user = ? AND c.deleted = 0
    GROUP BY day
  `)
  daysStmt.bind([user])
```

- [ ] **Step 9: Проверить запуск**

```bash
npm run dev
```

Приложение должно запуститься без ошибок. Категории на главном экране и в настройках отображаются как раньше.

- [ ] **Step 10: Commit**

```bash
git add assets/icons/del.svg src/main/index.js src/main/sync.js
git commit -m "feat: soft-delete DB migration, filter deleted categories from all queries"
```

---

## Task 2: Preload — expose new API

**Files:**
- Modify: `src/preload/index.js`

**Interfaces:**
- Produces `window.api`:
  - `getDeletedCategories(): Promise<Array<{id: number, name: string}>>`
  - `softDeleteCategory(id: number): Promise<void>`
  - `restoreCategory(id: number): Promise<void>`

- [ ] **Step 1: Добавить три метода в contextBridge**

В `src/preload/index.js` после строки `onSyncDone: ...` добавить:
```js
  getDeletedCategories: ()     => ipcRenderer.invoke('db:get-deleted-categories'),
  softDeleteCategory:   (id)   => ipcRenderer.invoke('db:soft-delete-category', id),
  restoreCategory:      (id)   => ipcRenderer.invoke('db:restore-category', id),
```

- [ ] **Step 2: Проверить в DevTools**

```bash
npm run dev
```

В DevTools Console (Ctrl+Shift+I):
```js
await window.api.getDeletedCategories()
// ожидается: [] (пустой массив — ни одна категория ещё не удалена)
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.js
git commit -m "feat: expose soft-delete and restore category API in preload"
```

---

## Task 3: HTML + CSS

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/css/style.css`

**Interfaces:**
- Produces DOM-элементы:
  - `.cat-subtab[data-subtab="active"]` и `.cat-subtab[data-subtab="deleted"]`
  - `#cat-deleted-list` — `<ul>` для удалённых категорий
  - `#cat-deleted-empty` — `<p>` «Нет удалённых категорий»
  - `#cat-delete-dialog` — диалог подтверждения удаления
  - `#cat-delete-name` — имя категории в диалоге
  - `#cat-delete-cancel`, `#cat-delete-confirm` — кнопки диалога

- [ ] **Step 1: Добавить sub-tabs и списки в `#pane-categories`**

В `src/renderer/index.html` найти:
```html
        <div class="settings-pane hidden" id="pane-categories">
          <ul class="cat-settings-list" id="cat-settings-list"></ul>
          <button class="cat-add-btn" id="cat-add-btn">+ Добавить</button>
```
Заменить на:
```html
        <div class="settings-pane hidden" id="pane-categories">
          <div class="cat-subtabs">
            <button class="cat-subtab active" data-subtab="active">Активные</button>
            <button class="cat-subtab" data-subtab="deleted">Удалённые</button>
          </div>
          <ul class="cat-settings-list" id="cat-settings-list"></ul>
          <button class="cat-add-btn" id="cat-add-btn">+ Добавить</button>
          <ul class="cat-settings-list hidden" id="cat-deleted-list"></ul>
          <p class="cat-deleted-empty hidden" id="cat-deleted-empty">Нет удалённых категорий</p>
```

- [ ] **Step 2: Добавить диалог подтверждения удаления**

Перед строкой `<!-- About dialog -->` добавить:
```html
  <!-- Category delete confirmation dialog -->
  <div id="cat-delete-dialog" class="dialog-overlay hidden">
    <div class="dialog">
      <div class="dialog-title">Удалить категорию?</div>
      <div class="cat-delete-name-display" id="cat-delete-name"></div>
      <p class="cat-delete-hint">Часы по ней перестанут учитываться.</p>
      <div class="dialog-buttons">
        <button class="dialog-btn cancel" id="cat-delete-cancel">Отмена</button>
        <button class="dialog-btn danger" id="cat-delete-confirm">Удалить</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 3: Добавить CSS для sub-tabs**

В `src/renderer/css/style.css` перед секцией `/* ── Cat settings list */` (или перед `.cat-settings-list`) добавить:
```css
/* ── Category sub-tabs ─────────────────────────────────────────────────────── */

.cat-subtabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.cat-subtab {
  padding: 5px 14px;
  border-radius: 6px;
  border: 1px solid #2e2e4e;
  background: transparent;
  color: #6a6a8a;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.cat-subtab:hover {
  background: #161620;
  color: #b0b0d0;
}

.cat-subtab.active {
  background: #14141e;
  border-color: #4ade80;
  color: #d8d8f0;
}
```

- [ ] **Step 4: Добавить CSS для кнопки удаления**

```css
/* ── Category delete button ─────────────────────────────────────────────────── */

.cat-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.45;
  display: flex;
  align-items: center;
  transition: opacity 0.15s;
}

.cat-delete-btn:hover {
  opacity: 1;
}
```

- [ ] **Step 5: Добавить CSS для удалённых категорий и диалога**

```css
/* ── Deleted categories ─────────────────────────────────────────────────────── */

.cat-settings-item--deleted .cat-settings-name {
  color: #4a4a6a;
}

.cat-deleted-empty {
  font-size: 0.82rem;
  color: #4a4a6a;
  margin: 8px 0 0;
}

.cat-delete-name-display {
  font-size: 0.95rem;
  color: #c0c0d8;
  margin: 8px 0 6px;
  font-style: italic;
}

.cat-delete-hint {
  font-size: 0.82rem;
  color: #6a6a8a;
  margin: 0 0 16px;
}

/* ── Danger dialog button ───────────────────────────────────────────────────── */

.dialog-btn.danger {
  background: #7f1d1d;
  color: #fca5a5;
}

.dialog-btn.danger:hover {
  background: #991b1b;
}
```

- [ ] **Step 6: Проверить визуально**

```bash
npm run dev
```

Открыть Настройки → Категории. Должно быть видно:
- Два pill-переключателя «Активные» / «Удалённые» вверху
- «Активные» подсвечен зелёной рамкой по умолчанию
- Список категорий отображается как раньше (логика добавляется в Task 4)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.html src/renderer/css/style.css
git commit -m "feat: add category sub-tabs, delete dialog, and deleted list HTML/CSS"
```

---

## Task 4: app.js — renderer logic

**Files:**
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Consumes: `window.api.getDeletedCategories()`, `window.api.softDeleteCategory(id)`, `window.api.restoreCategory(id)`
- Consumes DOM: `#cat-deleted-list`, `#cat-deleted-empty`, `#cat-delete-dialog`, `#cat-delete-name`, `#cat-delete-cancel`, `#cat-delete-confirm`, `.cat-subtab`

- [ ] **Step 1: Добавить DOM-ссылки на новые элементы**

В `src/renderer/js/app.js` найти блок с `const catSettingsList = ...` (около строки 433) и после него добавить:
```js
const catDeletedList  = document.getElementById('cat-deleted-list')
const catDeletedEmpty = document.getElementById('cat-deleted-empty')
const catDeleteDialog = document.getElementById('cat-delete-dialog')
const catDeleteName   = document.getElementById('cat-delete-name')
const catDeleteCancel = document.getElementById('cat-delete-cancel')
const catDeleteConfirm = document.getElementById('cat-delete-confirm')
```

- [ ] **Step 2: Добавить переменную `pendingDeleteId` и вспомогательные функции**

После объявления `let catEditingId = null` добавить:
```js
let pendingDeleteId = null
```

После функции `buildColorPalette` добавить:
```js
function showActiveCatPanel() {
  catSettingsList.classList.remove('hidden')
  catAddBtn.classList.remove('hidden')
  catDeletedList.classList.add('hidden')
  catDeletedEmpty.classList.add('hidden')
}

function showDeletedCatPanel() {
  catSettingsList.classList.add('hidden')
  catAddBtn.classList.add('hidden')
  catEditForm.classList.add('hidden')
  catColorPalette.classList.add('hidden')
}

async function renderActiveCategoriesList() {
  const cats = await window.api.getCategories()
  catSettingsList.innerHTML = ''
  cats.forEach(cat => {
    const li = document.createElement('li')
    li.className = 'cat-settings-item'
    const dot = document.createElement('span')
    dot.className = 'cat-settings-dot'
    dot.style.background = cat.color
    const name = document.createElement('span')
    name.className = 'cat-settings-name'
    name.textContent = cat.name
    const editBtn = document.createElement('button')
    editBtn.className = 'settings-row-btn'
    editBtn.textContent = 'Изменить'
    editBtn.addEventListener('click', () => openCatForm(cat.id, cat.name, cat.color))
    const delBtn = document.createElement('button')
    delBtn.className = 'cat-delete-btn'
    delBtn.title = 'Удалить'
    delBtn.innerHTML = '<img src="../../assets/icons/del.svg" width="14" height="14" alt="">'
    delBtn.addEventListener('click', () => openDeleteDialog(cat.id, cat.name))
    li.append(dot, name, editBtn, delBtn)
    catSettingsList.appendChild(li)
  })
}

async function loadDeletedCategoriesTab() {
  showDeletedCatPanel()
  const cats = await window.api.getDeletedCategories()
  catDeletedList.innerHTML = ''
  if (cats.length === 0) {
    catDeletedList.classList.add('hidden')
    catDeletedEmpty.classList.remove('hidden')
    return
  }
  catDeletedList.classList.remove('hidden')
  catDeletedEmpty.classList.add('hidden')
  cats.forEach(cat => {
    const li = document.createElement('li')
    li.className = 'cat-settings-item cat-settings-item--deleted'
    const name = document.createElement('span')
    name.className = 'cat-settings-name'
    name.textContent = cat.name
    const restoreBtn = document.createElement('button')
    restoreBtn.className = 'settings-row-btn'
    restoreBtn.textContent = 'Восстановить'
    restoreBtn.addEventListener('click', () => restoreCategoryById(cat.id))
    li.append(name, restoreBtn)
    catDeletedList.appendChild(li)
  })
}

function openDeleteDialog(id, name) {
  pendingDeleteId = id
  catDeleteName.textContent = `«${name}»`
  catDeleteDialog.classList.remove('hidden')
}

async function restoreCategoryById(id) {
  await window.api.restoreCategory(id)
  await loadDeletedCategoriesTab()
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await refreshStats()
}
```

- [ ] **Step 3: Заменить `loadCategoriesTab` на новую версию**

Найти и заменить всю функцию `loadCategoriesTab`:
```js
async function loadCategoriesTab() {
  catEditForm.classList.add('hidden')
  catColorPalette.classList.add('hidden')
  document.querySelectorAll('.cat-subtab').forEach(t => t.classList.remove('active'))
  document.querySelector('[data-subtab="active"]').classList.add('active')
  await renderActiveCategoriesList()
  showActiveCatPanel()
}
```

- [ ] **Step 4: Добавить обработчики sub-tab кнопок**

После блока `catEditCancel.addEventListener(...)` добавить:
```js
document.querySelectorAll('.cat-subtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cat-subtab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    if (tab.dataset.subtab === 'active') {
      renderActiveCategoriesList().then(() => showActiveCatPanel())
    } else {
      loadDeletedCategoriesTab()
    }
  })
})
```

- [ ] **Step 5: Добавить обработчики диалога удаления**

После sub-tab обработчиков добавить:
```js
catDeleteCancel.addEventListener('click', () => {
  catDeleteDialog.classList.add('hidden')
  pendingDeleteId = null
})

catDeleteConfirm.addEventListener('click', async () => {
  if (pendingDeleteId === null) return
  await window.api.softDeleteCategory(pendingDeleteId)
  catDeleteDialog.classList.add('hidden')
  pendingDeleteId = null
  await loadCategoriesTab()
  categories = await window.api.getCategories()
  renderCategories()
  renderDialogCategories()
  await refreshStats()
})
```

- [ ] **Step 6: Добавить `sync` в tab-handler и `loadDeletedCategoriesTab` в tab switch**

В обработчике переключения вкладок настроек найти:
```js
    if (tab.dataset.tab === 'sync') loadSyncTab()
```
Убедиться что он там есть (должен быть из предыдущей сессии). Добавить после него:
```js
    if (tab.dataset.tab === 'categories') {
      // сброс sub-tab при каждом открытии вкладки — уже в loadCategoriesTab
    }
```
Никаких изменений не нужно — `loadCategoriesTab()` уже вызывается и сбрасывает sub-tab.

- [ ] **Step 7: Проверить полный сценарий**

```bash
npm run dev
```

Проверить:
1. Настройки → Категории → список «Активные» с кнопками `[Изменить][🗑]`
2. Клик `🗑` → диалог с именем категории и кнопками «Отмена» / «Удалить»
3. «Удалить» → категория исчезает из активного списка
4. На главном экране удалённая категория не отображается
5. Переключить на sub-tab «Удалённые» → удалённая категория там с кнопкой «Восстановить»
6. «Восстановить» → категория возвращается в «Активные», появляется на главном экране
7. В настройках → «Правка часов» → выбрать дату с сессиями удалённой категории → они не отображаются
8. Limit bar не учитывает часы удалённой категории (проверить визуально)

- [ ] **Step 8: Commit**

```bash
git add src/renderer/js/app.js
git commit -m "feat: category soft-delete — delete/restore UI and flow"
```
