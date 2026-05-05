# Полное описание проекта Avatar Bot Mini App

Дата подготовки: 2026-05-05

## 1. Назначение проекта

`avatar-bot-miniapp` - это Telegram Mini App для генерации AI-изображений, аватарок, видео и связанных медиа-результатов прямо внутри Telegram. Пользователь открывает мини-приложение из Telegram-бота, загружает фото или вводит промпт, выбирает режим генерации, оплачивает генерацию Telegram Stars или использует доступный бесплатный лимит, а результат получает в интерфейсе приложения или в личном сообщении от бота.

Проект состоит из двух крупных частей:

- клиентское React/Vite mini app в корне репозитория;
- deploy-пакет `avatar-bot-deploy` для VPS, где описаны PostgreSQL, n8n workflow, S3 upload service, Nginx и копия frontend-исходников для самостоятельного развёртывания.

## 2. Основные возможности продукта

- AI-стилизация пользовательского фото.
- Генерация по нескольким фото и текстовому промпту.
- Перенос стиля по референсу.
- Анимация фото в видео.
- Lip Sync: фото говорит загруженным аудио.
- Удаление фона.
- Генерация изображения по текстовому описанию.
- История генераций пользователя.
- Пополнение баланса Telegram Stars.
- Бесплатные дневные лимиты для части режимов.
- Реферальная программа до 5 уровней.
- Скрытая админ-панель для статистики, начисления Stars, блокировки пользователей и рассылок.
- Turnkey-развёртывание на VPS через Docker Compose, Nginx, n8n, PostgreSQL и S3-compatible storage.

## 3. Технологический стек

Frontend:

- React 18.
- Vite 6.
- Telegram Web App SDK, локально подключённый через `public/telegram-web-app.js`.
- CSS без отдельного UI-фреймворка.
- Browser APIs: `FileReader`, `canvas`, `localStorage`, `navigator.share`, `navigator.clipboard`.

Backend и инфраструктура:

- n8n как backend/orchestration слой через webhook endpoints.
- PostgreSQL 16 для пользователей, генераций, платежей, рефералов, рассылок и мониторинга.
- Node.js/Express микросервис `s3-upload-service` для загрузки файлов в S3-compatible storage.
- Docker Compose для PostgreSQL и n8n.
- Nginx как HTTPS reverse proxy и статическая раздача frontend.
- Let's Encrypt SSL через install script.
- Telegram Bot API и Telegram Stars.
- S3-compatible хранилище, например Timeweb S3, AWS S3 или аналог.

AI-провайдеры и конкретные модели в основном инкапсулированы в n8n workflow. Frontend отправляет входные данные и параметры режима, но не содержит ключей провайдеров.

## 4. Структура репозитория

Ключевые файлы и директории:

```text
avatar-bot-miniapp/
├── src/                         # Основное React Mini App
│   ├── App.jsx                  # Главный экран, состояние, маршрутизация экранов, генерация
│   ├── main.jsx                 # Точка входа React
│   ├── styles.css               # Основные стили приложения
│   ├── components/              # UI-компоненты режимов, истории, админки и результата
│   ├── hooks/useTelegram.js     # Интеграция Telegram Web App API
│   └── utils/                   # API-клиент, режимы, стили, локальный кэш
├── public/telegram-web-app.js   # Telegram Web App SDK
├── docs/                        # Документация проекта
├── avatar-bot-deploy/           # Turnkey deploy-пакет для VPS
├── package.json                 # Скрипты и зависимости frontend
├── vite.config.js               # Конфигурация Vite
├── vercel.json                  # Vercel build, SPA rewrite, CSP headers
├── .env.example                 # Шаблон переменных frontend
└── README.md                    # Базовый quick start
```

В `avatar-bot-deploy/frontend` лежит копия frontend-исходников для сценария, где весь проект обслуживается с одного VPS. При изменениях frontend важно синхронизировать корневой `src` и deploy-копию, если используется VPS-пакет.

## 5. Frontend-архитектура

Главный компонент `src/App.jsx` управляет:

- инициализацией Telegram Web App;
- получением `userId`, `username`, `initData` и `start_param`;
- загрузкой статуса пользователя;
- состояниями экранов `main`, `loading`, `result`, `sent`, `error`, `history`, `referral`;
- выбором режима генерации;
- выбором фото, аудио, промпта, стиля, длительности и качества;
- проверкой бесплатных лимитов и баланса Stars;
- запуском нужной API-функции;
- обработкой ошибок;
- открытием оплаты Telegram Stars;
- показом истории, рефералки и админ-панели.

Компоненты в `src/components` разделены по задачам:

- `ModeSelector.jsx` - выбор режима.
- `PhotoUpload.jsx` - загрузка одного фото.
- `MultiPhotoUpload.jsx` - загрузка 2-4 фото.
- `StyleTransferUpload.jsx` - основное фото + референсы.
- `PromptInput.jsx` - ввод текстового промпта.
- `StyleSelector.jsx` - выбор художественного стиля для стилизации.
- `DurationSelector.jsx` - параметры видео.
- `ResolutionSelector.jsx` - разрешение для style transfer.
- `ThemeSelector.jsx` - темы фотосессии.
- `CostIndicator.jsx` - отображение стоимости и баланса.
- `GenerateButton.jsx` - запуск генерации.
- `LoadingScreen.jsx` - прогресс и сообщения ожидания.
- `ResultScreen.jsx` - показ результата и шаринг.
- `SentScreen.jsx` - экран, если результат отправлен в Telegram.
- `HistoryScreen.jsx` - история генераций.
- `ReferralScreen.jsx` - партнёрская программа.
- `AdminPanel.jsx` - административные действия.

## 6. Telegram-интеграция

Интеграция находится в `src/hooks/useTelegram.js`.

Используются возможности Telegram Web App:

- `ready()` и `expand()` при старте;
- чтение пользователя из `initDataUnsafe.user`;
- чтение `initData` для передачи backend на проверку;
- чтение `start_param` для реферальной ссылки вида `ref_<user_id>`;
- haptic feedback;
- `openInvoice()` для оплаты Telegram Stars;
- `openTelegramLink()` для шаринга и приглашений;
- fallback на браузерные API, если приложение открыто не в Telegram.

## 7. Режимы генерации

Активные режимы задаются в `src/utils/modes.js`.

| Режим | ID | Результат | Стоимость | Бесплатный лимит | Endpoint |
|---|---|---|---:|---|---|
| Стилизация | `stylize` | image | 8 Stars | `free_stylize` | `generate` |
| Мульти-фото | `multi_photo` | image | 10 Stars | нет | `generate-multi` |
| По референсу | `style_transfer` | image | 30-40 Stars | нет | `generate-style-transfer` |
| Фото в видео | `photo_to_video` | video | 155-620 Stars | нет | `generate-video` |
| Lip Sync | `lip_sync` | video | 250 Stars | нет | `generate-lip-sync` |
| Убрать фон | `remove_bg` | image | 3 Stars | `free_remove_bg` | `generate-remove-bg` |
| Текст в фото | `text_to_image` | image | 8 Stars | `free_text_to_image` | `generate-text-to-image` |

В коде также есть подготовленные API-функции, UI-ветки и n8n workflow для `enhance`, `photosession` и `generate-nanobanana`, но соответствующие режимы сейчас закомментированы в `MODES`. Это означает, что они не попадают в список выбора режима без включения в `src/utils/modes.js`.

## 8. Пользовательский сценарий генерации

Типовой поток:

1. Пользователь открывает Telegram Mini App.
2. `useTelegram` получает Telegram-контекст и `initData`.
3. Frontend вызывает `user-status`, передавая `user_id`, `username`, `init_data` и при наличии `referred_by`.
4. Backend возвращает баланс, бесплатные лимиты и признак блокировки.
5. Пользователь выбирает режим и вводит необходимые данные.
6. Frontend проверяет, хватает ли бесплатного лимита или Stars.
7. Для файлов frontend сжимает изображение через canvas и кодирует файл в base64.
8. Frontend вызывает соответствующий n8n webhook.
9. n8n проверяет пользователя, баланс и Telegram initData, запускает AI-провайдера, сохраняет результат и списывает Stars.
10. Если backend вернул `sent: true`, показывается экран отправки в Telegram.
11. Если backend вернул `image_url` или `video_url`, результат показывается в приложении и сохраняется в локальную историю.
12. Frontend повторно загружает `user-status`, чтобы обновить баланс и лимиты.

## 9. API-клиент frontend

Основной API-клиент находится в `src/utils/api.js`.

Особенности:

- `API_BASE` берётся из `VITE_API_BASE`; fallback в коде указывает на production webhook host.
- Все основные запросы отправляются методом `POST`.
- `apiRequest()` добавляет JSON-body, таймаут через `AbortController`, обработку HTTP-ошибок и понятные сообщения для пользователя.
- Для некоторых запросов включены retries, но для генераций обычно используется `maxRetries = 0`, чтобы не запустить повторную платную генерацию.
- Перед отправкой фото сжимаются функцией `compressImage()`.
- Файлы преобразуются в base64 через `FileReader`.
- Исторически есть функции загрузки в S3, но текущий комментарий в коде фиксирует подход: большинство режимов отправляют base64 напрямую в n8n, а backend уже занимается загрузкой в S3.

Главные экспортируемые функции:

- `getUserStatus`
- `createInvoice`
- `generateAvatar`
- `generateMultiPhoto`
- `generateStyleTransfer`
- `generateVideo`
- `generateLipSync`
- `generateRemoveBg`
- `generateEnhance`
- `generateTextToImage`
- `generatePhotosession`
- `getUserGenerations`
- `deleteUserGeneration`
- `getPaymentHistory`
- `getReferralStats`
- `validateAdminPassword`
- `getAdminStats`
- `addStarsByUsername`
- `blockUser`
- `deleteUser`
- `broadcastPreview`
- `getBroadcastHistory`
- `broadcastSend`

## 10. Локальный кэш и история

Локальное хранение реализовано в `src/utils/generationCache.js`.

Хранится до 20 последних генераций в `localStorage` по ключу `avatar_generations`. TTL - 24 часа. Кэш используется как быстрый клиентский слой для истории результатов, а полноценная серверная история доступна через `user-generations`.

Также в `localStorage` кэшируются:

- `userStatus_freeGens`;
- `userStatus_starBalance`.

Это позволяет быстрее показать пользователю последние известные лимиты и баланс при следующем открытии.

## 11. Платежи и Telegram Stars

Оплата устроена через Telegram invoice flow:

1. Пользователь выбирает пакет пополнения.
2. Frontend вызывает `create-invoice`.
3. Backend возвращает `invoice_link`.
4. Frontend открывает ссылку через `tg.openInvoice`.
5. При статусе `paid` приложение обновляет `user-status`.

Пакеты пополнения в `App.jsx`:

| Оплата | Бонус | На баланс |
|---:|---:|---:|
| 10 Stars | 0 | 10 |
| 25 Stars | 5 | 30 |
| 50 Stars | 15 | 65 |
| 100 Stars | 50 | 150 |

История пополнений загружается через `payment-history`.

## 12. Реферальная система

Реферальная система описана в `docs/referral-system.md` и реализована на уровне БД в `avatar-bot-deploy/db/02_referral.sql`.

Модель:

- пользователь приглашает другого пользователя ссылкой `https://t.me/<bot>?start=ref_<user_id>`;
- связь фиксируется при первом входе через `start_param`;
- цепочка хранится в полях `parent_l1` ... `parent_l5`;
- начисления идут только от реальных платных списаний Stars;
- бесплатные генерации не дают комиссию.

Ставки:

| Уровень | Комиссия |
|---|---:|
| L1 | 7% |
| L2 | 3% |
| L3 | 2% |
| L4 | 1% |
| L5 | 0.5% |

Функция `apply_referral_commission(p_user_id, p_stars_spent, p_mode)` начисляет Stars родителям, обновляет `star_balance` и `ref_earnings`, а также пишет лог в `referral_commissions`.

## 13. Админ-панель

Админ-панель открывается скрытым способом: три нажатия на текст `AI` в шапке приложения, затем ввод пароля. Пароль проверяется через endpoint `admin-stats`.

Доступные административные операции в frontend API:

- просмотр статистики;
- начисление Stars по username или user_id;
- блокировка и разблокировка пользователя;
- удаление пользователя;
- предпросмотр аудитории рассылки;
- отправка или планирование рассылки;
- просмотр истории рассылок.

В БД для рассылок есть таблица `broadcasts`, а в n8n manifest присутствуют workflow для preview, отправки, истории и scheduler.

## 14. Backend через n8n

`avatar-bot-deploy/workflows/manifest.json` описывает набор workflow-шаблонов и порядок импорта/активации.

Основные группы workflow:

- генерация: `generate`, `generate-multi`, `generate-style-transfer`, `generate-video`, `generate-lip-sync`, `generate-remove-bg`, `generate-enhance`, `generate-text-to-image`, `generate-photosession`;
- загрузка файлов: `s3-upload`;
- пользовательские данные: `user-status`, `user-generations`, `delete-generation`;
- платежи: `create-invoice`, `payment-history`;
- рефералы: `referral-stats`;
- админка: `admin-stats`, `add-stars`, `block-user`, `delete-user`;
- рассылки: `admin-broadcast-preview`, `admin-broadcast`, `admin-broadcast-history`, `broadcast-scheduler`;
- Telegram bot start handler: `bot-start-handler`.

Всего в manifest перечислено 25 workflow-шаблонов.

## 15. База данных

Схема БД находится в `avatar-bot-deploy/db`.

`01_schema.sql` создаёт:

- `users` - Telegram-пользователи, баланс, бесплатные лимиты, блокировка, админский флаг, referral chain;
- `generations` - история генераций, режим, промпт, URL результата, тип результата, списанные Stars;
- `payments` - платежи Telegram Stars, бонусы и итоговое зачисление;
- `user_topics` - темы пользователя, например для фотосессий;
- `broadcasts` - запланированные и выполненные рассылки;
- функцию `reset_daily_free_generations()`;
- trigger для обновления `users.updated_at`.

`02_referral.sql` создаёт:

- `referral_commissions`;
- функцию `apply_referral_commission()`.

`03_monitoring.sql` создаёт:

- `error_logs` - журнал ошибок;
- `request_rate_log` - лог rate limiting;
- `health_checks` - результаты health checks;
- summary views `v_error_summary_last_hour` и `v_error_summary_today`.

## 16. S3 upload service

Микросервис находится в `avatar-bot-deploy/s3-upload-service`.

Он написан на Express и AWS SDK v3:

- проверяет обязательные env-переменные S3;
- принимает JSON до 50 MB;
- имеет `GET /health`;
- имеет `POST /upload-photo`;
- принимает `photo_base64`, `mime_type`, `file_name`;
- очищает data URL prefix, если он есть;
- загружает файл в S3 с `ACL: public-read`;
- возвращает массив вида `[{ "file_url": "..." }]`, совместимый с frontend/n8n ожиданиями.

Сервис управляется через PM2 по `ecosystem.config.js`.

## 17. Deploy-архитектура

`avatar-bot-deploy` рассчитан на VPS Ubuntu 22.04+.

Состав deployment:

- PostgreSQL 16 в Docker.
- n8n в Docker.
- S3 upload service как Node.js/PM2 процесс.
- Nginx для HTTPS, reverse proxy и раздачи React SPA.
- Certbot/Let's Encrypt для SSL.
- Статический frontend в `/var/www/avatar-bot`.

Маршрутизация Nginx:

- `/webhook/*` -> n8n production webhooks;
- `/webhook-test/*` -> n8n test webhooks;
- `/n8n/*` -> n8n editor;
- `/s3-upload/*` -> S3 upload service;
- `/` -> React SPA.

Docker Compose поднимает:

- `avatar-bot-postgres`;
- `avatar-bot-n8n`;
- volume `postgres_data`;
- volume `n8n_data`.

## 18. Конфигурация

Frontend:

- `.env.example` содержит `VITE_API_BASE=https://YOUR_N8N_DOMAIN/webhook`.
- Для локальной разработки используется `.env.development`.
- Для Vercel переменные задаются через Environment Variables.

Deploy:

- `avatar-bot-deploy/config.env.example` содержит шаблон для домена, Telegram-бота, S3, timezone, admin/n8n параметров.
- Реальный `config.env`, `.env.local` и другие файлы с секретами не должны попадать в документацию и публичные коммиты.

Важные переменные:

- `DOMAIN`
- `ADMIN_EMAIL`
- `BOT_TOKEN`
- `BOT_USERNAME`
- `MINIAPP_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `S3_ENDPOINT`
- `S3_REGION`
- `ADMIN_PASSWORD`
- `POSTGRES_PASSWORD`
- `N8N_ENCRYPTION_KEY`
- `N8N_API_URL`
- `N8N_API_KEY`

## 19. Разработка

Локальный запуск frontend:

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Переключение backend окружения контролируется `VITE_API_BASE`.

В `docs/DEV-WORKFLOW.md` описана модель:

- production ветка работает с production webhook;
- preview/local окружения могут работать с `/webhook/dev`;
- n8n workflow для разработки должны иметь DEV-копии;
- после merge в `main` изменения n8n нужно вручную перенести из DEV workflow в production workflow.

## 20. Безопасность

В проекте предусмотрены следующие меры:

- Telegram `initData` передаётся backend для проверки подлинности пользователя.
- CSP headers заданы в `vercel.json` и Nginx template.
- Секреты вынесены в env-файлы и шаблоны.
- S3 credentials используются только на backend/микросервисе.
- Для генераций отключены автоматические retries там, где повтор может привести к повторному списанию или дублю результата.
- Пользователи могут быть заблокированы через админ-панель.
- Monitoring schema хранит ошибки и health checks.

Риски, которые стоит контролировать:

- `API_BASE` fallback в frontend указывает на конкретный production host; для переносимости лучше всегда задавать `VITE_API_BASE`.
- В `src/utils/modes.js` часть режимов закомментирована, хотя workflow и API-функции существуют. Это нужно учитывать при планировании релизов.
- Корневой frontend и `avatar-bot-deploy/frontend` являются двумя копиями; возможны расхождения при ручных изменениях.
- В README часть сведений выглядит устаревшей относительно текущего кода и deploy-пакета.
- Необходимо следить, чтобы реальные `.env.local`, `config.env` и workflow exports не содержали секретов.

## 21. Текущее состояние по коду

На момент изучения проекта:

- приложение является рабочим React/Vite Telegram Mini App;
- активные режимы генерации управляются через `MODES`;
- frontend поддерживает оплату, историю, рефералку и админку;
- deploy-пакет содержит schema, workflow manifest, Nginx template, Docker Compose и S3 service;
- БД рассчитана на пользователей, генерации, платежи, партнёрские начисления, рассылки и мониторинг;
- документация уже частично есть, но этот файл даёт единое обзорное описание всей системы.
