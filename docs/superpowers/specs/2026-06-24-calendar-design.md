# Calendar View — Design Spec
Date: 2026-06-24

## Overview

Add a calendar popup to the main screen that shows daily work totals for both users (Sasha and Maxim) for any calendar month. Accessed via a permanent button at the bottom of the left categories panel.

---

## 1. Left Panel Layout Fix

**Problem:** the categories list can grow unboundedly and push a new bottom button off-screen.

**Fix:**
- Add `min-height: 0` to `.categories-list` so it can shrink below its natural height within the flex container.
- Add a new `div.calendar-btn-wrap` after `#categories-list` in the DOM, with `flex-shrink: 0` and `padding: 15px 18px`. This element is always visible at the bottom of the panel.
- Inside: a single `.calendar-btn` button (full width) — primary style (green background, dark text), calendar icon on the left, label «Календарь».

Result: the list scrolls independently; the button is permanently anchored at the bottom regardless of how many categories exist.

---

## 2. Avatar Storage Migration

**Current state:** one global `settings` key `avatar` stores the current user's avatar filename.

**Required state:** per-user keys `avatar_Sasha` and `avatar_Maxim` so both avatars can be read simultaneously for the calendar.

**Migration (runs on app init):**
1. Read existing `avatar` key.
2. Read current `user_name`.
3. If `avatar_<user>` does not exist yet, write it with the value from `avatar` (or default `user.svg`).
4. Delete the old `avatar` key.

**New IPC handler** `db:get-user-avatars` → returns `{ Sasha: 'filename.png', Maxim: 'filename.png' }` (defaults to `user.svg` if a key is missing).

**Affected existing code:**
- `loadUserTab()` reads `avatar_<currentUser>` instead of `avatar`.
- Avatar save writes to `avatar_<currentUser>` instead of `avatar`.
- `seedSetting` call for `avatar` is replaced by seeds for `avatar_Sasha` and `avatar_Maxim`.

---

## 3. Calendar Modal

### Structure (HTML)

```
#calendar-modal  (.modal-overlay)
  .calendar-modal
    .calendar-header
      button.cal-prev  «←»
      span.cal-title   «Июнь 2026»
      button.cal-next  «→»
      button.cal-close «×»
    .calendar-weekdays  (Пн Вт Ср Чт Пт Сб Вс)
    .calendar-grid      (42 cells = 6 rows × 7 cols)
      .cal-cell × 42
        .cal-day-num
        .cal-user-row × 0–2
          img.cal-avatar  (22×22px, border-radius 50%)
          span.cal-user-time  «2h 30m»
```

### Sizing
- Modal: `740px × 520px`, `border-radius: 16px`, consistent with `.settings-modal` styling.
- Grid cells: equal width (1/7 of grid), fixed height ~70px, `border: 1px solid #1a1a24`.

### Cell states

| State | Appearance |
|---|---|
| Normal day, no sessions | Date number only, color `#3a3a5a` |
| Normal day, with sessions | Date number `#c0c0d8` + user rows |
| Today | `border: 1px solid #4ade80` |
| Day outside current month | `opacity: 0.3`, no user rows rendered |

### User row layout (inside a cell)
```
[avatar 22px]  [Xh Ym]
```
- Font size `0.72rem`, color `#9090b0` for time.
- If only one user has sessions that day — show one row. If both — two rows.
- Order: Sasha first, Maxim second (alphabetical by internal key).

### Navigation
- `←` / `→` buttons change the displayed month.
- Minimum: no hard limit — users can browse any month.
- Default: current calendar month when the popup opens.
- Month label format: «Июнь 2026» (Russian month names, full).

### Open / close
- Opens from the «Календарь» button click.
- Closes on `×` button click or click on the overlay background (outside `.calendar-modal`).
- Opening fetches data for the current month immediately.
- Navigation fetches new data on each month change.

---

## 4. Data Layer

### New IPC handler: `db:get-calendar-month`

**Input:** `{ year: number, month: number }` — month is 1–12.

The handler zero-pads month to two digits before passing to SQL (e.g., `6` → `'06'`).

**Query logic:**
```sql
SELECT
  user,
  date(started_at / 1000, 'unixepoch', 'localtime') AS day,
  SUM(duration_seconds) AS total_seconds
FROM sessions
WHERE strftime('%Y', datetime(started_at / 1000, 'unixepoch', 'localtime')) = '2026'
  AND strftime('%m', datetime(started_at / 1000, 'unixepoch', 'localtime')) = '06'
GROUP BY user, day
ORDER BY day
```
(year and zero-padded month are bound as strings at runtime)

**Returns:** `Array<{ user: 'Sasha'|'Maxim', day: 'YYYY-MM-DD', total_seconds: number }>`

### Renderer: `renderCalendar(year, month, rows, avatars)`

1. Build a 42-slot grid (first Monday on or before the 1st of the month → last Sunday on or after the last day).
2. For each slot, find matching `rows` entries by `day` string.
3. Render `.cal-cell` with `.cal-day-num` and `.cal-user-row` elements.
4. Mark today's cell with class `cal-today`.
5. Mark out-of-month cells with class `cal-other-month`.

---

## 5. Files Changed

| File | Changes |
|---|---|
| `src/renderer/index.html` | Add `.calendar-btn-wrap` + `#calendar-modal` markup |
| `src/renderer/css/style.css` | Add styles for `.calendar-btn-wrap`, `.calendar-btn`, `.calendar-modal`, `.calendar-grid`, `.cal-cell`, etc. |
| `src/renderer/js/app.js` | Avatar migration on init; `loadUserTab` / avatar save updated; calendar open/close/render/navigate logic |
| `src/main/index.js` | `db:get-calendar-month` and `db:get-user-avatars` IPC handlers; avatar seed keys updated |
| `src/preload/index.js` | Expose `getCalendarMonth` and `getUserAvatars` on `window.api` |

No new files required. No new npm dependencies.

---

## 6. Out of Scope

- LAN sync of calendar data (each machine only has its own sessions).
- Clicking a day cell to view session details.
- Exporting or printing the calendar.
