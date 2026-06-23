# Burger Menu & Settings — Design Spec
Date: 2026-06-23

## Overview

Add a burger-menu icon to the app header. Clicking it reveals a dropdown with two items: «Настройки» and «О программе». Settings opens a tabbed modal; About opens a small static dialog.

---

## 1. Header Bar

- New 40px strip at the very top of `main-wrapper`, above the limit bar.
- Background: `#0d0d11`, border-bottom: `1px solid #1a1a24`.
- Left: icon button with `assets/icons/menu.png` (24×24). Clicking toggles the dropdown.
- Right: empty for now.
- Native Electron menu bar removed: `Menu.setApplicationMenu(null)` in `main/index.js`.

---

## 2. Dropdown Menu

- Absolutely positioned below the burger button.
- Background: `#191924`, border: `1px solid #26263a`, border-radius: 8px.
- Two items: «Настройки», «О программе».
- Closes on outside click (`document.addEventListener('click', ...)`).
- z-index above all other UI.

---

## 3. Settings Modal

**Size:** ~620×420px, centered over a dark overlay (same pattern as save-dialog).

**Layout:** two columns.
- Left column (160px): tab list — Пользователь / Лимит & Период / Категории / Правка часов.
  Active tab has a left-side color accent (same pattern as category list).
- Right column (flex-1): tab content area.
- × close button top-right.

### Tab 1 — Пользователь

Row 1 — Имя:
- Shows current username («Саша» or «Максим»).
- «Изменить» button → replaces the value inline with two buttons «Саша» / «Максим»; click confirms immediately, reverts display to the selected name.
- Calls `settings:set-user` IPC, updates `current_user` in DB.
- Stat bars and limit bar refresh after change (same as after session save).

Row 2 — Аватар:
- Shows current avatar image (40×40).
- «Изменить» button → replaces right-panel content with a 3×3 grid of all 9 avatars
  (`user.png`, `man.png`, `man_1.png`, `man_2.png`, `man_3.png`, `woman.png`, `woman_1.png`, `woman_2.png`, `woman_3.png`).
- Click on an avatar selects it immediately; grid collapses back to row view.
- Calls `settings:set-avatar` IPC, stores filename in `settings.avatar`.

### Tab 2 — Лимит & Период

Fields:
- «Лимит» — number input (hours, integer).
- «Период с» — date input (ISO date).
- «Период по» — date input (ISO date).

Behaviour:
- If current user is Максим: fields are editable, «Сохранить» button visible.
  Calls `settings:set-limit` IPC on save; limit bar refreshes.
- If not Максим: fields are `disabled`, «Сохранить» hidden, note shown:
  «Изменить настройки может только Максим».

### Tab 3 — Категории

Stub: centered text «Скоро».

### Tab 4 — Правка часов

Stub: centered text «Скоро».

---

## 4. «О программе» Modal

Small dialog ~320×200px, same visual style as save-dialog.

Content:
- App name: «Time Tracker»
- Version: «1.0.0»
- Copyright: «© 2026 Sasha & Maxim»
- «Закрыть» button.

---

## 5. Database Changes

One new column in the `settings` table:

```sql
ALTER TABLE settings ADD COLUMN avatar TEXT DEFAULT 'user.png';
```

Migration: run on app start if the column doesn't exist (check via `PRAGMA table_info(settings)`).

---

## 6. New IPC Handlers

| Channel | Direction | Description |
|---|---|---|
| `settings:get` | renderer → main | Returns `{ user, avatar, limitHours, periodStart, periodEnd }` |
| `settings:set-user` | renderer → main | Updates `current_user` in settings |
| `settings:set-avatar` | renderer → main | Updates `avatar` in settings |
| `settings:set-limit` | renderer → main | Updates `limit_hours`, `period_start`, `period_end`; only executes if caller is Максим (verified server-side) |

All new channels exposed via `contextBridge` in `preload/index.js`.

---

## 7. Files Changed

| File | Change |
|---|---|
| `src/main/index.js` | Remove native menu; add 4 new IPC handlers; DB migration for `avatar` column |
| `src/preload/index.js` | Expose 4 new channels |
| `src/renderer/index.html` | Header bar; dropdown; settings modal markup; about modal markup |
| `src/renderer/css/style.css` | Styles for header, dropdown, settings modal, avatar grid, about dialog |
| `src/renderer/js/app.js` | Burger toggle logic; dropdown; settings modal open/close/tab switching; user/avatar/limit save logic |
