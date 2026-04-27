# NoraCare

Telegram Web App для учета питомцев, истории процедур и напоминаний, собранный как единый `Next.js + TypeScript` проект под Vercel.

## Что внутри

- Web App интерфейс с карточками питомцев, историей ухода и onboarding по уведомлениям
- backend API на route handlers
- Telegram auth через `initData`
- webhook Telegram-бота с `/start` и кнопкой открытия Web App
- hourly cron endpoint для рассылки напоминаний
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
```

## База данных

- Drizzle schema: [src/lib/schema.ts](/Users/ivan/PycharmProjects/dog-cat-tracker-app/src/lib/schema.ts)
- SQL migration: [src/db/migrations/0000_noracare_init.sql](/Users/ivan/PycharmProjects/dog-cat-tracker-app/src/db/migrations/0000_noracare_init.sql)
- generate config: [drizzle.config.ts](/Users/ivan/PycharmProjects/dog-cat-tracker-app/drizzle.config.ts)

## Примечания

- Для локальной разработки без Telegram auth endpoint использует `DEV_TELEGRAM_USER_JSON`, если приложение запущено не в production и `initData` отсутствует.
- Исходный HTML-прототип сохранен в [docs/legacy-prototype.html](/Users/ivan/PycharmProjects/dog-cat-tracker-app/docs/legacy-prototype.html).
