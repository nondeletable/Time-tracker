# Spec: Мягкое удаление категорий

Date: 2026-07-03

## Контекст

В приложении есть вкладка «Категории» в настройках с кнопкой «Изменить» на каждой строке. Кнопки удаления нет. Удалять категории нужно без потери исторических данных — сессии должны оставаться в БД, просто перестать учитываться.

## Решение: soft delete

Добавить колонку `deleted INTEGER NOT NULL DEFAULT 0` в таблицу `categories`. Удалённые категории остаются в БД, но исключаются из всех активных расчётов и UI.

---

## 1. База данных

### Миграция

При каждом запуске `initDB` проверять наличие колонки и добавлять если нет:

```sql
-- выполнять через db.exec, перехватывать ошибку если колонка уже существует
ALTER TABLE categories ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0
```

Реализация: `try { db.exec('ALTER TABLE ...') } catch (_) {}` — идемпотентно.

### Изменения в существующих SQL-запросах

| Хендлер | Изменение |
|---|---|
| `db:get-categories` | добавить `WHERE deleted = 0` |
| `db:get-monthly-stats` | добавить `AND c.deleted = 0` в JOIN-условие |
| `db:get-shared-total` | добавить JOIN с categories + `WHERE c.deleted = 0` |
| `db:get-sessions-by-date` | добавить `AND c.deleted = 0` |
| `buildPayload` в sync.js | добавить JOIN с categories + `WHERE c.deleted = 0` |

### Новые IPC-хендлеры

- `db:get-deleted-categories` — возвращает `SELECT id, name FROM categories WHERE deleted = 1 ORDER BY name`
- `db:soft-delete-category(id)` — `UPDATE categories SET deleted = 1 WHERE id = ?`
- `db:restore-category(id)` — `UPDATE categories SET deleted = 0 WHERE id = ?`

### Preload (window.api)

Добавить:
- `getDeletedCategories: () => ipcRenderer.invoke('db:get-deleted-categories')`
- `softDeleteCategory: (id) => ipcRenderer.invoke('db:soft-delete-category', id)`
- `restoreCategory: (id) => ipcRenderer.invoke('db:restore-category', id)`

---

## 2. Иконка корзины

Файл: `assets/icons/del.svg`

Текущий fill: `#000000` — не читается на тёмном фоне. Исправить на `#9090b0` (стандарт для иконок приложения, как у menu.svg и user.svg).

Размер в кнопке: 14×14px (как у иконки календаря в кнопке «Календарь»).

---

## 3. Настройки → вкладка «Категории»

### Sub-tabs

Добавить в верхнюю часть `#pane-categories` два переключателя:

```html
<div class="cat-subtabs">
  <button class="cat-subtab active" data-subtab="active">Активные</button>
  <button class="cat-subtab" data-subtab="deleted">Удалённые</button>
</div>
```

По умолчанию всегда открыт «Активные». При переключении меняется класс `active` и перерисовывается список.

### Список «Активные»

Каждая строка: `[dot] [name] [Изменить] [🗑]`

```html
<li class="cat-settings-item">
  <span class="cat-settings-dot" style="background: #60a5fa"></span>
  <span class="cat-settings-name">Engine Development</span>
  <button class="settings-row-btn">Изменить</button>
  <button class="cat-delete-btn" title="Удалить">
    <img src="../../assets/icons/del.svg" width="14" height="14" alt="">
  </button>
</li>
```

Клик по `.cat-delete-btn` → диалог подтверждения (см. ниже).

### Диалог подтверждения удаления

Переиспользовать существующий `#save-dialog` паттерн (`dialog-overlay` + `dialog`):

```
┌──────────────────────────────┐
│  Удалить категорию?          │
│                              │
│  «Engine Development»        │
│                              │
│  Часы по ней перестанут      │
│  учитываться.                │
│                              │
│  [Отмена]    [Удалить]       │
└──────────────────────────────┘
```

Реализация: отдельный `<div id="cat-delete-dialog">` по образцу существующего `#save-dialog`. Кнопка «Удалить» — красная (`.danger`-стиль).

### Список «Удалённые»

```html
<ul class="cat-settings-list" id="cat-deleted-list"></ul>
<p class="cat-deleted-empty hidden" id="cat-deleted-empty">
  Нет удалённых категорий
</p>
```

Каждая строка: `[name] [Восстановить]` — без цветной точки, текст серый.

```html
<li class="cat-settings-item cat-settings-item--deleted">
  <span class="cat-settings-name">Bugfixes</span>
  <button class="settings-row-btn">Восстановить</button>
</li>
```

---

## 4. Главный экран и остальные места

| Место | Поведение |
|---|---|
| Sidebar категорий | только `deleted = 0` |
| Диалог сохранения (select) | только `deleted = 0` |
| Per-category шкалы прогресса | только `deleted = 0` |
| Общий лимит (limit bar) | не считает сессии удалённых категорий |
| Вкладка «Правка часов» | сессии удалённых категорий не отображаются |
| Sync payload | агрегаты только по сессиям с `c.deleted = 0` |

После восстановления категории: вызвать `refreshStats()` + `renderCategories()` + `renderDialogCategories()` для обновления всех мест.

---

## 5. CSS

### `.cat-subtabs`
```css
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
  transition: background 0.15s, color 0.15s;
}
.cat-subtab.active {
  background: #14141e;
  border-color: #4ade80;
  color: #d8d8f0;
}
```

### `.cat-delete-btn`
```css
.cat-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.5;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
}
.cat-delete-btn:hover { opacity: 1; }
```

### `.cat-settings-item--deleted`
```css
.cat-settings-item--deleted .cat-settings-name {
  color: #4a4a6a;
}
```

### `.dialog-btn.danger`
```css
.dialog-btn.danger {
  background: #7f1d1d;
  color: #fca5a5;
}
.dialog-btn.danger:hover { background: #991b1b; }
```

---

## Что НЕ входит в scope

- Физическое удаление категорий из БД
- Отображение удалённых категорий в статистике с какой-либо пометкой
- Счётчик удалённых категорий на кнопке sub-tab
