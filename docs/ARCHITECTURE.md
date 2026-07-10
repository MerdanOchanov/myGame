# Архитектура проекта: Scientists World

## 1. Назначение документа

Документ описывает целевую архитектуру Scientists World: web-игры с реальной картой, геопозицией, hex-сеткой 50 м, процедурными биомами, домами-лабораториями, материалами, лекарствами, тестами на крысах, событиями, бартером и рейтингом выживания.

Backend-стек, БД, geo-index библиотека, авторизация и real-time transport зафиксированы в разделе 3. MVP проектируется сразу как backend-backed игра, а не как offline-прототип.

## 2. Архитектурный принцип

Игра должна быть разделена на три слоя:

1. `Client` — карта, UI, local rendering, ввод игрока.
2. `Game Backend` — правила игры, проверка действий, real-time, persistence.
3. `Game Data` — долговременное хранение игроков, домов, hex-ячеек, материалов, лекарств, событий и рейтинга.

Критичное правило: клиент не должен быть источником истины для прогресса, геопозиции, крафта, генерации материалов, рейтинга и обменов.

## 3. Принятые архитектурные решения

| Вопрос | Решение |
|---|---|
| MVP | Сразу backend-backed MVP |
| География | Сразу весь мир, без ограничения Туркменистаном |
| Backend | **Supabase** (Postgres + Realtime + Auth + Edge Functions) |
| БД | **PostgreSQL + PostGIS** (через Supabase) |
| Hex-grid | **H3.js / h3-js**, resolution **12** (ближайшее приближение к диаметру 50 м) |
| Блоки | Мир делится на блоки по 7 ячеек — родительская ячейка **H3 res 11** (aperture-7 сота); дом занимает целый блок |
| Биомы | Создаются **админ-функцией**: на выделенном участке (без ограничения размера) разбрасывается несколько биомов (7–7777 ячеек каждый) с покрытием ≥50%; тип каждого — по преобладающему цвету карты в его месте; авто-генерации нет |
| Материалы | Фиксированный пул **1–10 разных материалов на биом**, сбор — случайный из пула |
| Админ-доступ | Пароль в секрете Edge Function (`ADMIN_PASSWORD`), проверка на сервере |
| Авторизация | **Supabase Auth**: email/password + OAuth (Google/Apple) |
| Real-time transport | **Supabase Realtime** (WebSocket поверх Postgres logical replication) |
| Debug mode | Добавить режим клика по карте для разработки и тестирования |
| Дом-лаборатория | Можно переносить бесплатно (cooldown раз в реальные сутки); обнуляется только крупными (global/regional) событиями |
| Смерть игрока | Обнуляет survival-run, инвентарь и лекарства; сохраняются аккаунт и `KnowledgeProfile` |
| Тест лекарства на крысе | Раскрывает 1 случайное скрытое свойство за тест; шанс 30% израсходовать лекарство; пауза между тестами (таймаут) задаётся админом; крыс всегда ≥3, у крыс есть имена |
| Имя лекарства | Право первооткрывателя: имя закрепляется за первым создателем нового рецепта |
| Глобальные события | Создаёт админ (центр+радиус+сила); шестигранник Ø 1–20000 км; хаотичный дрейф детерминирован от seed+время (без cron); предупреждение за пол-радиуса; внутри — постепенные (возможно летальные) эффекты, применяемые на серверном пути `mapLayers` |
| Админ-настройки | Глобальные значения (таймаут испытаний) в таблице `game_settings` |
| Знание свойств материалов | Персональное для каждого игрока |
| Бартер | Физический обмен в случайной hex-ячейке в радиусе 500 м |
| Условие обмена | Оба игрока должны присутствовать в barter-ячейке |
| Видимость домов | Дома других игроков видны только в радиусе 1000 м от текущего игрока |

## 4. Общая схема

```mermaid
flowchart LR
  Player["Player browser"]
  Client["Web Client\nTypeScript + Vite + Phaser + Leaflet"]
  API["Game API"]
  RT["Real-time Gateway"]
  Core["Domain Core"]
  Jobs["World Jobs"]
  DB["Main Database"]
  Cache["Cache / PubSub"]
  Maps["Map Provider"]

  Player --> Client
  Client --> Maps
  Client --> API
  Client <--> RT
  API --> Core
  RT --> Core
  Jobs --> Core
  Core --> DB
  Core --> Cache
  RT --> Cache
```

## 5. Client architecture

Текущий client остается web-приложением на `TypeScript`, `Vite`, `Phaser` и `Leaflet`.

Ответственность client:

| Зона | Ответственность |
|---|---|
| Map UI | Отображение реальной карты и игровых слоев |
| Hex overlay | Рендер hex-ячеек 50 м |
| Player location | Получение координат через Browser Geolocation API |
| Debug location | Тестовый режим выбора позиции кликом по карте |
| Laboratory UI | Крафт лекарств, тесты на крысах, журнал экспериментов |
| Inventory UI | Материалы, лекарства, известные свойства |
| Barter UI | Просмотр и создание barter-offer |
| Event UI | Отображение активных событий и эффектов |

Client может рассчитывать preview-данные, но финальное действие должно подтверждаться backend.

Примеры действий, которые требуют backend-подтверждения:

1. `claimHome`
2. `collectMaterial`
3. `craftMedicine`
4. `testMedicineOnRat`
5. `applyMedicine`
6. `createBarterOffer`
7. `acceptBarterOffer`

Debug-режим должен быть явно отделен от production-режима. Действия, выполненные через debug-click, не должны попадать в публичный рейтинг, экономику и production-прогресс.

## 6. Domain core

`Domain Core` — центральный слой игровой логики. Его нужно держать максимально независимым от Phaser, Leaflet, DOM и конкретной БД.

Предлагаемая структура:

```text
src/
  core/
    geo/
      HexGrid.ts
      GeoPosition.ts
      GeoDistance.ts
    player/
      Player.ts
      PlayerState.ts
      SurvivalRun.ts
    home/
      LaboratoryHome.ts
      HomeClaimService.ts
    biome/
      Biome.ts
      BiomeGenerator.ts
      BiomeService.ts
    materials/
      Material.ts
      MaterialGenerator.ts
      MaterialTraitCatalog.ts
      MaterialDiscoveryService.ts
    medicine/
      Medicine.ts
      MedicineCraftingService.ts
      MedicineEffectResolver.ts
    lab/
      LabRat.ts
      RatStateService.ts
      ExperimentService.ts
    events/
      GameEvent.ts
      EventResolver.ts
    economy/
      BarterOffer.ts
      BarterService.ts
    rating/
      SurvivalRatingService.ts
```

## 7. Backend architecture

Целевой backend нужен не для MVP-витрины, а для честной multiplayer-игры.

Ответственность backend:

| Модуль | Ответственность |
|---|---|
| Auth | Игрок, сессия, устройство |
| Geo Validation | Проверка координат и допустимости действия |
| Hex Service | Перевод координат в hex-cell |
| Home Service | Claim, перенос и обнуление дома-лаборатории |
| Biome Service | Генерация и чтение биомов |
| Material Service | Генерация и фиксация материалов |
| Medicine Service | Крафт, эффекты, стабильность |
| Lab Service | Крысы, тесты, раскрытие эффектов |
| Event Service | Глобальные, региональные, локальные события |
| Inventory Service | Материалы и лекарства игрока |
| Barter Service | Физический обмен в случайной hex-ячейке |
| Rating Service | Top-100 по survival-run |
| Realtime Service | Nearby-карта домов, события, barter-встречи |

## 8. Hex-grid

Hex-grid является базовой координатной моделью игры.

Требования:

1. Размер hex-ячейки — 50 метров в диаметре.
2. Координаты игрока должны стабильно переводиться в `hexCellId`.
3. `hexCellId` должен быть одинаковым на client и backend.
4. Биомы, дома, события и материалы должны ссылаться на `hexCellId`.
5. Хранить все hex-ячейки мира заранее нельзя; ячейки нужно создавать лениво при первом обращении.

```ts
interface HexCell {
  id: string;                      // h3-индекс res 12
  center: { lat: number; lng: number };
  blockId?: string;                // h3-индекс res 11 — блок из 7 ячеек
}
```

Принятое решение: использовать `H3.js` (`h3-js`) как готовую geo-index библиотеку, чтобы не писать собственную геометрическую модель мира с нуля. Выбранный resolution — **12** (ближайшее практическое приближение к игровому диаметру 50 м).

Блоки: мир делится на блоки по 7 ячеек — это родительская ячейка `H3` resolution **11** (aperture-7: каждая res-11 ячейка состоит ровно из 7 res-12 ячеек, образуя соту). `blockId = cellToParent(hexCellId, 11)`, ячейки блока = `cellToChildren(blockId, 12)`. Дом занимает целый блок; биомы строятся из блоков (1–1111 на биом = 7–7777 ячеек). Клиент разбрасывает биомы по выделенному участку (`core/biome/BiomeScatter.ts`, связные кластеры через соседей блоков, покрытие ≥50%); сервер валидирует размеры и непересечение, уникальный PK `biome_blocks.block_id` — гарантия, что блок не попадёт в два биома.

Важно: размер ячейки в `H3` на resolution 12 не равен ровно 50 м. Поверх `H3` может потребоваться дополнительная игровая нормализация, если точность 50 м окажется критичной для баланса.

## 9. Procedural generation

Процедурная генерация должна быть воспроизводимой и фиксируемой.

Разница между типами генерации:

| Тип | Правило |
|---|---|
| Biome generation | Может быть deterministic по `hexCellId + worldSeed` |
| Material generation | Генерируется один раз и навсегда сохраняется |
| Medicine generation | Генерируется при крафте и сохраняется как созданный объект |
| Event generation | Создается системой событий и имеет срок действия |

Материал нельзя пересчитывать каждый раз только по seed, если по правилам он должен быть навсегда зафиксирован. Seed можно хранить для аудита и повторяемости, но source of truth — запись в БД.

## 10. Data model

Минимальные агрегаты:

| Aggregate | Ключ | Назначение |
|---|---|---|
| `Player` | `playerId` | Аккаунт ученого |
| `PlayerState` | `playerId` | Состояния, эффекты, жизнь |
| `SurvivalRun` | `runId` | Попытка выживания |
| `LaboratoryHome` | `homeId` | Дом-лаборатория в hex |
| `HexCell` | `hexCellId` | Игровая ячейка |
| `Biome` | `biomeId` | Группа блоков (7–7777 ячеек), созданная админом |
| `GameEvent` | `eventId` | Дрейфующее событие (база+seed+радиус+сила); позиция вычисляется от времени |
| `GameSettings` | `key` | Глобальные админ-настройки (напр. таймаут испытаний) |
| `Material` | `materialId` | Зафиксированный материал |
| `Medicine` | `medicineId` | Созданное лекарство |
| `LabRat` | `ratId` | Крыса для тестов |
| `Experiment` | `experimentId` | Результат теста |
| `GameEvent` | `eventId` | Событие мира |
| `Inventory` | `playerId` | Предметы игрока |
| `BarterOffer` | `offerId` | Бартерное предложение |
| `BarterMeeting` | `meetingId` | Случайная hex-ячейка физического обмена |
| `KnowledgeProfile` | `playerId + materialId` | Персонально открытые свойства материала |

## 11. Persistence

Для реальной игры нужны долговременное хранилище и транзакции.

Критичные операции:

| Операция | Почему нужна транзакция |
|---|---|
| Claim home | Нельзя занять одну hex-ячейку двумя игроками |
| Generate material | Нельзя создать две разные версии одного материала |
| Craft medicine | Нужно атомарно списать материалы и создать лекарство |
| Barter accept | Нужно атомарно обменять предметы двух игроков |
| Death / survival-run end | Нужно завершить run и очистить инвентарь/лекарства |
| Home reset by event | Нужно снять владение с hex-ячеек, затронутых событием |

MVP сразу использует backend persistence. `localStorage` допускается только для UI cache, настроек клиента и временного debug-состояния.

## 12. Real-time

Real-time нужен не для всего подряд, а для ограниченного набора данных.

| Поток | Транспорт |
|---|---|
| Nearby home map updates | Supabase Realtime (WebSocket) |
| Local events | Supabase Realtime (WebSocket) |
| Barter meeting updates | Supabase Realtime (WebSocket) |
| Top-100 rating | Polling |
| Own state updates | API response + periodic sync |

Дома игроков видны только в радиусе 1000 метров от текущего игрока. Позиции игроков не транслируются всем по умолчанию.

## 13. Geo validation и anti-cheat

Browser Geolocation API нельзя считать полностью доверенным источником.

Минимальные проверки:

1. Проверять скорость перемещения между действиями.
2. Проверять timestamp координат.
3. Проверять точность `accuracy`.
4. Ограничивать частоту сбора материалов.
5. Привязывать сбор к текущей `hexCellId`.
6. Логировать подозрительные перемещения.

```ts
interface GeoProof {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAt: string;
}
```

Полной защиты от fake GPS в браузере нет. Архитектура должна снижать выгоду от подмены, а не обещать абсолютную защиту.

## 14. Основные сценарии

### 14.1 Claim home

```mermaid
sequenceDiagram
  participant C as Client
  participant API as Game API
  participant GEO as Hex Service
  participant DB as Database

  C->>API: claimHome(geoProof)
  API->>GEO: resolveHexCell(lat, lng)
  GEO-->>API: hexCellId
  API->>DB: check home by hexCellId
  DB-->>API: free
  API->>DB: create LaboratoryHome
  API-->>C: home claimed
```

### 14.2 Collect material

```mermaid
sequenceDiagram
  participant C as Client
  participant API as Game API
  participant BIO as Biome Service
  participant MAT as Material Service
  participant DB as Database

  C->>API: collectMaterial(geoProof)
  API->>BIO: getBiomeByPosition(geoProof)
  BIO-->>API: biome
  API->>MAT: getOrGenerateMaterial(biome, hexCell)
  MAT->>DB: find material by generation key
  DB-->>MAT: not found or existing
  MAT->>DB: create material if missing
  API->>DB: add to inventory
  API-->>C: material stack + known info
```

### 14.3 Craft medicine and test on rat

```mermaid
sequenceDiagram
  participant C as Client
  participant API as Game API
  participant MED as Medicine Service
  participant LAB as Lab Service
  participant DB as Database

  C->>API: craftMedicine(materialIds)
  API->>MED: validate inputs and calculate result
  MED->>DB: remove materials + create medicine
  API-->>C: unknown medicine
  C->>API: testMedicineOnRat(medicineId, ratId)
  API->>LAB: apply medicine effects to rat
  LAB->>DB: save experiment and revealed effects
  API-->>C: test result + revealed effects
```

### 14.4 Physical barter meeting

```mermaid
sequenceDiagram
  participant A as Player A Client
  participant B as Player B Client
  participant API as Game API
  participant GEO as Hex Service
  participant DB as Database

  A->>API: createBarterIntent(offeredItems, requestedItems)
  API->>GEO: pick random hex within 500m
  GEO-->>API: barterHexCellId
  API->>DB: create BarterMeeting
  API-->>A: meeting location
  B->>API: joinBarterMeeting(meetingId)
  A->>API: confirmPresence(geoProof)
  B->>API: confirmPresence(geoProof)
  API->>DB: verify both players in barterHexCellId
  API->>DB: atomic item exchange
  API-->>A: barter completed
  API-->>B: barter completed
```

Правило обмена: оба игрока должны физически присутствовать в назначенной случайной hex-ячейке в радиусе 500 метров от инициатора или согласованной точки встречи.

## 15. API boundary

Предварительные API endpoints:

| Method | Endpoint | Назначение |
|---|---|---|
| `POST` | `/api/auth/session` | Создать или обновить игровую сессию |
| `POST` | `/api/geo/resolve-hex` | Получить hex по координатам |
| `POST` | `/api/home/claim` | Занять дом-лабораторию |
| `GET` | `/api/map/layers` | Получить игровые слои карты |
| `POST` | `/api/materials/collect` | Собрать материал |
| `POST` | `/api/admin/biomes` | Создать биом на выделенных блоках (админ, по паролю) |
| `GET` | `/api/inventory` | Получить инвентарь |
| `POST` | `/api/medicine/craft` | Создать лекарство |
| `POST` | `/api/lab/test-rat` | Проверить лекарство на крысе |
| `POST` | `/api/medicine/apply` | Применить лекарство к игроку |
| `GET` | `/api/events/active` | Активные события |
| `POST` | `/api/barter/meetings` | Создать физическую barter-встречу |
| `GET` | `/api/barter/meetings/nearby` | Найти barter-встречи рядом |
| `POST` | `/api/barter/meetings/:id/join` | Присоединиться к barter-встрече |
| `POST` | `/api/barter/meetings/:id/confirm-presence` | Подтвердить присутствие в hex-ячейке |
| `POST` | `/api/barter/meetings/:id/complete` | Завершить обмен |
| `GET` | `/api/rating/top100` | Рейтинг выживания |

## 16. MVP architecture

Первый MVP делается сразу с backend.

Минимальный состав:

1. Web client с картой мира.
2. Backend API для всех игровых действий.
3. Geo-index сервис на готовой библиотеке типа `H3`.
4. БД для игроков, домов, материалов, лекарств, крыс, экспериментов и survival-run.
5. Debug-click режим для разработки.
6. Production GPS режим для настоящего прогресса.

Client-only логика допустима только как preview UI. Источник истины с первого MVP — backend.

## 17. Текущие расхождения с кодом

| Текущий код | Нужно изменить |
|---|---|
| `HomeSystem.radius = 100` | Дом должен быть hex-ячейкой 50 м |
| `CraftingSystem.craft(item1, item2)` | Лекарство создается из 3+ материалов |
| `BiomeGenerator.generateBiomes(...)` | Заменено админ-разбросом биомов (7–7777 ячеек) по участку |
| `Player.inventory: any[]` | Нужны отдельные stacks для материалов и лекарств |
| `MapScene` без реальной Leaflet-карты | Нужно добавить карту, слои и геопозицию |
| Нет backend boundary | Нужно отделить client preview от server-confirmed actions |

## 18. Оставшиеся уточняющие вопросы

Все инженерные вопросы, зафиксированные в этом разделе, решены и перенесены в таблицу принятых решений (раздел 3): backend-стек, БД, geo-index библиотека, авторизация, real-time transport, судьба прогресса после смерти и глубина раскрытия эффектов на тесте крысы.

Вопросы баланса и экономики (перенос дома, обнуление домов, крысы, barter meeting, fake GPS, раскрытие свойств материалов, патент на лекарства) отслеживаются в едином списке в `docs/TZ.md` (раздел 21), чтобы не расходиться между двумя документами. На момент последнего обновления все вопросы в обоих документах закрыты.
