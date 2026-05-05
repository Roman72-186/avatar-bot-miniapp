# AI-визуализация недвижимости — Telegram Mini App

Telegram Mini App для риэлторов: пользователь загружает фотографии квартиры, выбирает тип помещения и стиль ремонта, пополняет единый баланс кредитов через Telegram Stars, получает AI-фото, видео объекта и текст объявления.

Рабочее имя репозитория оставлено `avatar-bot-miniapp`, чтобы не ломать deploy-пути и существующие workflow.

## Стек

- React 18 + Vite frontend
- Telegram Web App SDK
- n8n webhooks как backend/orchestration слой
- PostgreSQL 16
- S3-compatible storage
- Telegram Stars
- Т-Банк пока отключен из рабочего процесса; подготовленные specs можно вернуть позже

## Основные режимы

| Режим | Результат | Стоимость |
|---|---|---:|
| AI-ремонт | 1 фото с визуализацией ремонта и мебели | 20 кредитов |
| Улучшить фото | свет, резкость, цвет без изменения объекта | 8 кредитов |
| Видео объекта | вертикальный ролик из 3-10 фото | 150 кредитов |
| Текст объявления | локальный черновик для Авито/Циан/Домклик/Telegram | 0 кредитов |
| Полный пакет | видео + текст объявления через рабочий video workflow | 155 кредитов |

Старые avatar/art/video режимы не удалены из кода, но скрыты из пользовательского UI.

## Быстрый старт

```bash
npm install
npm run dev
```

`.env`:

```env
VITE_API_BASE=https://YOUR_N8N_DOMAIN/webhook
VITE_BOT_USERNAME=your_bot_name_bot
```

## Deploy

Deploy-пакет находится в `avatar-bot-deploy/`.

Для VPS:

```bash
cd avatar-bot-deploy
cp config.env.example config.env
# заполнить DOMAIN, BOT_TOKEN, S3
sudo ./install.sh
```

Новые SQL-миграции:

- `avatar-bot-deploy/db/04_real_estate_payments.sql`

Новые n8n specs/templates:

- `docs/N8N_REAL_ESTATE_WORKFLOWS.md`
- `docs/WORKING_MVP_PROCESS.md` — текущий рабочий процесс: frontend ходит в существующие endpoints `generate`, `generate-enhance`, `generate-video`, `create-invoice`.

## Проверка

```bash
npm run build
cd avatar-bot-deploy/frontend
npm run build
```

В Mini App проверить выбор режима, загрузку 1/3-10 фото, историю, текст объявления, Telegram Stars и запуск генераций через существующие n8n endpoints.
