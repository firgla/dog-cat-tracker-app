# NoraCare

Telegram Web App для учета питомцев, истории процедур и напоминаний, собранный как единый `Next.js + TypeScript` проект под Vercel.

## Что внутри

- Web App интерфейс с карточками питомцев, историей ухода и onboarding по уведомлениям
- backend API на route handlers
- Telegram auth через `initData`
- webhook Telegram-бота с `/start` и кнопкой открытия Web App
- daily cron endpoint для рассылки напоминаний на Vercel Hobby
- PostgreSQL схема на `Drizzle ORM`
- загрузка фотографий в `Vercel Blob`

## Основные маршруты

- `POST /api/auth/telegram`
- `GET/PATCH /api/me`
- `GET/POST /api/pets`
- `GET/PATCH/DELETE /api/pets/:id`
- `POST /api/pets/:id/photo`
- `GET /api/pets/:id/care`
- `PATCH /api/pets/:id/care/:type`
- `POST /api/pets/:id/care/:type/history`
- `DELETE /api/pets/:id/care/:type/history/:recordId`
- `POST /api/telegram/webhook`
- `GET /api/cron/reminders`

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

- `DATABASE_URL` — PostgreSQL
- `TELEGRAM_BOT_TOKEN` — токен бота
- `APP_URL` — публичный URL приложения
- `CRON_SECRET` — bearer-secret для cron endpoint
- `BLOB_READ_WRITE_TOKEN` — токен Vercel Blob
- `SESSION_TTL_DAYS` — срок жизни cookie-сессии
- `DEV_TELEGRAM_USER_JSON` — dev fallback для локального запуска вне Telegram

Для Preview/Production на Vercel эти же переменные нужно добавить в настройках проекта или подтянуть локально через `vercel env pull`.

## Деплой в Vercel

Если `vercel build` или `vercel deploy` падает с ошибкой `project_settings_required`, это значит, что локальная папка еще не связана с проектом Vercel и отсутствует `.vercel/project.json`.

Минимальная последовательность:

```bash
vercel link
vercel pull --environment=preview
vercel env pull .env.local
vercel build
vercel deploy
```

Что проверить перед деплоем:

- Репозиторий импортирован в Vercel как отдельный проект.
- В проекте Vercel заведены `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`.
- `APP_URL` указывает на фактический домен деплоя Vercel.
- Cron из [vercel.json](/Users/glafira.fironova/Documents/dog-cat-tracker-app/vercel.json) требует валидный `CRON_SECRET` для ручных вызовов эндпоинта.

## Локальный запуск

```bash
npm install
npm run dev
```

Открыть: [http://localhost:3000](http://localhost:3000)

## Проверка

```bash
npm run lint
npx tsc --noEmit
npm run build
vercel build
```

## База данных

- Drizzle schema: [src/lib/schema.ts](/Users/ivan/PycharmProjects/dog-cat-tracker-app/src/lib/schema.ts)
- SQL migration: [src/db/migrations/0000_noracare_init.sql](/Users/ivan/PycharmProjects/dog-cat-tracker-app/src/db/migrations/0000_noracare_init.sql)
- generate config: [drizzle.config.ts](/Users/ivan/PycharmProjects/dog-cat-tracker-app/drizzle.config.ts)

## Примечания

- Для локальной разработки без Telegram auth endpoint использует `DEV_TELEGRAM_USER_JSON`, если приложение запущено не в production и `initData` отсутствует.
- На Vercel Hobby cron ограничен запуском один раз в день, поэтому напоминания отправляются daily batch по локальной дате пользователя, а не в точный локальный час.
- Исходный HTML-прототип сохранен в [docs/legacy-prototype.html](/Users/ivan/PycharmProjects/dog-cat-tracker-app/docs/legacy-prototype.html).
