# Инструкция для GPT / Codex по переделке Avatar Bot Mini App в AI-сервис для риэлторов

Дата: 2026-05-05

## 0. Назначение документа

Этот документ нужно передать GPT/Codex/Claude Code/KiloCode как основное техническое задание. Цель - не переписать проект с нуля, а аккуратно переделать существующий `avatar-bot-miniapp` в специализированный Telegram Mini App для риэлторов и агентов недвижимости.

Итоговый продукт: сервис, где риэлтор загружает фотографии квартиры, выбирает стиль ремонта/меблировки, оплачивает заказ через Telegram Stars или Т-Банк, а затем получает AI-фото, видео объекта и текст объявления.

Главное правило: использовать текущую архитектуру проекта, текущий frontend, n8n, PostgreSQL, S3, историю генераций, оплату Stars, админку и реферальную систему. Не ломать существующий рабочий функционал без необходимости.

---

## 1. Краткое описание текущего проекта

Существующий проект `avatar-bot-miniapp` - Telegram Mini App на React/Vite для AI-генерации изображений, аватарок, видео и медиа внутри Telegram. В проекте уже есть:

- React 18 + Vite 6 frontend;
- Telegram Web App SDK;
- n8n как backend/orchestration слой;
- PostgreSQL 16;
- S3-compatible storage;
- Node.js/Express S3 upload service;
- Telegram Bot API;
- Telegram Stars;
- история генераций;
- реферальная система до 5 уровней;
- скрытая админ-панель;
- deploy-пакет под VPS: Docker Compose, Nginx, PostgreSQL, n8n, S3 upload service.

Ключевые файлы и директории:

```text
avatar-bot-miniapp/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── styles.css
│   ├── components/
│   ├── hooks/useTelegram.js
│   └── utils/
├── public/telegram-web-app.js
├── docs/
├── avatar-bot-deploy/
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
└── README.md
```

Ключевые frontend-файлы:

- `src/App.jsx` - главный сценарий, экраны, состояние пользователя, оплата, генерация;
- `src/utils/modes.js` - активные режимы генерации;
- `src/utils/api.js` - API-клиент frontend;
- `src/hooks/useTelegram.js` - Telegram Web App интеграция;
- `src/components/*` - компоненты интерфейса.

Ключевые deploy/n8n/DB-файлы:

- `avatar-bot-deploy/workflows/manifest.json`;
- `avatar-bot-deploy/db/01_schema.sql`;
- `avatar-bot-deploy/db/02_referral.sql`;
- `avatar-bot-deploy/db/03_monitoring.sql`;
- `avatar-bot-deploy/s3-upload-service/*`;
- `avatar-bot-deploy/docker-compose.yml`;
- Nginx template и install scripts.

---

## 2. Новое позиционирование продукта

Старое позиционирование:

> AI-генератор аватарок, фото, видео и медиа.

Новое позиционирование:

> AI-сервис для риэлторов, который превращает обычные фотографии квартиры в продающие изображения, видео и текст объявления.

Главная клиентская боль:

- плохие фото квартир снижают кликабельность объявлений;
- пустые или старые квартиры выглядят хуже, чем могли бы;
- риэлтору нужно быстро показать потенциал объекта;
- нужно получить красивый визуал без дизайнера, фотографа и монтажера.

Основной оффер:

> Загрузите фото квартиры - получите продающие AI-фото с ремонтом и мебелью, видео объекта и готовый текст объявления.

---

## 3. Что сохранить без удаления

Не удалять и по возможности переиспользовать:

1. Telegram Mini App инфраструктуру.
2. Telegram user detection через `initDataUnsafe.user`.
3. Проверку Telegram `initData` на backend.
4. Пользовательский баланс `star_balance`.
5. Текущую оплату Telegram Stars.
6. Историю генераций.
7. PostgreSQL schema как основу.
8. Таблицы пользователей, платежей, генераций, рефералов.
9. Реферальную систему.
10. Админ-панель.
11. S3 upload service.
12. n8n как orchestration layer.
13. Существующие workflow как основу для новых workflow.
14. Механизм `API_BASE` через `VITE_API_BASE`.
15. Логику отсутствия retries для платных генераций.

---

## 4. Что скрыть или отключить в UI

Нужно не удалять физически, а сначала скрыть из пользовательского UI, чтобы можно было вернуть позже:

- аватарки;
- anime/арт-стилизация для людей;
- Lip Sync;
- remove background как отдельный массовый режим;
- text-to-image в старом виде;
- фотосессии;
- универсальная стилизация, не связанная с недвижимостью.

Важно: если функции завязаны на БД или workflow, не ломать их. Просто не показывать в `MODES` и UI.

---

## 5. Новые режимы продукта

Вместо универсальных AI-режимов нужны режимы под недвижимость.

### 5.1. `real_estate_renovation`

Название в UI: `AI-ремонт квартиры`

Назначение:

- пользователь загружает фото комнаты;
- выбирает тип помещения;
- выбирает стиль ремонта;
- AI сохраняет геометрию комнаты, окна, двери, стены;
- AI добавляет ремонт, мебель, свет, порядок;
- результат - изображение.

Это главный режим.

### 5.2. `real_estate_enhance`

Название в UI: `Улучшить фото объекта`

Назначение:

- улучшить яркость, резкость, цвет, перспективу;
- не менять ремонт и мебель;
- убрать визуальный шум, но не искажать объект.

Это дешевый входной режим.

### 5.3. `real_estate_video`

Название в UI: `Видео объекта`

Назначение:

- пользователь загружает 3-10 фото;
- AI может сначала обработать фото;
- затем создается короткий вертикальный ролик;
- для MVP использовать FFmpeg zoom/pan/transitions, не дорогой full AI-video.

Результат - MP4.

### 5.4. `real_estate_listing_text`

Название в UI: `Текст объявления`

Назначение:

- сгенерировать продающий текст объявления для Авито/Циан/Домклик/Telegram;
- можно использовать данные от пользователя: город, район, комнатность, площадь, этаж, цена, преимущества.

Результат - текст.

### 5.5. `real_estate_full_package`

Название в UI: `Полный пакет`

Назначение:

- AI-фото;
- видео;
- текст объявления;
- юридическая/маркетинговая пометка о визуализации.

Это основной продающий тариф.

---

## 6. Новая UX-логика Mini App

### 6.1. Главный экран

Заменить общие тексты про AI-аватары на недвижимость.

Пример заголовка:

```text
AI-визуализация недвижимости
```

Пример подзаголовка:

```text
Загрузите фото квартиры и получите продающие изображения, видео и текст объявления.
```

Основная кнопка:

```text
Создать визуализацию
```

Дополнительные блоки:

- `AI-ремонт и мебель`;
- `Видео для объявления`;
- `Текст для Авито/Циан`;
- `История объектов`.

### 6.2. Выбор продукта

Вместо старого `ModeSelector` показать карточки:

1. AI-ремонт - фото с ремонтом и мебелью.
2. Улучшение фото - сделать фото светлее и профессиональнее.
3. Видео объекта - ролик из фото.
4. Полный пакет - фото + видео + текст.

### 6.3. Загрузка фото

Для `AI-ремонт`:

- 1 фото на генерацию;
- можно разрешить очередь из нескольких фото.

Для `Видео объекта` и `Полный пакет`:

- 3-10 фото;
- желательно показывать рекомендацию: кухня, гостиная, спальня, санузел, фасад/подъезд.

Текст в UI:

```text
Загрузите 3-10 фотографий квартиры. Лучше использовать светлые фото без сильного размытия.
```

### 6.4. Тип помещения

Добавить выбор:

- гостиная;
- кухня;
- спальня;
- детская;
- ванная;
- прихожая;
- студия;
- коммерческое помещение;
- определить автоматически.

Поле лучше сделать обязательным, кроме случая `определить автоматически`.

### 6.5. Стиль ремонта

Добавить пресеты:

1. Современный светлый.
2. Скандинавский.
3. Минимализм.
4. Премиум.
5. Для аренды.
6. Быстрый косметический ремонт.
7. Теплый семейный интерьер.
8. Нейтральный для продажи.

Каждый стиль должен соответствовать отдельной prompt-вставке.

### 6.6. Тариф / результат

Показать не просто стоимость режима, а тарифы:

| Тариф | Что входит | Рекомендуемая стоимость |
|---|---|---:|
| Фото | 1 AI-фото с ремонтом | 20 кредитов |
| Объект | до 5 фото + видео | 150 кредитов |
| Pro | до 10 фото + видео + текст | 250 кредитов |
| Агентство | пакет кредитов | отдельно |

Цены можно менять через `modes.js` или отдельный конфиг.

### 6.7. Выбор оплаты

Перед запуском платной генерации показать два варианта:

1. Оплатить Telegram Stars.
2. Оплатить картой/СБП через Т-Банк.

Важно: внутри приложения должен быть единый баланс кредитов. Пользователь может пополнить его любым способом, а генерации списываются из одного поля `star_balance` или нового поля `credit_balance`.

Рекомендуемое решение для минимальных изменений:

- оставить `users.star_balance` как единый баланс;
- в UI переименовать его в `кредиты`;
- Telegram Stars и Т-Банк пополняют одно и то же поле;
- в БД платежей хранить источник оплаты: `telegram_stars` или `tbank`.

---

## 7. Платежная логика: Telegram Stars + Т-Банк

### 7.1. Общая логика

В проекте должно быть два способа пополнения баланса:

1. Telegram Stars - существующая логика.
2. Т-Банк - новая логика оплаты рублями.

Курс:

```text
1 рубль = 1 кредит
```

Или в терминах текущей базы:

```text
1 рубль = 1 star_balance unit
```

Примеры:

- 100 ₽ -> +100 кредитов;
- 500 ₽ -> +500 кредитов;
- 1000 ₽ -> +1000 кредитов.

### 7.2. Важное продуктово-техническое правило

Генерация должна запускаться только после успешного пополнения баланса или если на балансе уже хватает кредитов.

Запрещено запускать дорогие AI-задачи до оплаты, кроме явно настроенного бесплатного лимита.

### 7.3. Как назвать баланс в UI

Не стоит в интерфейсе писать, что рубли превращаются в `Telegram Stars`, потому что Telegram Stars - отдельная внутренняя валюта Telegram. Лучше назвать общий баланс:

```text
Кредиты
```

Внутри кода можно временно использовать `star_balance`, чтобы не переделывать всю БД.

В UI:

```text
Ваш баланс: 350 кредитов
```

В админке можно оставить техническое поле `star_balance`, но подписать как `Кредиты/Stars balance`.

### 7.4. Пакеты пополнения

Рекомендуемые пакеты:

| Пакет | Цена через Т-Банк | Начисление |
|---|---:|---:|
| Start | 199 ₽ | 199 кредитов |
| Pro | 499 ₽ | 499 кредитов |
| Business | 990 ₽ | 990 кредитов |
| Agency | 2990 ₽ | 2990 кредитов |

Telegram Stars можно оставить существующими пакетами или привести к тем же пакетам.

---

## 8. Т-Банк: что реализовать

### 8.1. Важные официальные особенности

Для интернет-эквайринга Т-Банка используются:

- создание платежа через API `Init`;
- ссылка на платежную форму банка;
- уведомления об операциях через HTTP(S) callback/webhook;
- проверка статуса платежа через `GetState`;
- подпись `Token` для запросов и уведомлений.

Codex должен проверить актуальную официальную документацию Т-Банка перед реализацией. Не использовать случайные старые примеры из интернета без сверки.

Официальные разделы для проверки:

- T-Bank Dev Portal - Интернет-эквайринг API;
- метод `/v2/Init`;
- метод `/v2/GetState`;
- раздел `Уведомления об операциях`;
- правила формирования `Token`.

### 8.2. Новые env-переменные

Добавить в backend/n8n/deploy config:

```env
TBANK_TERMINAL_KEY=
TBANK_PASSWORD=
TBANK_API_BASE=https://securepay.tinkoff.ru/v2
TBANK_SUCCESS_URL=https://YOUR_DOMAIN/payment-success
TBANK_FAIL_URL=https://YOUR_DOMAIN/payment-fail
TBANK_NOTIFICATION_URL=https://YOUR_DOMAIN/webhook/tbank-payment-webhook
```

Если используется тестовая среда, добавить отдельные переменные:

```env
TBANK_TEST_TERMINAL_KEY=
TBANK_TEST_PASSWORD=
TBANK_USE_TEST=true
```

Не коммитить реальные ключи.

### 8.3. Новый frontend endpoint

Добавить функцию в `src/utils/api.js`:

```js
createTbankInvoice({ user_id, username, amount, init_data })
```

Она вызывает n8n endpoint:

```text
POST /webhook/create-tbank-payment
```

Пример запроса:

```json
{
  "user_id": "123456789",
  "username": "roman",
  "amount": 990,
  "init_data": "telegram init data",
  "source": "miniapp",
  "description": "Пополнение баланса AI-сервиса недвижимости"
}
```

Пример ответа:

```json
{
  "success": true,
  "payment_id": "1234567890",
  "order_id": "tb_123456789_1710000000",
  "payment_url": "https://securepay.tinkoff.ru/...",
  "amount": 990,
  "credits": 990
}
```

### 8.4. Открытие оплаты в Mini App

После получения `payment_url`:

1. В Telegram WebApp открыть ссылку через `tg.openLink(payment_url)` или обычный `window.location.href` fallback.
2. После возврата на `SuccessURL` показать экран `Оплата проверяется`.
3. Запросить `user-status` через 2-5 секунд.
4. Если баланс обновился - показать успех.
5. Если не обновился - показать кнопку `Проверить оплату`.

Не полагаться только на redirect пользователя. Главный источник правды - webhook от Т-Банка + серверная проверка `GetState`.

---

## 9. n8n workflows для Т-Банка

Нужно добавить минимум 3 workflow.

### 9.1. Workflow `create-tbank-payment`

Назначение: создать платеж в Т-Банке и вернуть ссылку на оплату.

Логика нод:

```text
Webhook: POST /create-tbank-payment
↓
Validate input
↓
Verify Telegram initData / user exists
↓
Generate internal order_id
↓
Insert payment row: pending
↓
Build T-Bank Init payload
↓
Generate Token
↓
HTTP Request: POST /v2/Init
↓
Check response Success = true
↓
Update payment row with PaymentId and PaymentURL
↓
Return payment_url to frontend
```

Пример внутреннего `order_id`:

```text
tb_<telegram_user_id>_<timestamp>_<random>
```

Пример payload для `Init` нужно сверить с актуальной документацией, но ориентировочно:

```json
{
  "TerminalKey": "...",
  "Amount": 99000,
  "OrderId": "tb_123_1710000000",
  "Description": "Пополнение баланса AI-сервиса недвижимости",
  "NotificationURL": "https://domain.ru/webhook/tbank-payment-webhook",
  "SuccessURL": "https://domain.ru/payment-success",
  "FailURL": "https://domain.ru/payment-fail",
  "Token": "..."
}
```

Важно: в API Т-Банка сумма обычно передается в копейках. То есть 990 ₽ = `99000`. Codex обязан проверить это в официальной документации перед реализацией.

### 9.2. Workflow `tbank-payment-webhook`

Назначение: принять уведомление от Т-Банка и начислить баланс.

Логика нод:

```text
Webhook: POST /tbank-payment-webhook
↓
Log raw body
↓
Validate Token/signature
↓
Extract PaymentId, OrderId, Status, Success, Amount
↓
Find payment by PaymentId or OrderId
↓
If not found -> optional GetState / log suspicious
↓
If already processed -> return OK, do not credit again
↓
If status is CONFIRMED/AUTHORIZED depending on final status rules -> credit balance
↓
Update payment status = success
↓
Insert payment event log
↓
Return OK
```

Главное: идемпотентность. Один PaymentId должен начислить баланс только один раз.

### 9.3. Workflow `check-tbank-payment`

Назначение: ручная проверка платежа пользователем или frontend после возврата с платежной формы.

Endpoint:

```text
POST /webhook/check-tbank-payment
```

Запрос:

```json
{
  "user_id": "123456789",
  "order_id": "tb_123_1710000000",
  "payment_id": "1234567890",
  "init_data": "..."
}
```

Логика:

```text
Webhook
↓
Validate user/initData
↓
Find payment
↓
If success already credited -> return current balance
↓
Call T-Bank GetState
↓
If paid and not credited -> credit balance
↓
Return status
```

---

## 10. База данных: изменения

### 10.1. Минимальная стратегия

Если текущая таблица `payments` уже есть, не создавать новую, а добавить поля. Если проще и безопаснее - создать отдельную таблицу `payment_events`.

Обязательные поля для `payments`:

```sql
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'telegram_stars',
ADD COLUMN IF NOT EXISTS external_payment_id TEXT,
ADD COLUMN IF NOT EXISTS order_id TEXT,
ADD COLUMN IF NOT EXISTS amount_rub INTEGER,
ADD COLUMN IF NOT EXISTS amount_kopecks INTEGER,
ADD COLUMN IF NOT EXISTS credits INTEGER,
ADD COLUMN IF NOT EXISTS credited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS credited_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS raw_payload JSONB;
```

Добавить уникальные индексы:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_external_payment_id
ON payments(provider, external_payment_id)
WHERE external_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id
ON payments(provider, order_id)
WHERE order_id IS NOT NULL;
```

### 10.2. Таблица событий платежей

Рекомендуется добавить:

```sql
CREATE TABLE IF NOT EXISTS payment_events (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_payment_id TEXT,
  order_id TEXT,
  event_type TEXT,
  status TEXT,
  success BOOLEAN,
  amount_kopecks INTEGER,
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.3. Функция начисления кредитов

Создать серверную SQL-функцию или делать атомарный UPDATE в n8n:

```sql
UPDATE users
SET star_balance = star_balance + $credits,
    updated_at = NOW()
WHERE telegram_id = $user_id;
```

Важно: перед UPDATE обязательно проверить, что платеж еще не `credited = true`.

Идеально делать в транзакции:

```sql
BEGIN;

SELECT credited FROM payments WHERE id = $payment_id FOR UPDATE;

-- if credited = false:
UPDATE users SET star_balance = star_balance + $credits WHERE telegram_id = $user_id;
UPDATE payments SET credited = true, credited_at = NOW(), status = 'success' WHERE id = $payment_id;

COMMIT;
```

Если n8n плохо работает с транзакциями, сделать отдельную PostgreSQL function `credit_payment_once(payment_id)`.

---

## 11. Prompt-логика для AI-недвижимости

### 11.1. Главный системный prompt для AI-ремонта

Использовать как основу:

```text
Real estate interior renovation and virtual staging.
Keep the original room layout, walls, windows, doors, ceiling height, camera angle and proportions.
Do not change geometry. Do not add extra windows, doors, balconies, rooms or structural elements.
Add realistic renovation, furniture and decor according to the selected style.
Make the result look like a professional real estate listing photo.
Use natural bright lighting, clean surfaces and realistic materials.
The final image must remain believable and suitable for a property advertisement.
```

### 11.2. Негативный prompt

```text
Do not distort the room geometry. Do not change the number or position of windows and doors. Do not remove structural walls. Do not add fake views from windows. Do not make the room larger than it is. Do not create unrealistic luxury if the room structure does not support it. No people. No text. No watermark. No fantasy style. No cartoon. No anime.
```

### 11.3. Пресеты стилей

#### Современный светлый

```text
Style: modern bright apartment, neutral colors, light walls, warm wooden floor, simple contemporary furniture, clean and spacious look.
```

#### Скандинавский

```text
Style: Scandinavian interior, white and beige palette, natural wood, cozy textiles, minimal decor, clean daylight.
```

#### Премиум

```text
Style: premium contemporary interior, elegant materials, soft warm lighting, high-quality furniture, calm luxury, realistic finish.
```

#### Для аренды

```text
Style: practical rental apartment, durable furniture, neutral colors, functional layout, clean and attractive for tenants.
```

#### Косметический ремонт

```text
Style: affordable cosmetic renovation, fresh paint, simple flooring, clean budget furniture, realistic and not overly expensive.
```

### 11.4. Prompt для улучшения фото без изменения ремонта

```text
Enhance this real estate photo for a property listing. Improve brightness, contrast, sharpness and color balance. Correct perspective slightly if needed. Keep the original room, furniture, renovation, layout and all objects unchanged. Do not add or remove furniture. Do not change materials. Make it look natural and professional.
```

### 11.5. Prompt для текста объявления

```text
Напиши продающее, но честное описание объекта недвижимости для объявления. Стиль: профессионально, понятно, без чрезмерных обещаний. Укажи преимущества, возможный сценарий использования, атмосферу квартиры. Не утверждай, что AI-визуализация является реальным ремонтом. Если используются визуализированные фото, добавь корректную пометку: "На изображениях представлена визуализация возможного ремонта".
```

---

## 12. Видео-логика

### 12.1. MVP-подход

Не использовать дорогой image-to-video на старте для каждого фото. Для MVP собрать видео через FFmpeg:

- плавный zoom-in/zoom-out;
- pan left/right;
- crossfade transitions;
- титульный экран;
- подписи комнат;
- финальный CTA;
- фоновая музыка без авторских проблем;
- watermark/дисклеймер.

### 12.2. Форматы

Поддержать минимум:

- 9:16 - основной формат для Telegram/VK/Shorts/Reels;
- 1:1 - квадрат;
- 16:9 - горизонтальный.

### 12.3. Рекомендуемые длительности

- 5 фото -> 20 секунд;
- 8 фото -> 30 секунд;
- 10 фото -> 35-40 секунд.

### 12.4. Отдельный video-render endpoint

Если в проекте уже нет стабильного рендера видео через n8n, сделать отдельный endpoint на VPS:

```text
POST /render-real-estate-video
```

Payload:

```json
{
  "order_id": "ord_123",
  "user_id": "123456789",
  "images": [
    "https://storage/result1.jpg",
    "https://storage/result2.jpg"
  ],
  "format": "vertical",
  "title": "AI-визуализация квартиры",
  "subtitle": "Возможный вариант ремонта и меблировки",
  "disclaimer": "Визуализация возможного ремонта. Реальное состояние объекта может отличаться."
}
```

Response:

```json
{
  "success": true,
  "video_url": "https://storage/videos/ord_123.mp4"
}
```

---

## 13. Юридическая и этическая пометка

В каждом результате, где AI меняет ремонт/мебель, добавить явную пометку:

```text
Визуализация возможного ремонта. Реальное состояние объекта может отличаться.
```

В видео добавить короткий watermark/титр:

```text
AI-визуализация возможного ремонта
```

Запрещено делать так, чтобы результат выдавался за фактическое состояние квартиры, если ремонт и мебель сгенерированы AI.

В prompt нельзя позволять:

- менять планировку;
- добавлять окна;
- добавлять балконы;
- увеличивать площадь;
- убирать несущие элементы;
- создавать несуществующие виды из окна;
- делать объект существенно лучше по физическим характеристикам.

---

## 14. Изменения в frontend

### 14.1. `src/utils/modes.js`

Задача Codex:

1. Найти текущий массив `MODES`.
2. Скрыть старые режимы из UI.
3. Добавить новые режимы недвижимости.

Пример структуры:

```js
export const MODES = [
  {
    id: 'real_estate_renovation',
    title: 'AI-ремонт квартиры',
    description: 'Добавим ремонт и мебель, сохранив планировку комнаты',
    resultType: 'image',
    cost: 20,
    endpoint: 'generate-real-estate-renovation',
    category: 'real_estate'
  },
  {
    id: 'real_estate_enhance',
    title: 'Улучшить фото объекта',
    description: 'Свет, резкость и качество без изменения ремонта',
    resultType: 'image',
    cost: 8,
    endpoint: 'generate-real-estate-enhance',
    category: 'real_estate'
  },
  {
    id: 'real_estate_video',
    title: 'Видео объекта',
    description: 'Соберем продающий ролик из фотографий квартиры',
    resultType: 'video',
    cost: 150,
    endpoint: 'generate-real-estate-video',
    category: 'real_estate'
  },
  {
    id: 'real_estate_full_package',
    title: 'Полный пакет',
    description: 'Фото с ремонтом, видео и текст объявления',
    resultType: 'mixed',
    cost: 250,
    endpoint: 'generate-real-estate-package',
    category: 'real_estate'
  }
];
```

### 14.2. Новые компоненты или переиспользование старых

Можно переиспользовать:

- `PhotoUpload.jsx`;
- `MultiPhotoUpload.jsx`;
- `StyleSelector.jsx`, но заменить стили;
- `GenerateButton.jsx`;
- `CostIndicator.jsx`;
- `LoadingScreen.jsx`;
- `ResultScreen.jsx`;
- `HistoryScreen.jsx`.

Добавить при необходимости:

- `RoomTypeSelector.jsx`;
- `RealEstateStyleSelector.jsx`;
- `PaymentMethodSelector.jsx`;
- `PackageSelector.jsx`.

### 14.3. Изменить тексты загрузки

Текст:

```text
Загрузите фото квартиры или комнаты. Лучше использовать реальные фото объекта при дневном освещении.
```

Предупреждение:

```text
AI сохранит планировку и создаст визуализацию возможного ремонта. Не используйте результат как фото фактического состояния объекта.
```

### 14.4. Обновить `CostIndicator`

Переименовать Stars в кредиты в пользовательском интерфейсе:

```text
Стоимость: 150 кредитов
Баланс: 420 кредитов
```

Но не обязательно сразу менять поле БД.

### 14.5. Обновить оплату в `App.jsx`

Текущая логика Telegram Stars остается.

Добавить состояние:

```js
const [paymentMethod, setPaymentMethod] = useState('stars'); // 'stars' | 'tbank'
```

Перед пополнением показывать выбор:

```text
Как хотите пополнить баланс?
- Telegram Stars
- Банковская карта / СБП через Т-Банк
```

Если `stars` - старый flow `createInvoice` + `tg.openInvoice`.

Если `tbank`:

- вызвать `createTbankInvoice`;
- открыть `payment_url`;
- после возврата/закрытия обновить `user-status`;
- показать кнопку проверки оплаты.

---

## 15. Изменения в `src/utils/api.js`

Добавить функции:

```js
export async function createTbankInvoice(payload) {
  return apiRequest('/create-tbank-payment', {
    method: 'POST',
    body: JSON.stringify(payload),
    maxRetries: 0
  });
}

export async function checkTbankPayment(payload) {
  return apiRequest('/check-tbank-payment', {
    method: 'POST',
    body: JSON.stringify(payload),
    maxRetries: 0
  });
}

export async function generateRealEstateRenovation(payload) {
  return apiRequest('/generate-real-estate-renovation', {
    method: 'POST',
    body: JSON.stringify(payload),
    maxRetries: 0
  });
}

export async function generateRealEstateEnhance(payload) {
  return apiRequest('/generate-real-estate-enhance', {
    method: 'POST',
    body: JSON.stringify(payload),
    maxRetries: 0
  });
}

export async function generateRealEstateVideo(payload) {
  return apiRequest('/generate-real-estate-video', {
    method: 'POST',
    body: JSON.stringify(payload),
    maxRetries: 0
  });
}

export async function generateRealEstatePackage(payload) {
  return apiRequest('/generate-real-estate-package', {
    method: 'POST',
    body: JSON.stringify(payload),
    maxRetries: 0
  });
}
```

Проверить реальную сигнатуру `apiRequest` в проекте перед вставкой.

---

## 16. Payload для генерации недвижимости

### 16.1. AI-ремонт

```json
{
  "user_id": "123456789",
  "username": "roman",
  "init_data": "...",
  "mode": "real_estate_renovation",
  "room_type": "living_room",
  "style": "modern_bright",
  "photo_base64": "...",
  "mime_type": "image/jpeg",
  "cost": 20,
  "disclaimer_required": true
}
```

### 16.2. Видео объекта

```json
{
  "user_id": "123456789",
  "username": "roman",
  "init_data": "...",
  "mode": "real_estate_video",
  "photos": [
    {
      "photo_base64": "...",
      "mime_type": "image/jpeg",
      "room_type": "kitchen"
    }
  ],
  "style": "modern_bright",
  "video_format": "vertical",
  "cost": 150,
  "disclaimer_required": true
}
```

### 16.3. Полный пакет

```json
{
  "user_id": "123456789",
  "username": "roman",
  "init_data": "...",
  "mode": "real_estate_full_package",
  "photos": [
    {
      "photo_base64": "...",
      "mime_type": "image/jpeg",
      "room_type": "kitchen"
    }
  ],
  "style": "scandinavian",
  "object_info": {
    "city": "Тюмень",
    "rooms": "2",
    "area": "54",
    "floor": "7/16",
    "price": "6500000",
    "address_or_district": "по желанию пользователя"
  },
  "cost": 250,
  "disclaimer_required": true
}
```

---

## 17. n8n workflow для AI-недвижимости

### 17.1. `generate-real-estate-renovation`

Логика:

```text
Webhook
↓
Validate user_id, init_data, mode, photo
↓
Check user not blocked
↓
Check balance >= cost or free limit
↓
Upload photo to S3 if needed
↓
Build real estate prompt
↓
Call KIE.ai / selected AI provider
↓
Wait or receive callback
↓
Save result to S3
↓
Insert generation row
↓
Deduct credits
↓
Apply referral commission if paid spend
↓
Return image_url
```

Важно:

- списывать баланс только один раз;
- если AI provider вернул ошибку до результата - не списывать или делать refund;
- логировать provider task id.

### 17.2. `generate-real-estate-enhance`

То же, но prompt не должен менять мебель/ремонт.

### 17.3. `generate-real-estate-video`

Логика:

```text
Webhook
↓
Validate photos count 3-10
↓
Check balance
↓
Optionally enhance/renovate photos
↓
Save processed photos
↓
Call video render service / FFmpeg
↓
Save video_url
↓
Insert generation row type=video
↓
Deduct credits
↓
Return video_url
```

### 17.4. `generate-real-estate-package`

Логика:

```text
Webhook
↓
Check balance
↓
Process each photo through real estate renovation prompt
↓
Collect result image URLs
↓
Render video
↓
Generate listing text
↓
Save all results
↓
Deduct credits once for whole package
↓
Return image_urls + video_url + listing_text
```

---

## 18. История генераций

Текущая история должна показывать новые типы результатов:

- `AI-ремонт`;
- `Улучшение фото`;
- `Видео объекта`;
- `Полный пакет`.

Для результата mixed/full package хранить:

- `image_urls`;
- `video_url`;
- `listing_text`;
- `room_type`;
- `style`;
- `disclaimer`.

Если текущая таблица `generations` не поддерживает массив URL, добавить `metadata JSONB`:

```sql
ALTER TABLE generations
ADD COLUMN IF NOT EXISTS metadata JSONB;
```

Пример metadata:

```json
{
  "room_type": "living_room",
  "style": "modern_bright",
  "image_urls": ["..."],
  "video_url": "...",
  "listing_text": "...",
  "disclaimer": "Визуализация возможного ремонта. Реальное состояние объекта может отличаться."
}
```

---

## 19. Админ-панель

Сохранить текущую админку и добавить/переименовать метрики:

- пользователи;
- пополнения Telegram Stars;
- пополнения Т-Банк;
- выручка Т-Банк в рублях;
- потраченные кредиты;
- количество генераций недвижимости;
- ошибки AI provider;
- неуспешные платежи;
- средний чек;
- топ пользователей.

Добавить фильтр по provider:

```text
telegram_stars / tbank / admin_manual
```

---

## 20. Реферальная система

Существующую реферальную систему сохранить.

Логика:

- комиссия начисляется не от пополнения, а от фактического платного списания кредитов за генерацию;
- бесплатные генерации не дают комиссию;
- Т-Банк пополняет баланс, но реферальная комиссия должна срабатывать при расходовании кредитов, как и сейчас для Stars.

Если текущая функция `apply_referral_commission(p_user_id, p_stars_spent, p_mode)` уже работает по расходам, использовать ее без изменения. Только в UI назвать это кредитами.

---

## 21. Ошибки и edge cases

Codex должен обработать:

1. Пользователь не в Telegram - fallback, но платежи могут быть ограничены.
2. Нет `initData` - не запускать платные операции.
3. Недостаточно баланса - показать выбор оплаты.
4. Т-Банк вернул ошибку Init - показать понятную ошибку.
5. Пользователь оплатил, но webhook задержался - кнопка `Проверить оплату`.
6. Webhook пришел дважды - не начислять повторно.
7. Пользователь закрыл платежную страницу - заказ остается pending.
8. AI provider упал - не списывать или вернуть кредиты.
9. Фото слишком тяжелое - сжать до допустимого размера.
10. Загружено меньше 3 фото для видео - показать ошибку.
11. Загружено больше лимита - ограничить.
12. Т-Банк webhook с неверным Token - отклонить и залогировать.
13. PaymentId неизвестен - сделать GetState или сохранить в suspicious log.
14. Генерация частично завершилась - показать частичный результат или retry только вручную.
15. Пользователь заблокирован - не давать создавать платежи и генерации.

---

## 22. Безопасность

Обязательно:

- не хранить секреты во frontend;
- не передавать `TBANK_PASSWORD` во frontend;
- все платежи через backend/n8n;
- проверять Telegram initData на backend;
- проверять подпись/Token Т-Банк webhook;
- делать идемпотентное начисление;
- ограничить размер файлов;
- логировать ошибки без утечки секретов;
- не делать автоматические retries платных генераций;
- не доверять amount из frontend при начислении;
- amount и credits брать из созданной записи `payments`, а не из webhook без проверки.

---

## 23. Тест-план

### 23.1. Frontend

Проверить:

- открытие Mini App в Telegram;
- отображение нового главного экрана;
- скрытие старых режимов;
- выбор режима недвижимости;
- загрузку одного фото;
- загрузку нескольких фото;
- выбор типа помещения;
- выбор стиля;
- расчет стоимости;
- отображение баланса как кредитов;
- выбор оплаты Stars;
- выбор оплаты Т-Банк;
- экран результата;
- история генераций.

### 23.2. Telegram Stars

Проверить:

- создание invoice;
- openInvoice;
- успешное пополнение;
- обновление баланса;
- списание за генерацию.

### 23.3. Т-Банк

Проверить:

- создание платежа;
- запись `pending` в БД;
- переход на платежную форму;
- webhook success;
- начисление 1 рубль = 1 кредит;
- повтор webhook не начисляет повторно;
- ручная проверка платежа через `check-tbank-payment`;
- fail/cancel сценарии.

### 23.4. Генерация

Проверить:

- AI-ремонт сохраняет геометрию;
- улучшение фото не меняет мебель;
- видео собирается из фото;
- full package возвращает фото + видео + текст;
- дисклеймер присутствует.

### 23.5. База

Проверить:

- users balance;
- payments provider;
- external_payment_id unique;
- generations metadata;
- referral commission;
- error logs.

---

## 24. Порядок выполнения для Codex

### Этап 1. Изучение проекта

1. Открыть репозиторий.
2. Прочитать `PROJECT-DESCRIPTION.md`, `README.md`, `src/App.jsx`, `src/utils/modes.js`, `src/utils/api.js`.
3. Прочитать DB schema в `avatar-bot-deploy/db`.
4. Прочитать workflow manifest.
5. Составить краткий план изменений перед правками.

### Этап 2. Ребрендинг UI

1. Изменить тексты главного экрана.
2. Скрыть старые режимы.
3. Добавить режимы недвижимости.
4. Добавить выбор типа помещения и стиля.
5. Переименовать Stars в кредиты в пользовательском UI.

### Этап 3. API frontend

1. Добавить функции генерации недвижимости.
2. Добавить функции Т-Банк оплаты.
3. Обновить обработку результата mixed/full package.

### Этап 4. DB migrations

1. Добавить поля платежей.
2. Добавить индексы уникальности.
3. Добавить metadata в generations.
4. При необходимости добавить payment_events.

### Этап 5. n8n workflows

1. Создать `create-tbank-payment`.
2. Создать `tbank-payment-webhook`.
3. Создать `check-tbank-payment`.
4. Создать/адаптировать `generate-real-estate-*` workflows.
5. Убедиться, что webhook paths соответствуют `VITE_API_BASE`.

### Этап 6. Видео

1. Проверить текущую video pipeline.
2. Если нет подходящей, добавить FFmpeg render endpoint.
3. Интегрировать в n8n.

### Этап 7. Тестирование

1. Локальный frontend build.
2. Проверка eslint/build, если есть.
3. Тестовые платежи.
4. Тестовые генерации.
5. Проверка БД.
6. Проверка повторных webhook.

### Этап 8. Документация

1. Обновить README.
2. Добавить `.env.example` переменные Т-Банк.
3. Добавить инструкцию для n8n import/activation.
4. Добавить описание новых режимов.

---

## 25. Готовые UI-тексты

### Главный экран

```text
AI-визуализация недвижимости
```

```text
Загрузите фото квартиры и получите продающие изображения, видео и текст объявления за несколько минут.
```

### Загрузка фото

```text
Загрузите фото квартиры. Лучше использовать реальные светлые фото без сильного размытия.
```

### Выбор стиля

```text
Выберите стиль будущего ремонта
```

### Выбор типа помещения

```text
Укажите тип помещения, чтобы AI точнее подобрал интерьер
```

### Перед генерацией

```text
AI сохранит планировку комнаты и создаст визуализацию возможного ремонта.
```

### Дисклеймер

```text
Визуализация возможного ремонта. Реальное состояние объекта может отличаться.
```

### Недостаточно кредитов

```text
На балансе недостаточно кредитов. Пополните баланс через Telegram Stars или банковской картой через Т-Банк.
```

### Оплата Т-Банк

```text
После оплаты баланс пополнится автоматически: 1 ₽ = 1 кредит.
```

### Ожидание webhook

```text
Оплата проходит проверку. Обычно баланс обновляется автоматически. Если этого не произошло, нажмите «Проверить оплату».
```

### Результат

```text
Готово. Используйте результат как визуализацию возможного ремонта для объявления.
```

---

## 26. Критерии готовности

Проект считается готовым к первому релизу, если:

1. Старые нерелевантные режимы скрыты из UI.
2. Есть минимум 3 режима недвижимости: ремонт, улучшение фото, видео.
3. Пользователь может пополнить баланс через Telegram Stars.
4. Пользователь может пополнить баланс через Т-Банк.
5. Т-Банк начисляет баланс по курсу 1 ₽ = 1 кредит.
6. Повторный webhook не начисляет баланс повторно.
7. Генерация списывает кредиты из единого баланса.
8. История показывает новые результаты.
9. В AI-результатах есть дисклеймер.
10. `npm run build` проходит без ошибок.
11. Новые env-переменные описаны в `.env.example` / deploy config example.
12. В n8n workflows нет секретов в экспортируемых JSON.

---

## 27. Важная команда для Codex

Перед началом правок Codex должен ответить кратким планом:

```text
Я изучу структуру проекта, найду текущие режимы, платежную логику и n8n endpoints. Затем внесу изменения в UI под недвижимость, добавлю оплату Т-Банк как второй способ пополнения единого баланса кредитов, подготовлю DB migrations и n8n workflow-инструкции. Код не буду переписывать с нуля.
```

После правок Codex должен предоставить:

1. Список измененных файлов.
2. Что именно изменено.
3. Какие env-переменные добавить.
4. Какие n8n workflows создать/обновить.
5. Какие SQL migrations применить.
6. Как протестировать.
7. Что осталось сделать вручную.

---

## 28. Запреты

Codex не должен:

- переписывать проект с нуля;
- удалять рабочие workflow без необходимости;
- класть секреты в frontend;
- начислять баланс на основании непроверенного frontend amount;
- запускать AI-генерацию до оплаты;
- делать retries платных генераций без защиты от дублей;
- выдавать AI-ремонт за реальное состояние квартиры;
- менять БД без миграции;
- ломать Telegram Stars;
- ломать реферальную систему;
- удалять админ-панель.

---

## 29. Рекомендуемый итоговый нейминг

Варианты названия продукта:

- EstateVision AI;
- ReRoom AI;
- RealEstate AI Studio;
- Домовизор AI;
- AI Ремонт для объявлений;
- Квартира в кадре.

Рабочее название внутри кода можно оставить `avatar-bot-miniapp`, чтобы не делать болезненный rename репозитория.

---

## 30. Финальная цель

После выполнения задачи текущий Telegram Mini App должен стать узким продуктом для риэлторов:

```text
Риэлтор открывает Mini App -> загружает фото квартиры -> выбирает стиль ремонта -> оплачивает Stars или Т-Банк -> получает AI-фото, видео и текст объявления -> публикует результат в Telegram/Авито/Циан/Домклик с пометкой о визуализации.
```
