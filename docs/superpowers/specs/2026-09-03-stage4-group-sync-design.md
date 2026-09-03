# Этап 4 — Группа + защищённый синк (+ синк лимита) — дизайн

Дата: 2026-09-03
Статус: согласовано, готово к плану
Ветка: `stage4-group-sync`
Базовая спека: `docs/superpowers/specs/2026-09-02-universal-mode-design.md`

## Область

Этап 4 по решению пользователя **поглощает Этап 5**: за один заход делаем
Create/Join/Leave группы, защищённый handshake по коду, реактивацию синка
(только при активной группе) и синхронизацию лимита/периода owner → member.

Роли (`group_role`) введены в Этапе 3: `solo` (дефолт), `owner`, `member`.
Гейт редактирования лимита по роли уже работает (`member` — read-only).

## Зафиксированные решения

1. **Идентичность:** стабильный per-install `install_id` (генерится один раз).
   Используется как self-guard при приёме данных. `peer_data` остаётся с ключом
   по имени пользователя. Риск одинаковых имён у двух реальных напарников
   (слияние строк в календаре) принят как маловероятный для пары.
2. **Синкаем и часы, и лимит/период** (owner → member).
3. **Leave:** роль → `solo`, код сброшен, синк остановлен, `peer_data` очищается
   (возврат к чистому соло: шкала и календарь без напарника).
4. **Код группы:** 6 символов из `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (без похожих
   0/O, 1/I/L). Код одновременно — секрет handshake.

## 1. Идентичность и настройки

- Новый ключ `install_id` в `settings` — сид один раз в `initDB` через
  `crypto.randomUUID()`. Постоянный для установки, не меняется при переименовании.
- `group_role` (есть с Этапа 3), `group_code` (новый, дефолт `''`).
- Grouped-состояние = `group_role ∈ {owner, member}` И `group_code` непустой.

## 2. Чистая логика → `src/main/group.js` (UMD + node:test)

Выносим в отдельный чистый модуль (как `presets.js`/`period.js`):

- `generateCode(rng?)` → строка из 6 символов алфавита
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. `rng` (опциональный) — для детерминизма в
  тестах; по умолчанию `Math.random`.
- `normalizeCode(s)` → `String(s).trim().toUpperCase()` (нормализация ввода member).
- `validateHandshake(localCode, msg)` → `true`, если `msg && msg.code` непустой
  и `msg.code === localCode`.
- `isSelf(payload, myInstallId)` → `payload.installId === myInstallId`.
- `shouldApplyLimit(receiverRole, senderRole)` →
  `receiverRole === 'member' && senderRole === 'owner'`.

## 3. Протокол (`src/main/sync.js`)

- **Handshake.** При установлении WS-соединения (и на исходящем `open`, и на
  входящем `connection`) первым сообщением отправляется
  `{ type:'hello', installId, code }`, где `code` — локальный `group_code`.
  Получатель прогоняет `validateHandshake(localCode, msg)`:
  - не совпало → `ws.close()`, статус-индикатор не зажигается;
  - совпало → отметить соединение валидным, отправить свой sync-payload.
  Обмен `sync` принимается только после успешного `hello`.
- **UDP** остаётся только для discovery: broadcast `{ installId, port }`.
  Код по UDP **не** передаётся — валидация только в WS-handshake.
- **Sync-payload:**
  `{ type:'sync', installId, role, user, avatar, days:[{day,total_seconds}], limit?, period? }`.
  Поля `limit` (секунды) и `period` (`{start,end}` ISO) включаются **только**
  когда локальная роль отправителя `owner`.
- **Приём sync:**
  - `isSelf(payload, myInstallId)` → игнор (self-guard по стабильному ID);
  - иначе `storePeerData(payload)` (как сейчас: дни + аватар, ключ по имени);
  - если `shouldApplyLimit(myRole, payload.role)` — записать
    `monthly_limit_seconds`, `period_start`, `period_end` из payload в свои
    `settings` и уведомить renderer (`sync:limit-updated`) для рефреша шкалы.

## 4. Жизненный цикл синка

- `startSync(db, saveDB, win)` вызывается **только при grouped-состоянии** —
  на старте приложения (если роль уже grouped) и после Create/Join.
  Идемпотентен: повторный вызов при активном синке — no-op.
- `stopSync()` (новый): закрывает WS-сервер, UDP-сокет, `peerSocket`, очищает
  `syncTimer`/`reconnectTimer`, сбрасывает `serverClients`, гасит статус.
  Вызывается на Leave.
- Реконнект (30 c) и авто-broadcast (30 c) работают только пока синк активен.

## 5. IPC (`src/main/index.js` + preload)

- `group:get-state` → `{ role, code }` (для UI вкладки).
- `group:create` → генерит код, `group_role='owner'`, `group_code=code`,
  `startSync`, возвращает код.
- `group:join(code)` → `normalizeCode`, `group_role='member'`,
  `group_code=code`, `startSync`. Проверки существования peer нет — соединение
  устанавливается через discovery; неверный код → handshake молча отклоняется,
  индикатор остаётся серым.
- `group:leave` → `stopSync`, `group_role='solo'`, `group_code=''`,
  `DELETE FROM peer_data`, `saveDB`.

Раскомментировать реактивацию синка в `app.whenReady` — но обёрнутую в проверку
grouped-состояния (не безусловный `startSync`, как было до Этапа 2).

## 6. UI вкладки «Синхронизация» (`index.html` + `app.js`)

Два состояния, переключаются по `group:get-state`:

- **Solo:** кнопка «Создать группу»; строка «Присоединиться» (input кода +
  кнопка). Интервал и «последняя синхронизация» скрыты.
- **Группа:** бейдж роли + отображение кода (owner диктует напарнику; member
  видит код, по которому вошёл); кнопка «Покинуть группу»; интервал и
  «последняя синхронизация» видимы; индикатор в шапке актуален.

Все новые строки — через i18n, ключи в обоих словарях (ru/en). Индикатор
`sync-dot` и кнопка `Sync` в шапке становятся активны только в группе.

## 7. Тесты

- `node:test` для `group.js`: `generateCode` (длина 6, только из алфавита,
  через инжектируемый `rng`), `normalizeCode`, `validateHandshake` (совпадение/
  несовпадение/пустой код), `isSelf`, `shouldApplyLimit` (все комбинации ролей).
- Расширить `peer.test.js`: приём собственного `install_id` не попадает в
  `peer_data` даже при совпадающем имени.
- Синк между двумя реальными инстансами — ручная проверка (`npm run dev`), как
  на Этапе LAN-синхронизации.

## 8. Явно НЕ входит (YAGNI / отложено)

- Группы > 2 участников (mesh).
- Настройка портов синка в UI (43210/43211 — константы).
- Полноценная криптоаутентификация (HMAC/TLS) — handshake-кода достаточно для
  домашней сети; это закрывает пункт «Защита соединения между устройствами» из
  банка идей PROGRESS.md на приемлемом уровне.
- Пересмотр `peer_data_reset_v1` — оставляем флаг как есть (безвреден;
  install_id-guard делает одноразовую чистку избыточной на будущее).
