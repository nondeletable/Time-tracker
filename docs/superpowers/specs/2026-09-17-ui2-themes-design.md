# Этап UI-2 — темы (emerald/indigo × dark/light) — дизайн

Дата: 2026-09-17
Статус: согласовано, готово к плану
Ветка (план): `stage-ui2-themes`
Зависит от: UI-1 (токенизация палитры) — влит через `stage-ui1-tokens`

## Контекст

UI-1 перевёл всю интерфейсную палитру на 26 семантических CSS-токенов в `:root`
(одна тёмная тема). UI-2 добавляет **4 темы** из прототипа Максима
(`ui-audit/prototypes/tt-prototype.html`): две оси — accent (emerald/indigo) ×
mode (dark/light) — и переключатель в настройках.

## Продуктовые решения (согласовано)

- **Источник палитр:** целиком палитры прототипа (вариант B). Все 4 темы — значения
  Максима. Текущий тёмный вид **изменится** на прототиповский emerald-dark
  (фон `#0b0f14`, accent `#34d399` вместо прежнего `#4ade80`).
- **Токены:** Максим задал 11 «якорей» на тему; нашему приложению нужно 26.
  Недостающие 15 выводим **один раз** через `color-mix()` из якорей — авто-пересчёт
  под активную тему.
- **Переключатель:** во вкладке настроек «Общие», рядом с языком. Два `<select>`
  (Акцент, Тема), live-применение без перезапуска (паттерн `lang-select`).
- **Дефолт:** `theme=dark`, `accent=emerald`. ОС (`prefers-color-scheme`) не
  учитываем — существующие установки и новые стартуют в emerald-dark.
- **Electron 31 / Chromium 126** — `color-mix()` поддержан.

## 1. Архитектура палитры (`style.css`)

Две оси на `<html>`: `data-accent` (`emerald`|`indigo`) × `data-theme`
(`dark`|`light`).

- **4 блока-темы** селекторами из двух атрибутов — ровно один матчится в любой
  момент, без игр со специфичностью. Каждый кладёт 11 якорей Максима дословно.
- `:root` дублирует emerald-dark как fallback (если атрибуты не проставлены) +
  содержит 15 производных токенов через `color-mix()` над якорями.

### 1.1 Якоря Максима (11 токенов × 4 темы, дословно из прототипа)

**emerald · dark** — `:root` и `[data-accent="emerald"][data-theme="dark"]`:
```
--bg:#0b0f14; --surface:#11161d; --surface-2:#161d26; --border:#212b37;
--text:#f0f4f8; --text-dim:#97a3b6; --text-mute:#5f6b7d;
--accent:#34d399; --accent-soft:#0e2b22; --on-accent:#04231a; --danger:#f87171;
```
**emerald · light** — `[data-accent="emerald"][data-theme="light"]`:
```
--bg:#fbfbfc; --surface:#ffffff; --surface-2:#f1f3f6; --border:#e5e8ee;
--text:#111827; --text-dim:#5a6478; --text-mute:#9aa3b4;
--accent:#059669; --accent-soft:#d8f3e7; --on-accent:#ffffff; --danger:#dc2626;
```
**indigo · dark** — `[data-accent="indigo"][data-theme="dark"]`:
```
--bg:#0f0f0e; --surface:#171716; --surface-2:#1f1f1d; --border:#2b2b28;
--text:#f0efec; --text-dim:#a0a099; --text-mute:#6b6b64;
--accent:#818cf8; --accent-soft:#23234a; --on-accent:#10102a; --danger:#f87171;
```
**indigo · light** — `[data-accent="indigo"][data-theme="light"]`:
```
--bg:#f4f4f2; --surface:#ffffff; --surface-2:#ebebe7; --border:#e0e0da;
--text:#1c1c1a; --text-dim:#61615c; --text-mute:#97978f;
--accent:#4f46e5; --accent-soft:#e6e5fb; --on-accent:#ffffff; --danger:#dc2626;
```

### 1.2 Производные токены (15, один раз на `:root` через `color-mix`)

Определяются после якорей `:root`; резолвятся по активному значению якорей на
`<html>`, поэтому пересчитываются при смене темы автоматически.

```css
--surface-3:      color-mix(in srgb, var(--surface-2) 75%, var(--border));
--control:        color-mix(in srgb, var(--surface-2) 60%, var(--border));
--control-hover:  color-mix(in srgb, var(--surface-2) 40%, var(--border));
--border-soft:    color-mix(in srgb, var(--border) 55%, var(--surface-2));
--border-strong:  color-mix(in srgb, var(--border) 70%, var(--text-mute));
--text-2:         color-mix(in srgb, var(--text) 60%, var(--text-dim));
--text-faint:     color-mix(in srgb, var(--text-mute) 65%, var(--border));
--text-disabled:  color-mix(in srgb, var(--text-mute) 40%, var(--border));
--accent-hover:   color-mix(in srgb, var(--accent) 86%, black);
--accent-soft-text: var(--accent);
--danger-hover:   color-mix(in srgb, var(--danger) 86%, black);
--danger-strong:  color-mix(in srgb, var(--danger) 70%, black);
--danger-soft:    color-mix(in srgb, var(--danger) 16%, var(--bg));
--danger-soft-text: var(--danger);
--on-danger:      #ffffff;
```

Проценты — стартовые; подстраиваются по визуальной сверке при реализации (особенно
`--accent-hover`, `--danger-strong`, `--danger-soft`).

**Итог структуры `:root`:** якоря emerald-dark (fallback) + 15 производных. Плюс 4
блока-темы с якорями. Один источник истины на семью.

## 2. Переключатель, хранение, применение (`app.js`, `index.html`, `dict.js`)

- **Ключи `settings`:** `theme` (`dark`|`light`, дефолт `dark`), `accent`
  (`emerald`|`indigo`, дефолт `emerald`).
- **`applyTheme(theme, accent)`** (аналог `applyI18n`): проставляет
  `document.documentElement.dataset.theme = theme` и `.dataset.accent = accent`.
- **Boot** (рядом с загрузкой языка, `app.js:~80`): читаем оба ключа; если нет —
  пишем дефолты через `setSetting`; зовём `applyTheme`.
- **UI «Общие»:** два `<select>` тем же паттерном, что `lang-select`:
  - `#accent-select` — опции `emerald` / `indigo`
  - `#theme-select` — опции `dark` / `light`
  На `change`: `setSetting(key, value)` + `applyTheme(...)`. Live, без перезапуска.
- **i18n (`dict.js` ru/en):** ключи лейблов `settings_theme` («Тема»/«Theme»),
  `settings_accent` («Акцент»/«Accent»), опции `theme_dark`/`theme_light`
  («Тёмная/Светлая», «Dark/Light»); «Emerald»/«Indigo» — имена собственные,
  одинаково в обоих словарях (`accent_emerald`/`accent_indigo`).
- **`index.html`:** две строки в «Общие» с `data-i18n`-лейблами и селектами;
  опции размечены `data-i18n`.

## 3. Долг box-shadow (из UI-1)

- `.timer-ring.running` (`style.css:354`):
  `box-shadow: 0 0 40px rgba(74,222,128,0.12)` →
  `box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 12%, transparent)` —
  свечение следует за акцентом.
- **Аудит `rgba()`:** прочие — нейтральные чёрные тени/скримы
  (`style.css:347, 440, 457, 640, 666, 684, 1318`), темо-нейтральны, оставляем.
  Тяжёлую чёрную тень idle-кольца (`347`) проверить в светлой теме на визуальной
  сверке; смягчить только если явно грубо (не обязательное изменение).

## 4. Тесты

- **Обновить `test/no-hardcoded-colors.test.js`:** правило меняется с «нет hex вне
  `:root`» на «hex разрешён только в **определениях токенов** (`--x: #hex`),
  запрещён в обычных свойствах». Так hex-якоря в 4 блоках-темах легальны, а сырые
  цвета в `color:/background:/border:` по-прежнему ловятся.
  Реализация: для каждой строки — offender, если содержит `#hex` И не матчит
  `/^\s*--[a-z0-9-]+\s*:/`.
- **i18n-паритет:** существующие тесты (`i18n.test.js`) enforce'ят наличие новых
  ключей в обоих словарях и резолв `data-i18n` из `index.html`.
- **Ручная сверка:** пройтись по всем экранам (главный, диалог, настройки,
  календарь, over-limit) во **всех 4 темах**.

## Не в скоупе

- Раскладка Dashboard, Focus-режим, canvas-эффекты (этапы UI-3+).
- Апгрейд селекторов до сегмент-тумблера (косметика, позже).
- `prefers-color-scheme` авто-детект.

## Обратимость

- Чисто визуально-стилевой этап + два `settings`-ключа. Логика приложения не
  меняется. Откат — по коммитам; при отсутствии ключей приложение стартует в
  emerald-dark (fallback на `:root`).
