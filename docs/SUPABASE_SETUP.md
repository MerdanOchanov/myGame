# Supabase + Vercel: чек-лист подключения

Клиент сам выбирает бекенд: если заданы `VITE_SUPABASE_URL` и
`VITE_SUPABASE_ANON_KEY` — используется реальный Supabase (Edge Function
`game-api`), иначе — in-memory mock (демо-режим без persistence).

## 1. Применить SQL-схему

Supabase Dashboard → SQL Editor → New query → выполнить по порядку:

1. `supabase/migrations/0001_init.sql` (если ещё не применяли);
2. `supabase/migrations/0002_blocks_and_admin_biomes.sql` — блоки по 7 ячеек
   и админ-биомы. **Стирает** старые дома/биомы/материалы/инвентари
   (аккаунты и крысы остаются);
3. `supabase/migrations/0003_collect_interval.sql` — пер-биомный интервал
   сбора, управляемый админом.

Клиенты read-only; пишет только Edge Function через service role.

## 1a. Задать админ-пароль

Генерация биомов защищена секретом функции:

```bash
npx supabase secrets set ADMIN_PASSWORD="ваш-пароль" --project-ref fendgykbgztoscurruoy
```

(нужен тот же personal access token, что и для деплоя функции; или
Dashboard → Edge Functions → Secrets). Этот же пароль вводится в игре
в панели 🛠️.

## 2. Включить анонимный вход

Dashboard → Authentication → Settings (Sign In / Up) →
включить **Allow anonymous sign-ins**.

## 3. Задеплоить Edge Function

Нужен personal access token: Dashboard → Account (аватар) → Access Tokens →
Generate new token (`sbp_...`). Затем из корня репозитория:

```bash
# PowerShell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
npx supabase functions deploy game-api --project-ref fendgykbgztoscurruoy
```

Токен после деплоя можно сразу отозвать (Revoke) — он нужен только CLI
в момент деплоя. Секреты `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
`SUPABASE_ANON_KEY` в функцию подставляются платформой автоматически.

## 4. Env-переменные

Локально: скопировать `.env.example` в `.env.local` и заполнить
(URL проекта и anon key из Dashboard → Settings → API).
`.env.local` в `.gitignore` и в репозиторий не попадает.

Vercel: Project → Settings → Environment Variables → добавить
`VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (Production + Preview) →
Deployments → Redeploy.

## 5. Проверка

1. Открыть сайт → в консоли не должно быть ошибок бутстрапа
   (ошибка «Anonymous sign-ins are disabled» означает пропущенный шаг 2).
2. Пройти MVP-цикл в debug-режиме: claim home → собрать 3 материала →
   craft → тест на крысе → применить лекарство.
3. Обновить страницу — прогресс должен сохраниться (в отличие от mock).
4. Dashboard → Table Editor: в `players`, `homes`, `materials`,
   `medicines` появились строки.

## Безопасность

- `anon` key в клиенте — норма: RLS даёт клиентам только чтение своих
  и мировых данных, все записи идут через `game-api` (service role).
- `service_role` key никогда не публиковать и не коммитить. Если он
  засветился — Dashboard → Settings → API → Rotate JWT secret (после
  ротации обновить anon key в `.env.local` и Vercel).
