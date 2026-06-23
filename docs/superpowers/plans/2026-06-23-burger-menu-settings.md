# Burger Menu & Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a burger-menu to the app header that opens a dropdown leading to a settings modal (4 tabs, 2 implemented) and an about dialog.

**Architecture:** All UI lives in the renderer (index.html + style.css + app.js). The main process already exposes generic `getSetting`/`setSetting` IPC — no new IPC handlers are needed. Settings are stored as key-value rows in the `settings` table.

**Tech Stack:** Electron, Vanilla JS, CSS, sql.js (SQLite via existing IPC)

## Global Constraints

- Paths to assets from `src/renderer/index.html`: `../../assets/icons/<file>`
- `currentUser` in app.js holds `'Sasha'` or `'Maxim'` (English, matches DB)
- Display names: Sasha → «Саша», Maxim → «Максим»
- `window.api.getSetting(key)` / `window.api.setSetting(key, value)` already exist
- `window.api.getPeriodSettings()` returns `{ period_start, period_end, monthly_limit_seconds }`
- Run command: `npm run dev` (runs `electron .`)

---

## File Map

| File | Changes |
|---|---|
| `src/main/index.js` | Add `Menu` import, remove native menu, seed `avatar` default |
| `src/renderer/index.html` | App header, dropdown, settings modal (all panes), about dialog |
| `src/renderer/css/style.css` | Header, dropdown, settings modal, rows, avatar grid, form inputs |
| `src/renderer/js/app.js` | Burger toggle, settings open/close/tabs, user/avatar/limit logic |

---

## Task 1: Remove native menu + header bar + dropdown

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/css/style.css`
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Produces: `openSettings()` and `openAbout()` stubs (replaced in Tasks 2–3)

- [ ] **Step 1: Add `Menu` to require and remove native menu in `main/index.js`**

Change line 1 from:
```js
const { app, BrowserWindow, ipcMain } = require('electron')
```
to:
```js
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
```

Inside `createWindow()`, add before `win.loadFile(...)`:
```js
Menu.setApplicationMenu(null)
```

- [ ] **Step 2: Add header + dropdown markup to `index.html`**

Inside `#main-screen > .main-wrapper`, before `.limit-bar-wrap`, add:
```html
<div class="app-header">
  <div class="header-left">
    <button class="burger-btn" id="burger-btn">
      <img src="../../assets/icons/menu.png" width="22" height="22" alt="">
    </button>
    <div class="burger-dropdown hidden" id="burger-dropdown">
      <button class="dropdown-item" id="menu-settings">Настройки</button>
      <button class="dropdown-item" id="menu-about">О программе</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add header + dropdown CSS to `style.css`**

```css
/* ── App header ────────────────────────────────────────────────────────────── */

.app-header {
  height: 40px;
  background: #0d0d11;
  border-bottom: 1px solid #1a1a24;
  display: flex;
  align-items: center;
  padding: 0 10px;
  flex-shrink: 0;
}

.header-left {
  position: relative;
}

.burger-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  opacity: 0.55;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}

.burger-btn:hover {
  opacity: 1;
  background: #1e1e2a;
}

/* ── Dropdown ──────────────────────────────────────────────────────────────── */

.burger-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: #191924;
  border: 1px solid #26263a;
  border-radius: 8px;
  overflow: hidden;
  z-index: 200;
  min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #c0c0d8;
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #22222e;
}
```

- [ ] **Step 4: Add burger toggle JS to `app.js`**

Add DOM refs after the existing declarations block:
```js
const burgerBtn      = document.getElementById('burger-btn')
const burgerDropdown = document.getElementById('burger-dropdown')
const menuSettings   = document.getElementById('menu-settings')
const menuAbout      = document.getElementById('menu-about')
```

Add event handlers and stub functions (replace with real implementations in Tasks 2–3):
```js
burgerBtn.addEventListener('click', e => {
  e.stopPropagation()
  burgerDropdown.classList.toggle('hidden')
})

document.addEventListener('click', () => {
  burgerDropdown.classList.add('hidden')
})

menuSettings.addEventListener('click', () => {
  burgerDropdown.classList.add('hidden')
  openSettings()
})

menuAbout.addEventListener('click', () => {
  burgerDropdown.classList.add('hidden')
  openAbout()
})

function openSettings() { /* Task 2 */ }
function openAbout()    { /* Task 2 */ }
```

- [ ] **Step 5: Run and verify**

```
npm run dev
```
Expected:
- No File/Edit/View native menu bar
- 40px dark header at top, burger icon visible on the left
- Click burger → dropdown with «Настройки» and «О программе» appears
- Click outside → dropdown closes

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js src/renderer/index.html src/renderer/css/style.css src/renderer/js/app.js
git commit -m "feat: add app header with burger menu dropdown"
```

---

## Task 2: Settings modal shell + «О программе»

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/css/style.css`
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Consumes: `openSettings()` and `openAbout()` stubs from Task 1
- Produces: `openSettings()` (real), `closeSettings()`, `openAbout()`, `closeAbout()`

- [ ] **Step 1: Add settings modal + about dialog markup to `index.html`**

Before `<script src="js/app.js"></script>`, add:
```html
<!-- Settings modal -->
<div id="settings-modal" class="modal-overlay hidden">
  <div class="settings-modal">
    <button class="modal-close" id="settings-close">×</button>
    <nav class="settings-nav">
      <button class="settings-tab active" data-tab="user">Пользователь</button>
      <button class="settings-tab" data-tab="limit">Лимит &amp; Период</button>
      <button class="settings-tab" data-tab="categories">Категории</button>
      <button class="settings-tab" data-tab="hours">Правка часов</button>
    </nav>
    <div class="settings-body">
      <div class="settings-pane" id="pane-user"></div>
      <div class="settings-pane hidden" id="pane-limit"></div>
      <div class="settings-pane hidden" id="pane-categories">
        <p class="settings-stub">Скоро</p>
      </div>
      <div class="settings-pane hidden" id="pane-hours">
        <p class="settings-stub">Скоро</p>
      </div>
    </div>
  </div>
</div>

<!-- About dialog -->
<div id="about-modal" class="dialog-overlay hidden">
  <div class="dialog">
    <div class="about-name">Time Tracker</div>
    <div class="about-version">Версия 1.0.0</div>
    <div class="about-copy">© 2026 Sasha &amp; Maxim</div>
    <button class="dialog-btn save" id="about-close">Закрыть</button>
  </div>
</div>
```

- [ ] **Step 2: Add settings modal + about CSS to `style.css`**

```css
/* ── Modal overlay (reusable) ──────────────────────────────────────────────── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

/* ── Settings modal ────────────────────────────────────────────────────────── */

.settings-modal {
  background: #191924;
  border: 1px solid #26263a;
  border-radius: 16px;
  width: 620px;
  height: 400px;
  display: flex;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}

.modal-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: transparent;
  border: none;
  color: #4a4a6a;
  font-size: 1.3rem;
  cursor: pointer;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 10;
  transition: color 0.15s;
}

.modal-close:hover {
  color: #f87171;
}

.settings-nav {
  width: 160px;
  background: #0d0d11;
  border-right: 1px solid #1a1a24;
  display: flex;
  flex-direction: column;
  padding-top: 16px;
  flex-shrink: 0;
}

.settings-tab {
  padding: 11px 18px;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  color: #8080a0;
  font-size: 0.84rem;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.settings-tab:hover {
  background: #161620;
}

.settings-tab.active {
  background: #14141e;
  border-left-color: #4ade80;
  color: #d8d8f0;
}

.settings-body {
  flex: 1;
  overflow: hidden;
}

.settings-pane {
  height: 100%;
  padding: 24px 28px;
  overflow-y: auto;
}

.settings-stub {
  color: #3a3a5a;
  font-size: 0.88rem;
}

/* ── About dialog ──────────────────────────────────────────────────────────── */

.about-name {
  font-size: 1.3rem;
  font-weight: 500;
  color: #e0e0f0;
}

.about-version {
  font-size: 0.85rem;
  color: #6a6a8a;
}

.about-copy {
  font-size: 0.82rem;
  color: #5a5a7a;
}
```

- [ ] **Step 3: Replace `openSettings()` and `openAbout()` stubs in `app.js`**

Add DOM refs after existing declarations:
```js
const settingsModal = document.getElementById('settings-modal')
const settingsClose = document.getElementById('settings-close')
const settingsTabs  = document.querySelectorAll('.settings-tab')
const settingsPanes = document.querySelectorAll('.settings-pane')
const aboutModal    = document.getElementById('about-modal')
const aboutClose    = document.getElementById('about-close')
```

Replace the two stub functions:
```js
function openSettings() {
  // reset to user tab
  settingsTabs.forEach(t => t.classList.remove('active'))
  settingsPanes.forEach(p => p.classList.add('hidden'))
  document.querySelector('[data-tab="user"]').classList.add('active')
  document.getElementById('pane-user').classList.remove('hidden')

  settingsModal.classList.remove('hidden')
  loadUserTab()
}

function closeSettings() {
  settingsModal.classList.add('hidden')
}

settingsClose.addEventListener('click', closeSettings)

settingsTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    settingsTabs.forEach(t => t.classList.remove('active'))
    settingsPanes.forEach(p => p.classList.add('hidden'))
    tab.classList.add('active')
    document.getElementById(`pane-${tab.dataset.tab}`).classList.remove('hidden')
    if (tab.dataset.tab === 'limit') loadLimitTab()
  })
})

function openAbout() {
  aboutModal.classList.remove('hidden')
}

aboutClose.addEventListener('click', () => {
  aboutModal.classList.add('hidden')
})

function loadUserTab()  { /* Task 3 */ }
function loadLimitTab() { /* Task 4 */ }
```

- [ ] **Step 4: Run and verify**

```
npm run dev
```
Expected:
- «Настройки» → 620×400px modal opens, left nav with 4 tabs, × closes
- Click «Категории» or «Правка часов» → shows «Скоро»
- «О программе» → dialog with «Time Tracker», «Версия 1.0.0», «© 2026 Sasha & Maxim», «Закрыть»

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.html src/renderer/css/style.css src/renderer/js/app.js
git commit -m "feat: settings modal shell and about dialog"
```

---

## Task 3: Пользователь tab — name + avatar

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/css/style.css`
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Consumes: `loadUserTab()` stub from Task 2
- Produces: `loadUserTab()` (real); updates `currentUser` and calls `refreshStats()` on name change

- [ ] **Step 1: Seed `avatar` default in `main/index.js`**

Inside `initDB()`, after the existing `seedSetting('monthly_limit_seconds', ...)` call:
```js
seedSetting('avatar', 'user.png')
```

- [ ] **Step 2: Add Пользователь pane markup to `index.html`**

Replace `<div class="settings-pane" id="pane-user"></div>` with:
```html
<div class="settings-pane" id="pane-user">
  <div class="settings-row" id="user-name-row">
    <span class="settings-row-label">Имя</span>
    <span class="settings-row-value" id="user-name-display"></span>
    <button class="settings-row-btn" id="user-name-edit-btn">Изменить</button>
  </div>
  <div class="settings-row hidden" id="user-name-picker">
    <span class="settings-row-label"></span>
    <button class="user-pick-btn" data-user="Sasha">Саша</button>
    <button class="user-pick-btn" data-user="Maxim">Максим</button>
  </div>
  <div class="settings-row">
    <span class="settings-row-label">Аватар</span>
    <img class="avatar-preview" id="avatar-preview" src="" width="40" height="40" alt="">
    <button class="settings-row-btn" id="avatar-edit-btn">Изменить</button>
  </div>
  <div class="avatar-grid hidden" id="avatar-grid"></div>
</div>
```

- [ ] **Step 3: Add settings row + avatar CSS to `style.css`**

```css
/* ── Settings rows ─────────────────────────────────────────────────────────── */

.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.settings-row-label {
  font-size: 0.82rem;
  color: #6a6a8a;
  width: 80px;
  flex-shrink: 0;
}

.settings-row-value {
  flex: 1;
  font-size: 0.88rem;
  color: #c0c0d8;
}

.settings-row-btn {
  padding: 5px 14px;
  background: #22222e;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  color: #9090b0;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.settings-row-btn:hover {
  background: #2a2a3e;
  color: #c0c0d8;
}

.user-pick-btn {
  padding: 6px 20px;
  background: #22222e;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  color: #c0c0d8;
  font-size: 0.88rem;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.user-pick-btn:hover {
  border-color: #4ade80;
  background: #1a2a1e;
}

.avatar-preview {
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

/* ── Avatar grid ───────────────────────────────────────────────────────────── */

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(3, 56px);
  gap: 10px;
  margin-bottom: 20px;
}

.avatar-option {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  object-fit: cover;
  transition: border-color 0.15s, transform 0.15s;
}

.avatar-option:hover {
  border-color: #4a4a6a;
  transform: scale(1.05);
}

.avatar-option.selected {
  border-color: #4ade80;
}
```

- [ ] **Step 4: Add DOM refs + `loadUserTab()` to `app.js`**

Add DOM refs after existing declarations:
```js
const userNameDisplay = document.getElementById('user-name-display')
const userNameEditBtn = document.getElementById('user-name-edit-btn')
const userNamePicker  = document.getElementById('user-name-picker')
const avatarPreview   = document.getElementById('avatar-preview')
const avatarEditBtn   = document.getElementById('avatar-edit-btn')
const avatarGrid      = document.getElementById('avatar-grid')
```

Replace the `loadUserTab()` stub:
```js
const AVATAR_FILES = [
  'user.png', 'man.png', 'man_1.png', 'man_2.png', 'man_3.png',
  'woman.png', 'woman_1.png', 'woman_2.png', 'woman_3.png'
]

async function loadUserTab() {
  userNameDisplay.textContent = currentUser === 'Sasha' ? 'Саша' : 'Максим'
  userNamePicker.classList.add('hidden')
  userNameEditBtn.classList.remove('hidden')

  const avatar = (await window.api.getSetting('avatar')) ?? 'user.png'
  avatarPreview.src = `../../assets/icons/${avatar}`
  avatarGrid.classList.add('hidden')
  avatarEditBtn.classList.remove('hidden')
  buildAvatarGrid(avatar)
}

function buildAvatarGrid(currentAvatar) {
  avatarGrid.innerHTML = ''
  AVATAR_FILES.forEach(file => {
    const img = document.createElement('img')
    img.src = `../../assets/icons/${file}`
    img.className = 'avatar-option' + (file === currentAvatar ? ' selected' : '')
    img.dataset.file = file
    img.addEventListener('click', async () => {
      await window.api.setSetting('avatar', file)
      avatarPreview.src = `../../assets/icons/${file}`
      avatarGrid.querySelectorAll('.avatar-option').forEach(i =>
        i.classList.toggle('selected', i.dataset.file === file))
      avatarGrid.classList.add('hidden')
      avatarEditBtn.classList.remove('hidden')
    })
    avatarGrid.appendChild(img)
  })
}

userNameEditBtn.addEventListener('click', () => {
  userNamePicker.classList.remove('hidden')
  userNameEditBtn.classList.add('hidden')
})

document.querySelectorAll('.user-pick-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const newUser = btn.dataset.user
    await window.api.setSetting('user_name', newUser)
    currentUser = newUser
    userNameDisplay.textContent = newUser === 'Sasha' ? 'Саша' : 'Максим'
    userNamePicker.classList.add('hidden')
    userNameEditBtn.classList.remove('hidden')
    await refreshStats()
  })
})

avatarEditBtn.addEventListener('click', () => {
  avatarGrid.classList.remove('hidden')
  avatarEditBtn.classList.add('hidden')
})
```

- [ ] **Step 5: Run and verify**

```
npm run dev
```
Expected:
- Settings → Пользователь tab: shows current username («Саша» or «Максим»)
- Click «Изменить» (имя) → Саша / Максим buttons appear; click → name updates instantly, stats refresh
- Click «Изменить» (аватар) → 3×3 grid appears, current avatar highlighted; click another → preview updates, grid hides

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js src/renderer/index.html src/renderer/css/style.css src/renderer/js/app.js
git commit -m "feat: settings user tab — name switch and avatar picker"
```

---

## Task 4: Лимит & Период tab

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/css/style.css`
- Modify: `src/renderer/js/app.js`

**Interfaces:**
- Consumes: `loadLimitTab()` stub from Task 2; `window.api.getPeriodSettings()`; `currentUser`
- Produces: `loadLimitTab()` (real); calls `refreshStats()` after save

- [ ] **Step 1: Add Лимит & Период pane markup to `index.html`**

Replace `<div class="settings-pane hidden" id="pane-limit"></div>` with:
```html
<div class="settings-pane hidden" id="pane-limit">
  <p class="settings-admin-note hidden" id="limit-admin-note">
    Изменить настройки может только Максим
  </p>
  <div class="settings-row">
    <span class="settings-row-label">Лимит (ч)</span>
    <input type="number" class="settings-input" id="limit-input" min="1" max="9999" step="1">
  </div>
  <div class="settings-row">
    <span class="settings-row-label">Период с</span>
    <input type="date" class="settings-input" id="period-start-input">
  </div>
  <div class="settings-row">
    <span class="settings-row-label">Период по</span>
    <input type="date" class="settings-input" id="period-end-input">
  </div>
  <button class="settings-save-btn hidden" id="limit-save-btn">Сохранить</button>
</div>
```

- [ ] **Step 2: Add limit tab CSS to `style.css`**

```css
/* ── Settings form fields ──────────────────────────────────────────────────── */

.settings-admin-note {
  font-size: 0.8rem;
  color: #6a6a8a;
  margin-bottom: 20px;
  padding: 8px 12px;
  background: #111118;
  border-radius: 6px;
  border-left: 2px solid #3a3a5a;
}

.settings-input {
  flex: 1;
  background: #11111a;
  border: 1px solid #26263a;
  border-radius: 6px;
  color: #c0c0d8;
  padding: 7px 10px;
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.settings-input:focus {
  border-color: #4a4a6a;
}

.settings-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.settings-save-btn {
  margin-top: 8px;
  padding: 9px 28px;
  background: #4ade80;
  color: #0f0f13;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s;
}

.settings-save-btn:hover {
  background: #22c55e;
}
```

- [ ] **Step 3: Add DOM refs + `loadLimitTab()` to `app.js`**

Add DOM refs after existing declarations:
```js
const limitInput       = document.getElementById('limit-input')
const periodStartInput = document.getElementById('period-start-input')
const periodEndInput   = document.getElementById('period-end-input')
const limitSaveBtn     = document.getElementById('limit-save-btn')
const limitAdminNote   = document.getElementById('limit-admin-note')
```

Replace the `loadLimitTab()` stub:
```js
async function loadLimitTab() {
  const period = await window.api.getPeriodSettings()
  limitInput.value = Math.round(period.monthly_limit_seconds / 3600)
  periodStartInput.value = period.period_start
  periodEndInput.value = period.period_end

  const isAdmin = currentUser === 'Maxim'
  limitInput.disabled = !isAdmin
  periodStartInput.disabled = !isAdmin
  periodEndInput.disabled = !isAdmin
  limitSaveBtn.classList.toggle('hidden', !isAdmin)
  limitAdminNote.classList.toggle('hidden', isAdmin)
}

limitSaveBtn.addEventListener('click', async () => {
  const hours = parseInt(limitInput.value, 10)
  if (!hours || hours < 1) return
  await window.api.setSetting('monthly_limit_seconds', String(hours * 3600))
  await window.api.setSetting('period_start', periodStartInput.value)
  await window.api.setSetting('period_end', periodEndInput.value)
  await refreshStats()
})
```

- [ ] **Step 4: Run and verify**

```
npm run dev
```
Expected as Саша:
- Лимит & Период tab: all fields disabled, note «Изменить настройки может только Максим» visible, «Сохранить» hidden

Expected after switching to Максим (via Пользователь tab):
- Fields enabled, «Сохранить» visible, note hidden
- Change limit to 140 → save → limit bar in main screen updates immediately

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.html src/renderer/css/style.css src/renderer/js/app.js
git commit -m "feat: settings limit & period tab with admin guard"
```

---

## Task 5: Finalize + PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Verify stub tabs**

```
npm run dev
```
Expected: Settings → «Категории» and «Правка часов» each show «Скоро» in muted text.

- [ ] **Step 2: Update PROGRESS.md**

Add a new block documenting the burger menu & settings feature as completed. Update «Следующий шаг».

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs: update progress after burger menu & settings"
```
