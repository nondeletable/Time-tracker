# Кастомный titlebar + ресайз окна — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить нативный заголовок Electron на кастомный титлбар в стиле приложения (одна строка: бургер | иконка+название | sync+кнопки окна) и включить ресайз окна с сохранением размера/позиции между запусками.

**Architecture:** Чистая валидация сохранённых bounds — в `src/main/window-bounds.js` (UMD, node:test). Окно (`frame:false`, `resizable`, min-размеры, save/restore bounds, IPC кнопок окна) — в `src/main/index.js`. Титлбар — реструктуризация `.app-header` в три зоны + drag-регионы + блок кнопок окна (SVG-иконки). Смена иконки max↔restore — по событиям из main.

**Tech Stack:** Electron main (Node, `screen`), sql.js (settings), vanilla JS/CSS renderer, `-webkit-app-region` для drag.

## Global Constraints

- Нативные углы Win11: `frame:false` + `resizable:true`, БЕЗ `transparent`.
- min-размеры окна: `minWidth: 560`, `minHeight: 500` (проверить на реальном layout, подстроить при необходимости).
- Дефолтный размер: 700×600.
- Тема хардкодом: база `#0f0f13`, панели `#0d0d11`, акцент `#4ade80`, иконки-штрихи `#9090b0`, красный `#f87171`. CSS-переменных нет — цвета дословно.
- Иконки кнопок окна — SVG с зашитым `#9090b0` (перерисованы из PNG в `assets/`).
- Чистая логика → `node:test` (`npm test`); титлбар/ресайз → ручная проверка `npm run dev`.
- Команда тестов (PowerShell): `npm test`.

---

### Task 1: Чистая валидация bounds `window-bounds.js`

**Files:**
- Create: `src/main/window-bounds.js`
- Test: `test/window-bounds.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `clampBoundsToScreen(bounds, displays) → bounds | null`. Возвращает `bounds` без изменений, если верхний центр окна `(x + width/2, y)` попадает в `workArea` какого-либо дисплея; иначе `null` (вызов должен откатиться к дефолту). Невалидный `bounds` → `null`.

- [ ] **Step 1: Написать падающий тест** — `test/window-bounds.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')

const { clampBoundsToScreen } = require('../src/main/window-bounds')

const oneScreen = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }]

test('bounds внутри экрана — возвращается как есть', () => {
  const b = { x: 100, y: 50, width: 700, height: 600 }
  assert.deepEqual(clampBoundsToScreen(b, oneScreen), b)
})

test('окно уехало вправо за экран — null', () => {
  assert.equal(clampBoundsToScreen({ x: 5000, y: 50, width: 700, height: 600 }, oneScreen), null)
})

test('заголовок выше экрана (y<0) — null', () => {
  assert.equal(clampBoundsToScreen({ x: 100, y: -200, width: 700, height: 600 }, oneScreen), null)
})

test('второй монитор — верхний центр на нём — возвращается', () => {
  const two = [
    { workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { workArea: { x: 1920, y: 0, width: 1920, height: 1040 } },
  ]
  const b = { x: 2000, y: 100, width: 700, height: 600 }
  assert.deepEqual(clampBoundsToScreen(b, two), b)
})

test('невалидный bounds / пустые дисплеи — null', () => {
  assert.equal(clampBoundsToScreen(null, oneScreen), null)
  assert.equal(clampBoundsToScreen({ x: 0, y: 0 }, oneScreen), null)
  assert.equal(clampBoundsToScreen({ x: 100, y: 50, width: 700, height: 600 }, []), null)
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/main/window-bounds'`.

- [ ] **Step 3: Реализовать `src/main/window-bounds.js`:**

```js
// Чистая валидация сохранённых bounds окна — без Electron. UMD: node + браузер.
(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.WINDOW_BOUNDS = api
})(typeof self !== 'undefined' ? self : this, function () {
  // Возвращает bounds, если верхний центр окна (x + width/2, y) попадает в
  // рабочую область какого-либо дисплея (титлбар доступен для перетаскивания);
  // иначе null — вызывающий откатывается к дефолту.
  function clampBoundsToScreen(bounds, displays) {
    if (!bounds ||
        typeof bounds.x !== 'number' || typeof bounds.y !== 'number' ||
        typeof bounds.width !== 'number' || typeof bounds.height !== 'number') {
      return null
    }
    const px = bounds.x + bounds.width / 2
    const py = bounds.y
    const ok = (displays || []).some(d => {
      const wa = d && d.workArea
      if (!wa) return false
      return px >= wa.x && px < wa.x + wa.width && py >= wa.y && py < wa.y + wa.height
    })
    return ok ? bounds : null
  }

  return { clampBoundsToScreen }
})
```

- [ ] **Step 4: Прогнать — убедиться, что проходит**

Run: `npm test`
Expected: PASS (все `window-bounds.test.js` зелёные, прежние тесты не тронуты).

- [ ] **Step 5: Commit**

```bash
git add src/main/window-bounds.js test/window-bounds.test.js
git commit -m "feat(window): pure clampBoundsToScreen + tests"
```

---

### Task 2: SVG-иконки кнопок окна

**Files:**
- Create: `assets/icons/win-min.svg`
- Create: `assets/icons/win-max.svg`
- Create: `assets/icons/win-restore.svg`
- Create: `assets/icons/win-close.svg`

**Interfaces:**
- Produces: 4 SVG-файла (12×12), цвет `#9090b0`. `win-max` — «уголки наружу» (как `full-screen.png`), `win-restore` — две квадратные рамки (классический restore), `win-min` — скруглённый минус, `win-close` — крест.

- [ ] **Step 1: `assets/icons/win-min.svg`:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
  <line x1="1.5" y1="6" x2="10.5" y2="6" stroke="#9090b0" stroke-width="1.6" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: `assets/icons/win-max.svg`** (уголки наружу):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"
     fill="none" stroke="#9090b0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 4.3 V2 H4.3"/>
  <path d="M7.7 2 H10 V4.3"/>
  <path d="M10 7.7 V10 H7.7"/>
  <path d="M4.3 10 H2 V7.7"/>
</svg>
```

- [ ] **Step 3: `assets/icons/win-restore.svg`** (две рамки):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"
     fill="none" stroke="#9090b0" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="4" width="6" height="6" rx="1"/>
  <path d="M4 4 V2.6 A0.6 0.6 0 0 1 4.6 2 H9.4 A0.6 0.6 0 0 1 10 2.6 V7.4 A0.6 0.6 0 0 1 9.4 8 H8"/>
</svg>
```

- [ ] **Step 4: `assets/icons/win-close.svg`:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
  <line x1="2.2" y1="2.2" x2="9.8" y2="9.8" stroke="#9090b0" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="9.8" y1="2.2" x2="2.2" y2="9.8" stroke="#9090b0" stroke-width="1.6" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 5: Commit**

```bash
git add assets/icons/win-min.svg assets/icons/win-max.svg assets/icons/win-restore.svg assets/icons/win-close.svg
git commit -m "assets: window control icons (min/max/restore/close) as themed SVG"
```

---

### Task 3: Окно — frame:false, ресайз, save/restore bounds, IPC (`index.js` + preload)

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/preload/index.js`

**Interfaces:**
- Consumes: `clampBoundsToScreen` (Task 1); `screen` из electron.
- Produces: окно без нативной рамки, ресайзабельное, с восстановлением bounds; IPC `win:minimize`, `win:maximize-toggle`, `win:close`; события `win:maximized`/`win:unmaximized`; preload-методы `winMinimize`, `winMaximizeToggle`, `winClose`, `onWinMaximized`, `onWinUnmaximized`.

- [ ] **Step 1: Импорты.** В `src/main/index.js` строка 1 — добавить `screen`, и импорт модуля bounds:

Найти:
```js
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
```
Заменить на:
```js
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron')
```
Затем сразу после строки `const { generateCode, normalizeCode } = require('./group')` добавить:
```js
const { clampBoundsToScreen } = require('./window-bounds')
```

- [ ] **Step 2: Переписать `createWindow`.** Заменить функцию целиком:

Найти:
```js
  const win = new BrowserWindow({
    width: 700,
    height: 600,
    resizable: false,
    icon: path.join(__dirname, '../../assets/icons/time-management.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
  return win
}
```
Заменить на:
```js
  const opts = {
    width: 700,
    height: 600,
    minWidth: 560,
    minHeight: 500,
    frame: false,
    resizable: true,
    icon: path.join(__dirname, '../../assets/icons/time-management.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  }

  let restoreMaximized = false
  const saved = readBoundsSetting()
  if (saved) {
    const clamped = clampBoundsToScreen(saved, screen.getAllDisplays())
    if (clamped) {
      opts.width = clamped.width
      opts.height = clamped.height
      opts.x = clamped.x
      opts.y = clamped.y
      restoreMaximized = !!saved.maximized
    }
  }

  const win = new BrowserWindow(opts)
  if (restoreMaximized) win.maximize()

  win.on('maximize',   () => { if (!win.isDestroyed()) win.webContents.send('win:maximized') })
  win.on('unmaximize', () => { if (!win.isDestroyed()) win.webContents.send('win:unmaximized') })

  win.on('close', () => {
    try {
      const b = win.getNormalBounds()
      const rec = { width: b.width, height: b.height, x: b.x, y: b.y, maximized: win.isMaximized() }
      db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('window_bounds', ?)", [JSON.stringify(rec)])
      saveDB()
    } catch (_) {}
  })

  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
  return win
}

function readBoundsSetting() {
  const stmt = db.prepare("SELECT value FROM settings WHERE key = 'window_bounds'")
  const val = stmt.step() ? stmt.getAsObject().value : null
  stmt.free()
  if (!val) return null
  try { return JSON.parse(val) } catch (_) { return null }
}
```

- [ ] **Step 3: IPC кнопок окна.** В теле `setupIPC()` (рядом с `group:*`-хендлерами) добавить:

```js
  ipcMain.handle('win:minimize', () => { if (mainWin) mainWin.minimize() })
  ipcMain.handle('win:maximize-toggle', () => {
    if (!mainWin) return
    if (mainWin.isMaximized()) mainWin.unmaximize()
    else mainWin.maximize()
  })
  ipcMain.handle('win:close', () => { if (mainWin) mainWin.close() })
```

- [ ] **Step 4: preload — методы окна.** В `src/preload/index.js`, внутри `api`, после `onSyncLimitUpdated` добавить:

```js
  winMinimize:       ()   => ipcRenderer.invoke('win:minimize'),
  winMaximizeToggle: ()   => ipcRenderer.invoke('win:maximize-toggle'),
  winClose:          ()   => ipcRenderer.invoke('win:close'),
  onWinMaximized:    (cb) => ipcRenderer.on('win:maximized', cb),
  onWinUnmaximized:  (cb) => ipcRenderer.on('win:unmaximized', cb),
```

- [ ] **Step 5: Проверка синтаксиса + регрессии**

Run: `npm test`
Expected: PASS (все прежние + Task 1 зелёные).

Run: `node --check src/main/index.js && node --check src/preload/index.js`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js src/preload/index.js
git commit -m "feat(window): frameless resizable window, bounds persistence, win-control IPC"
```

---

### Task 4: Титлбар — разметка, CSS, свап иконки (`index.html`, `style.css`, `app.js`)

**Files:**
- Modify: `src/renderer/index.html` (блок `.app-header`, строки ~25-39)
- Modify: `src/renderer/css/style.css` (`.app-header` + новые классы)
- Modify: `src/renderer/js/app.js` (обработчики кнопок окна + свап иконки)

**Interfaces:**
- Consumes: SVG-иконки (Task 2); `window.api.winMinimize/winMaximizeToggle/winClose/onWinMaximized/onWinUnmaximized` (Task 3).
- Produces: рабочий кастомный титлбар (drag + 3 кнопки окна + свап max/restore).

- [ ] **Step 1: Разметка `.app-header`.** В `src/renderer/index.html` заменить блок:

Найти:
```html
      <div class="app-header">
        <div class="header-left">
          <button class="burger-btn" id="burger-btn">
            <img src="../../assets/icons/menu.svg" width="22" height="22" alt="">
          </button>
          <div class="burger-dropdown hidden" id="burger-dropdown">
            <button class="dropdown-item" id="menu-settings" data-i18n="menu_settings">Настройки</button>
            <button class="dropdown-item" id="menu-about" data-i18n="menu_about">О программе</button>
          </div>
        </div>
        <div class="sync-controls">
          <div class="sync-dot" id="sync-dot" data-i18n-title="sync_title" title="Синхронизация"></div>
          <button class="sync-text-btn" id="sync-btn" data-i18n="sync_btn">Sync</button>
        </div>
      </div>
```
Заменить на:
```html
      <div class="app-header">
        <div class="header-left">
          <button class="burger-btn" id="burger-btn">
            <img src="../../assets/icons/menu.svg" width="22" height="22" alt="">
          </button>
          <div class="burger-dropdown hidden" id="burger-dropdown">
            <button class="dropdown-item" id="menu-settings" data-i18n="menu_settings">Настройки</button>
            <button class="dropdown-item" id="menu-about" data-i18n="menu_about">О программе</button>
          </div>
        </div>
        <div class="titlebar-center">
          <img src="../../assets/icons/time-management.png" width="16" height="16" alt="">
          <span class="titlebar-title">Time Tracker</span>
        </div>
        <div class="sync-controls">
          <div class="sync-dot" id="sync-dot" data-i18n-title="sync_title" title="Синхронизация"></div>
          <button class="sync-text-btn" id="sync-btn" data-i18n="sync_btn">Sync</button>
          <div class="window-controls">
            <button class="win-btn" id="win-min-btn" data-i18n-title="win_minimize" title="Свернуть">
              <img src="../../assets/icons/win-min.svg" width="12" height="12" alt="">
            </button>
            <button class="win-btn" id="win-max-btn" data-i18n-title="win_maximize" title="Развернуть">
              <img id="win-max-icon" src="../../assets/icons/win-max.svg" width="12" height="12" alt="">
            </button>
            <button class="win-btn win-close" id="win-close-btn" data-i18n-title="win_close" title="Закрыть">
              <img src="../../assets/icons/win-close.svg" width="12" height="12" alt="">
            </button>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: CSS.** В `src/renderer/css/style.css` заменить правило `.app-header`:

Найти:
```css
.app-header {
  height: 40px;
  background: #0d0d11;
  border-bottom: 1px solid #1a1a24;
  display: flex;
  align-items: center;
  padding: 0 10px;
  flex-shrink: 0;
}
```
Заменить на:
```css
.app-header {
  position: relative;
  height: 40px;
  background: #0d0d11;
  border-bottom: 1px solid #1a1a24;
  display: flex;
  align-items: center;
  padding: 0 4px 0 10px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.header-left,
.burger-btn,
.burger-dropdown,
.sync-controls,
.sync-text-btn,
.win-btn {
  -webkit-app-region: no-drag;
}

.titlebar-center {
  position: absolute;
  left: 50%;
  top: 0;
  height: 100%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.titlebar-title {
  font-size: 13px;
  color: #b0b0d0;
  letter-spacing: 0.02em;
}

.window-controls {
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.win-btn {
  width: 34px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.win-btn:hover {
  background: #1a1a24;
}

.win-close:hover {
  background: #f87171;
}

.win-close:hover img {
  filter: brightness(0) invert(1);
}
```

- [ ] **Step 3: i18n-ключи тултипов.** В `src/renderer/js/i18n/dict.js` добавить в `ru` (после `sync_title`):

```js
    win_minimize: 'Свернуть',
    win_maximize: 'Развернуть',
    win_close: 'Закрыть',
```
и в `en` (после `sync_title`):
```js
    win_minimize: 'Minimize',
    win_maximize: 'Maximize',
    win_close: 'Close',
```

- [ ] **Step 4: Обработчики + свап иконки.** В `src/renderer/js/app.js`, в секции `// ── Sync` (после блока обработчиков группы), добавить:

```js
// ── Titlebar window controls ────────────────────────────────────────────────
document.getElementById('win-min-btn').addEventListener('click', () => window.api.winMinimize())
document.getElementById('win-max-btn').addEventListener('click', () => window.api.winMaximizeToggle())
document.getElementById('win-close-btn').addEventListener('click', () => window.api.winClose())

const winMaxIcon = document.getElementById('win-max-icon')
window.api.onWinMaximized(()   => { winMaxIcon.src = '../../assets/icons/win-restore.svg' })
window.api.onWinUnmaximized(() => { winMaxIcon.src = '../../assets/icons/win-max.svg' })
```

- [ ] **Step 5: Проверка разметки i18n + регрессии**

Run: `npm test`
Expected: PASS — тесты паритета словарей и «data-i18n(-title) ключи из index.html есть в обоих словарях» зелёные (ключи добавлены в Step 3).

Run: `node --check src/renderer/js/app.js`
Expected: без ошибок.

- [ ] **Step 6: Ручная проверка `npm run dev`:**

```bash
npm run dev
```
Проверить:
1. Нативной рамки нет; углы окна скруглены (Win11), тень есть.
2. Титлбар: слева бургер (открывает меню), по центру иконка + «Time Tracker», справа sync-dot + Sync + три кнопки окна.
3. Перетаскивание окна за пустую часть титлбара работает; за кнопки — не таскает.
4. Свернуть — сворачивает; Развернуть — разворачивает (иконка меняется на restore), повторно — восстанавливает; двойной клик по титлбару — то же; Закрыть — закрывает.
5. Ховер: закрыть — красный фон с белым крестом; свернуть/развернуть — тёмная подсветка.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.html src/renderer/css/style.css src/renderer/js/app.js src/renderer/js/i18n/dict.js
git commit -m "feat(titlebar): custom draggable titlebar with window controls"
```

---

### Task 5: Ресайз контента — поведение на min и больших размерах

**Files:**
- Modify: `src/renderer/css/style.css` (`.timer-section`)

**Interfaces:**
- Consumes: ресайзабельное окно (Task 3).
- Produces: контент не клипается на минимальной высоте, тянется по ширине.

- [ ] **Step 1: Разрешить сжатие/скролл таймер-зоны.** В `src/renderer/css/style.css` заменить правило `.timer-section`:

Найти:
```css
.timer-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px 0;
}
```
Заменить на:
```css
.timer-section {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px 0;
}
```

- [ ] **Step 2: Ручная проверка `npm run dev`** — ресайз:

```bash
npm run dev
```
Проверить:
1. Ужать окно до минимального (560×500): сайдбар и таймер-зона не наезжают, круг таймера виден (при нехватке высоты таймер-зона скроллится, а не клипается); шкала лимита тянется по ширине.
2. Растянуть окно широко/высоко: контент центрирован, ничего не «разъезжается», per-category бары и календарь корректны.
3. Открыть настройки/календарь на разных размерах — модалки центрируются и помещаются.

Если на min-размере что-то всё же клипается — сузить `minWidth`/`minHeight` в `src/main/index.js` (Task 3, Step 2) до значений, при которых layout цел, и переприменить.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/css/style.css
git commit -m "fix(layout): timer section shrinks/scrolls on small window sizes"
```

---

### Task 6: Финальная проверка и документация

**Files:** нет кода (проверка + доки на шаге 2).

- [ ] **Step 1: Полный прогон.**

Run: `npm test`
Expected: все тесты зелёные.

Ручной сценарий `npm run dev`:
1. Изменить размер окна и позицию, развернуть/восстановить, закрыть.
2. Запустить снова — окно открылось с тем же размером/позицией (и maximized-состоянием).
3. Проверить, что сохранение bounds не мешает синку/остальному функционалу.

- [ ] **Step 2: Обновить PROGRESS.md и память** (после подтверждения пользователем — по правилу проекта спросить перед записью PROGRESS.md): закрыть пункты «Кастомный titlebar» и «Ресайз окна» из банка идей, добавить блок о выполненном. Затем push ветки `titlebar-resize`.

---

## Self-Review

**Spec coverage:**
- §1 окно (frame:false/resizable/min/bounds save+restore/maximized) → Task 3 (+ Task 1 чистая валидация). ✅
- §2 титлбар (3 зоны, drag/no-drag, центр, двойной клик) → Task 4. ✅
- §3 кнопки окна (SVG, свап max↔restore, ховеры) → Task 2 (иконки) + Task 4 (разметка/CSS/свап). ✅
- §4 IPC + события + preload → Task 3. ✅
- §5 ресайз контента → Task 5. ✅
- §6 тесты (clampBoundsToScreen + ручное) → Task 1 + Task 4/5/6. ✅
- §7 YAGNI (нет светлой темы/кастомного радиуса/кроссплатформы) → соблюдено. ✅

**Placeholder scan:** плейсхолдеров нет; весь код и SVG приведены дословно. Task 5 Step 2 содержит явное правило отката (сузить min-размеры), а не «handle edge cases».

**Type consistency:**
- `clampBoundsToScreen(bounds, displays)` — сигнатура из Task 1 совпадает с вызовом в Task 3. ✅
- `readBoundsSetting()` — определена и вызвана в Task 3. ✅
- IPC-каналы `win:minimize`/`win:maximize-toggle`/`win:close` и события `win:maximized`/`win:unmaximized` — согласованы между main (Task 3), preload (Task 3) и renderer (Task 4). ✅
- Пути к иконкам (`win-min.svg`/`win-max.svg`/`win-restore.svg`/`win-close.svg`) — создаются в Task 2, используются в Task 4. ✅
- i18n-ключи `win_minimize/win_maximize/win_close` — добавлены (Task 4 Step 3) и используются в разметке (Task 4 Step 1). ✅
