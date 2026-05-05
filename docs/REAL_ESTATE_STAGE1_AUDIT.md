# Этап 1. Аудит проекта перед переделкой под недвижимость

Дата: 2026-05-05

## Цель аудита

Зафиксировать текущее состояние `avatar-bot-miniapp` перед ребрендингом в AI-сервис для риэлторов. На этом этапе код продукта не менялся: собраны режимы, платежная логика, история, админка, БД, n8n endpoints, deploy-слой и расхождения между двумя копиями frontend.

## 1. Текущий frontend

Проект в корне - React 18 + Vite 6.

Скрипты:

```text
npm run dev
npm run build
npm run preview
```

Основные файлы:

- `src/App.jsx` - главный сценарий mini app, экраны, состояние, оплата, генерации.
- `src/utils/modes.js` - список активных режимов.
- `src/utils/api.js` - API-клиент для n8n webhook.
- `src/hooks/useTelegram.js` - Telegram Web App интеграция.
- `src/components/*` - UI-компоненты.

## 2. Активные режимы сейчас

Активные режимы берутся из `MODES` в `src/utils/modes.js`.

| ID | UI-название | Endpoint | Результат | Стоимость | Бесплатный лимит |
|---|---|---|---|---:|---|
| `stylize` | Стилизация | `generate` | image | 8 | `free_stylize` |
| `multi_photo` | Мульти-фото | `generate-multi` | image | 10 | нет |
| `style_transfer` | По референсу | `generate-style-transfer` | image | 30-40 | нет |
| `photo_to_video` | Фото в видео | `generate-video` | video | 155-620 | нет |
| `lip_sync` | Lip Sync | `generate-lip-sync` | video | 250 | нет |
| `remove_bg` | Убрать фон | `generate-remove-bg` | image | 3 | `free_remove_bg` |
| `text_to_image` | Текст в фото | `generate-text-to-image` | image | 8 | `free_text_to_image` |

Закомментированы в корневом `src/utils/modes.js`, но API-функции/workflow есть:

- `enhance`;
- `photosession`;
- `ai_magic` / `generate-nanobanana`.

Для этапа 2 по ТЗ старые универсальные режимы нужно не удалять, а скрыть из пользовательского UI и заменить режимами недвижимости.

## 3. Текущая генерационная логика

`src/App.jsx` считает `starCost` через `getStarCost()`, проверяет `freeLeft` и `starBalance`, затем вызывает одну из функций `src/utils/api.js`.

Особенности:

- Для платных генераций в API-функциях обычно `maxRetries = 0`.
- Изображения сжимаются через canvas и отправляются в n8n как base64.
- Для video/style-transfer таймауты доходят до 300 секунд.
- Результат ожидается в одном из форматов:
  - `sent: true`;
  - `image_url`;
  - `images[0].url`;
  - `video_url`;
  - `video.url`.
- Локальная история сохраняет только одиночный `result_url`.

Для real estate full package потребуется поддержка mixed-результата: массив изображений, видео и текст.

## 4. API-клиент

`src/utils/api.js` использует:

```text
API_BASE = import.meta.env.VITE_API_BASE || https://n8n.creativeanalytic.ru/webhook
```

Текущие frontend endpoints:

Генерации:

- `generate`
- `generate-multi`
- `generate-style-transfer`
- `generate-gemini-style`
- `generate-video`
- `generate-lip-sync`
- `generate-remove-bg`
- `generate-enhance`
- `generate-text-to-image`
- `generate-photosession`
- `generate-nanobanana`

Пользователь/история:

- `user-status`
- `user-generations`
- `delete-generation`
- `payment-history`
- `referral-stats`

Оплата Stars:

- `create-invoice`

Админка:

- `admin-stats`
- `add-stars`
- `block-user`
- `delete-user`
- `admin-broadcast-preview`
- `admin-broadcast`
- `admin-broadcast-history`

Real-estate endpoints и T-Bank endpoints пока отсутствуют.

## 5. Telegram-интеграция

`src/hooks/useTelegram.js`:

- читает `window.Telegram?.WebApp`;
- вызывает `tg.ready()` и `tg.expand()`;
- получает `userId`, `username`, `initData`, `startParam`;
- поддерживает haptic feedback;
- открывает Telegram invoice через `tg.openInvoice`;
- шарит результат через `tg.openTelegramLink`;
- имеет browser fallback для share/clipboard.

В корневом `App.jsx` есть защита: если нет `userId`, показывается экран "Откройте через Telegram". В deploy-копии этот блок отсутствует.

## 6. Платежи сейчас

Платежи реализованы только через Telegram Stars.

Frontend flow:

1. Пользователь открывает пополнение.
2. `createInvoice(userId, amount, initData)` вызывает `create-invoice`.
3. Backend возвращает `invoice_link`.
4. `useTelegram.openInvoice()` открывает оплату.
5. При статусе `paid` вызывается `loadUserStatus()`.

Пакеты в `App.jsx`:

| Оплата | Бонус | На баланс |
|---:|---:|---:|
| 10 | 0 | 10 |
| 25 | 5 | 30 |
| 50 | 15 | 65 |
| 100 | 50 | 150 |

Баланс в коде называется `starBalance`, в БД - `users.star_balance`. По ТЗ его можно оставить как техническое поле, но в UI нужно переименовать в "кредиты".

T-Bank оплаты пока нет:

- нет `create-tbank-payment`;
- нет `tbank-payment-webhook`;
- нет `check-tbank-payment`;
- нет env-переменных Т-Банка;
- нет поля `provider` в payments.

## 7. История генераций

`src/components/HistoryScreen.jsx`:

- сначала показывает localStorage-кэш;
- затем грузит БД через `user-generations`;
- отображает сетку изображений/видео;
- preview поддерживает один `result_url`;
- удаление вызывает `delete-generation`, затем чистит localStorage.

`src/utils/generationCache.js`:

- ключ `avatar_generations`;
- максимум 20 записей;
- TTL 24 часа;
- поля: `mode`, `result_type`, `result_url`, `prompt`, `created_at`.

Для недвижимости потребуется:

- `metadata JSONB` в БД;
- поддержка `image_urls`, `video_url`, `listing_text`;
- новые подписи режимов;
- дисклеймер в result/history.

## 8. Админ-панель

`src/components/AdminPanel.jsx` сохраняет текущие возможности:

- статистика пользователей;
- список top users;
- начисление/списание Stars;
- блокировка/разблокировка;
- удаление пользователя;
- рассылка;
- история рассылок в корневой версии.

Админ-пароль передаётся в endpoints как `password`. Это уже отмечено в `docs/IMPROVEMENTS.md` как место для будущего улучшения.

Для недвижимости нужно добавить метрики:

- пополнения Telegram Stars;
- пополнения T-Bank;
- выручка в рублях;
- потраченные кредиты;
- количество real-estate генераций;
- ошибки AI provider;
- средний чек;
- provider filter.

## 9. База данных сейчас

Файлы:

- `avatar-bot-deploy/db/01_schema.sql`;
- `avatar-bot-deploy/db/02_referral.sql`;
- `avatar-bot-deploy/db/03_monitoring.sql`.

Ключевые таблицы:

- `users`;
- `generations`;
- `payments`;
- `user_topics`;
- `broadcasts`;
- `referral_commissions`;
- `error_logs`;
- `request_rate_log`;
- `health_checks`.

Текущая `users`:

- `id`;
- `username`;
- `star_balance`;
- free counters;
- referral chain `parent_l1` ... `parent_l5`;
- `blocked`;
- `is_admin`.

Текущая `generations`:

- один `result_url`;
- `result_type`;
- `mode`;
- `prompt`;
- `style`;
- `stars_spent`;
- `duration_sec`.

Текущая `payments`:

- `telegram_charge_id`;
- `provider_charge_id`;
- `stars`;
- `bonus`;
- `total_credited`;
- `status`.

Недостаёт для Т-Банк/недвижимости:

- `payments.provider`;
- `payments.external_payment_id`;
- `payments.order_id`;
- `payments.amount_rub`;
- `payments.raw_payload`;
- уникальные индексы идемпотентности;
- `payment_events`;
- `generations.metadata JSONB`.

## 10. Реферальная система

`avatar-bot-deploy/db/02_referral.sql` уже реализует расходную модель через:

```text
apply_referral_commission(p_user_id, p_stars_spent, p_mode)
```

Начисления:

- L1: 7%;
- L2: 3%;
- L3: 2%;
- L4: 1%;
- L5: 0.5%.

Функция начисляет комиссию от фактического списания, а не от пополнения. Это совпадает с ТЗ для real-estate продукта. На следующих этапах достаточно трактовать `stars_spent` как "потраченные кредиты" на уровне UI/документации.

## 11. n8n workflows

`avatar-bot-deploy/workflows/manifest.json` содержит 25 workflow:

- генерации старых режимов;
- `s3-upload`;
- `user-status`;
- `create-invoice`;
- `user-generations`;
- `delete-generation`;
- `payment-history`;
- `referral-stats`;
- admin endpoints;
- broadcast endpoints;
- `bot-start-handler`.

Real-estate workflows отсутствуют.

T-Bank workflows отсутствуют.

В workflow-файлах встречаются hardcoded старые режимы и тексты ошибок по avatar/video/Kie.ai. При создании real-estate workflows лучше не править старые workflow напрямую, а сделать новые workflow paths:

- `generate-real-estate-renovation`;
- `generate-real-estate-enhance`;
- `generate-real-estate-video`;
- `generate-real-estate-package`;
- `generate-real-estate-listing-text`, если текст будет отдельным режимом;
- `create-tbank-payment`;
- `tbank-payment-webhook`;
- `check-tbank-payment`.

## 12. Deploy и инфраструктура

Deploy-пакет:

- `avatar-bot-deploy/docker-compose.yml` поднимает PostgreSQL и n8n.
- `avatar-bot-deploy/nginx/site.conf.template` маршрутизирует `/webhook/`, `/webhook-test/`, `/n8n/`, `/s3-upload/`, `/`.
- `avatar-bot-deploy/s3-upload-service/server.js` принимает base64 и грузит файл в S3.
- `avatar-bot-deploy/config.env.example` содержит домен, Telegram, S3, n8n и admin переменные.

`vercel.json` в корне:

- собирает Vite;
- делает SPA rewrite;
- задаёт CSP;
- `connect-src` сейчас разрешает `https://n8n.creativeanalytic.ru`, fal domains и self.

Для Т-Банк frontend redirect/openLink может потребовать обновления CSP, если используются дополнительные домены оплаты или callback страницы.

## 13. Сравнение корневого frontend и deploy-копии

Сравнение `src` и `avatar-bot-deploy/frontend/src` показало отличия в 4 файлах:

```text
src/App.jsx
src/components/AdminPanel.jsx
src/utils/api.js
src/utils/modes.js
```

Статистика:

```text
4 files changed, 38 insertions(+), 130 deletions(-)
```

Главные различия:

- В deploy-копии `enhance` активен, а в корне закомментирован.
- В deploy-копии `text_to_image` не имеет бесплатного лимита, в корне имеет `free_text_to_image`.
- В корне `generateEnhance` принимает `prompt`, в deploy-копии не принимает.
- В корне есть `getBroadcastHistory` и передача `adminUserId` для рассылки, в deploy-копии этого нет.
- В корневом `App.jsx` есть экран "Откройте через Telegram", в deploy-копии его нет.
- В корневом `App.jsx` при ошибке загрузки статуса не подставляется fake-баланс, а показывается retry. В deploy-копии ставятся free defaults.
- В deploy-копии включён `PROMPT_EXAMPLES_URL = https://www.localbanana.io/`, в корне он скрыт.

Рекомендация: на этапе 2 выбрать один источник правды. Для разработки логичнее править корневой `src`, затем отдельным шагом синхронизировать `avatar-bot-deploy/frontend/src`, если VPS deploy продолжает использовать deploy-копию.

## 14. Что скрывать на этапе 2

Скрыть из пользовательского UI, не удаляя код:

- `stylize`;
- `multi_photo` как универсальный режим;
- `style_transfer` как универсальный режим;
- `photo_to_video` как универсальный режим;
- `lip_sync`;
- `remove_bg`;
- `text_to_image` в старом виде;
- `enhance` в старом виде;
- `photosession`;
- `ai_magic`.

Сохранить backend/workflow/API функции до отдельной чистки.

## 15. Что добавлять на этапе 2

Новые frontend режимы:

- `real_estate_renovation`;
- `real_estate_enhance`;
- `real_estate_video`;
- `real_estate_listing_text`;
- `real_estate_full_package`.

Новые UI-конфиги:

- типы помещений;
- стили ремонта;
- тарифы/стоимости;
- дисклеймер;
- тексты под недвижимость.

Для MVP можно начать без T-Bank и без реальной n8n генерации: сначала поставить UI/режимы/API stubs или routes, затем подключить workflow.

## 16. Риски перед правками

1. Две копии frontend расходятся.
2. Текущий `generations` не хранит mixed package.
3. Текущий `payments` не поддерживает T-Bank и идемпотентность внешних платежей.
4. UI и админка сильно используют слово "звёзды".
5. Старые n8n workflow содержат режимы и prompts, не связанные с недвижимостью.
6. `API_BASE` fallback указывает на production host.
7. Для Т-Банк нужна сверка с официальной документацией перед реализацией.
8. Если менять paid-generation flow, нельзя включать retries без idempotency.

## 17. Рекомендация для следующего этапа

Этап 2 лучше делать как frontend-only ребрендинг и переключение активных режимов:

1. Добавить `src/utils/realEstate.js` с room types, renovation styles, tariffs и дисклеймером.
2. Переписать `MODES` на real-estate режимы, старые режимы оставить в отдельном `LEGACY_MODES` или комментариях.
3. Добавить/переиспользовать компоненты выбора типа помещения и стиля.
4. Переименовать пользовательский баланс в "кредиты".
5. Не трогать пока DB/n8n/T-Bank, кроме подготовки API-функций, если нужно.
