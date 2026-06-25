# Spec: Вкладка «Синхронизация» + кнопка в шапке

Date: 2026-06-25

## Контекст

В приложении уже реализована LAN-синхронизация (WebSocket + UDP broadcast). Интервал периодической синхронизации захардкожен в `src/main/sync.js` (`SYNC_INTERVAL_MS = 5 * 60 * 1000`). Кнопка ручной синхронизации — emoji `⟳` в шапке.

Цель: дать пользователю возможность управлять интервалом синхронизации и видеть время последней синхронизации; заменить emoji-кнопку на текстовую.

---

## 1. Кнопка ручной синхронизации в шапке

### Текущее состояние

```html
<button class="sync-btn" id="sync-btn">⟳</button>
<div class="sync-dot" id="sync-dot"></div>
```

### После изменений

```html
<div class="sync-dot" id="sync-dot"></div>
<button class="sync-text-btn" id="sync-btn">Синхронизация</button>
```

Dot идёт перед кнопкой. Gap между ними — 6px (через `gap` на `.app-header`).

### CSS для `.sync-text-btn`

- `font-size`: как у остальных элементов шапки (~13px)
- `color`: `#b0b0d0` (стандартный текст приложения)
- `background`: `#1e1e2e`
- `border`: `1px solid #2e2e4e`
- `border-radius`: 6px
- `padding`: 4px 10px
- `:hover` и `:active`: `background: #2a2a3e`
- Убрать старые стили `.sync-btn`

---

## 2. Вкладка «Синхронизация» в настройках

### HTML

Новая кнопка вкладки в `<nav class="settings-nav">`:
```html
<button class="settings-tab" data-tab="sync">Синхронизация</button>
```

Новая панель `#pane-sync` в `.settings-body`:

```
┌─────────────────────────────────────────────────┐
│ Интервал       [select: 1 мин … 60 мин]         │
│ Последняя синхронизация   Сегодня в 14:32 / —   │
└─────────────────────────────────────────────────┘
```

Кнопки `Сохранить` нет — изменение интервала применяется сразу при смене значения в `<select>` (событие `change`).

### Варианты интервала

| Значение (сек) | Отображение |
|---|---|
| 60 | 1 мин |
| 120 | 2 мин |
| 300 | 5 мин (по умолчанию) |
| 600 | 10 мин |
| 900 | 15 мин |
| 1200 | 20 мин |
| 1800 | 30 мин |
| 3600 | 60 мин |

### Отображение времени последней синхронизации

- Хранится в памяти (переменная `lastSyncAt` в `sync.js`), не персистируется
- Если синхронизации не было с момента запуска — показывается `—`
- Формат: если сегодня → `Сегодня в HH:MM`; если другой день → `DD.MM.YYYY HH:MM`
- Обновляется при открытии вкладки (`loadSyncTab()`) + при получении события `sync:synced`

---

## 3. Технические изменения

### `src/main/sync.js`

- Убрать константу `SYNC_INTERVAL_MS`
- Добавить переменную `let syncIntervalMs = 5 * 60 * 1000`
- Добавить переменную `let lastSyncAt = null`
- В `sendSyncPayload`: после успешного `ws.send(...)` записать `lastSyncAt = Date.now()` и отправить событие `sync:synced` в renderer через `_win.webContents.send('sync:synced', lastSyncAt)`
- Добавить экспорт функции `setSyncInterval(seconds)`:
  - обновляет `syncIntervalMs`
  - если `syncTimer` активен — `clearInterval`, перезапускает с новым значением на текущем `peerSocket`
- Добавить экспорт функции `getLastSyncAt()` → возвращает `lastSyncAt`

### `src/main/index.js`

- При инициализации DB: `seedSetting('sync_interval_seconds', '300')`
- После `startSync(...)`: читать `sync_interval_seconds` из DB и вызвать `setSyncInterval(value)`
- Добавить IPC-хендлеры:
  - `sync:get-interval` → `db:get-setting('sync_interval_seconds')` (число)
  - `sync:set-interval(seconds)` → сохранить в DB + вызвать `setSyncInterval(seconds)`
  - `sync:get-last-sync` → `getLastSyncAt()`

### `src/preload/index.js`

Добавить в `contextBridge.exposeInMainWorld('api', {...})`:
- `getSyncInterval: () => ipcRenderer.invoke('sync:get-interval')`
- `setSyncInterval: (s) => ipcRenderer.invoke('sync:set-interval', s)`
- `getLastSync: () => ipcRenderer.invoke('sync:get-last-sync')`
- `onSyncDone: (cb) => ipcRenderer.on('sync:synced', (_, ts) => cb(ts))`

### `src/renderer/index.html`

- Заменить `<button class="sync-btn" ...>⟳</button>` на `<button class="sync-text-btn" id="sync-btn">Синхронизация</button>`
- Поменять порядок: dot перед кнопкой
- Добавить `<button class="settings-tab" data-tab="sync">Синхронизация</button>`
- Добавить `<div class="settings-pane hidden" id="pane-sync">` с `settings-row` для интервала и последней синхронизации

### `src/renderer/js/app.js`

- Убрать старый `sync-btn` CSS-класс из запросов; `syncBtn` теперь `sync-text-btn`
- Добавить `loadSyncTab()`:
  - читает `window.api.getSyncInterval()` → выставляет `<select>`
  - читает `window.api.getLastSync()` → форматирует и показывает
- Подписаться `window.api.onSyncDone(ts => ...)` → обновить отображение времени если вкладка sync открыта
- В обработчике вкладок добавить `if (tab.dataset.tab === 'sync') loadSyncTab()`

### `src/renderer/css/style.css`

- Убрать/заменить стили `.sync-btn`
- Добавить стили `.sync-text-btn`
- Скорректировать `gap` в `.app-header` для нового порядка dot + кнопка

---

## Что не входит в scope

- Персистирование `lastSyncAt` между перезапусками
- Настройка интервала UDP broadcast
- Отображение IP/имени peer
