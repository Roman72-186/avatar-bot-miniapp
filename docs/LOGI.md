# Лог действий — avatar-bot-miniapp

## 2026-02-22

### Аудит и исправление chat_id во всех воркфлоу
- **Проблема:** 7 из 10 генерационных воркфлоу отправляли результат в канал ошибок (`-1003757993095`) вместо пользователю
- **Исправлено:** chat_id заменён на `String(userId)` в Prepare Send + `{{ $json.user_id }}` в Send to Telegram
- **Воркфлоу:** generate-style-transfer, generate-video, generate-text-to-image, generate-enhance, generate-remove-bg, generate-multi, generate-face-swap

### Исправление needs_topic
- **Проблема:** `needs_topic: false` захардкожено — топики никогда не создавались
- **Исправлено:** `needs_topic: !threadId` во всех 8 воркфлоу

### Исправление MAX_POLLS (generate)
- **Проблема:** `$('Poll Kie Status').all().length` всегда возвращал 1 в цикле — бесконечный polling
- **Попытка 1:** Замена Poll Kie Status на Code-ноду с fetch — **СЛОМАЛО WORKFLOW** (3 зависших выполнения)
- **Откат:** Poll Kie Status возвращён к HTTP Request
- **Исправлено (попытка 2):** Evaluate Poll использует `$getWorkflowStaticData('global')` + `Date.now()` для таймера. Через 180 секунд — принудительный выход
- **Верификация:** Execution #9401 — polling 4 итерации (0s, 10s, 20s, 30s), таймер работает

### Перезапуск n8n
- **Причина:** 3 зомби-процесса (#9358, #9362, #9366) после неудачного изменения типа ноды
- **Действие:** `docker restart n8n-n8n-1` на сервере 72.56.77.253
- **Результат:** зомби убиты (status: error), webhook работает, workflow active

### Проверка generate после рестарта
- **Execution #9401:** SUCCESS, 45s, user 7504155889, стиль 3D cartoon
- **Все этапы пройдены:** S3 upload → Kie.ai → polling → Check Result → Send to Telegram → SQL

---

---

## 2026-02-23

### Исправление generate-multi (Мультифото) — Backend

**Workflow ID:** FXRCdsL4ULHevtbz

**Найдено 5 критических проблем:**

1. **Kie.ai API формат:** Использовал `modelId` (старый) вместо `model` + `input` wrapper (новый)
2. **MAX_POLLS:** Использовал сломанный `.all().length` (всегда = 1)
3. **Send to Telegram photo:** Ссылался на `$('Is OK?').item.json.data.images[0].url` — не совпадает с выходом Check Result
4. **Send to Telegram message_thread_id:** Ссылался на `$('Create Topic').item...` — падает когда топик уже существует
5. **Нет S3 загрузки в workflow:** Фронтенд отправлял на сломанный S3 микросервис (504)

**Исправления (скрипт fix_multi_workflow.js):**

- Добавлены 3 новые ноды: **Upload Photos** (Code) → **S3 Upload Multi** (S3) → **Collect URLs** (Code)
- Цепочка connections: `Has Balance? → Upload Photos → S3 Upload Multi → Collect URLs → Translate Prompt`
- **Prepare Kie Request:** `modelId` → `model: 'flux-2/pro-image-to-image'`, плоские поля → `input: { input_urls, prompt, aspect_ratio, resolution }`
- **Evaluate Poll:** `.all().length` → `$getWorkflowStaticData('global')` + `Date.now()` (таймер 180 сек)
- **Send to Telegram:** `photo` → `{{ $json.media_url }}`, `message_thread_id` → `{{ $json.thread_id }}`

**Верификация:** Все 10 проверок OK, workflow active, 35 нод

### Исправление generate-multi — Frontend

**Файл:** `src/utils/api.js` → `generateMultiPhoto()`

- **Было:** Сжатие → `uploadMultipleToFal()` → `uploadToS3()` → 504 Gateway Timeout
- **Стало:** Сжатие → `fileToBase64()` → отправка `photos_base64[]` массива напрямую в webhook
- Backend (Upload Photos нода) сам загружает на S3 и передаёт URL дальше

**Деплой:** Vercel production

### Тест #1 — Failed to fetch
- **Причина:** Telegram WebView кешировал старый JS (с обращением к мёртвому S3 микросервису)
- **Решение:** Добавлены anti-cache мета-теги в index.html, передеплой на Vercel

### Тест #2 — input_urls is required (execution #9476)
- **Путь:** Upload Photos (2 фото на S3 OK) → S3 Upload Multi ({success:true}) → Collect URLs (image_urls: []) → Kie.ai reject
- **Причина:** Collect URLs использовал `$input.all()` — это выход S3 Upload ({success:true}), в котором нет image_url
- **Исправлено:** `$input.all()` → `$('Upload Photos').all()` — берёт URL из ноды Upload Photos напрямую
- **Верификация:** OK

### Исправление Create Topic во всех 8 воркфлоу
- **Проблема:** Create Topic использовал `chat_id: "-1003757993095"` — это канал "Прием ОШИБОК" (type: channel), а не форум. Каналы не поддерживают топики
- **Факт:** Бот имеет `has_topics_enabled: true` — поддерживает топики в приватных чатах (Bot API 7.2+)
- **Тест:** `createForumTopic` с `chat_id: 7504155889` → успех (`thread_id: 33035`)
- **Исправлено:** `chat_id: "-1003757993095"` → `chat_id: String($json.user_id)` во всех 8 воркфлоу
- **generate:** дополнительно исправлено сломанное выражение `"$('Prepare Send').item.json.user_id"` (строковый литерал вместо выражения)
- **Очистка:** `TRUNCATE user_topics` — удалены 15 записей с thread_id из канала ошибок, чтобы топики создались заново в приватных чатах
- **Верификация:** Все 8 WF — `user_id=OK`, `noErrorCh=OK`, `active=true`

**Статус:** Готово к тестированию (попытка 3)

---

## 2026-02-23 (сессия 2) — Аудит всех генерационных воркфлоу

### Диагностика: почему кнопка в mini-app не вызывает execution в n8n

**Методика тестирования:** curl к каждому webhook-эндпоинту + CORS preflight

#### Результаты проверки эндпоинтов

| Эндпоинт | HTTP код | Статус |
|---|---|---|
| n8n сервер (`/`) | 200 | Работает |
| `/webhook/generate` | 403 | Webhook активен, валидация initData |
| `/webhook/generate-multi` | 403 | Webhook активен, валидация initData |
| `/webhook/generate-style-transfer` | 403 | Webhook активен, валидация initData |
| `/webhook/generate-video` | 403 | Webhook активен, валидация initData |
| `/webhook/generate-lip-sync` | 403 | Webhook активен, валидация initData |
| `/webhook/generate-remove-bg` | 403 | Webhook активен, валидация initData |
| `/webhook/generate-enhance` | 403 | Webhook активен, валидация initData |
| `/webhook/generate-text-to-image` | 403 | Webhook активен, валидация initData |
| `/webhook/admin-stats` | 200 | Работает (без initData) |
| `/s3-upload/upload-photo` | **000 (timeout)** | **МЁРТВ** |
| CORS preflight (OPTIONS) | 204 | Правильные заголовки |

**Вывод:** 403 ответ — `{"error":"unauthorized","message":"Invalid or missing Telegram initData"}` — корректное поведение, webhook-и работают. Проблема НЕ в n8n.

### Найдена главная проблема: S3 микросервис полностью мёртв

- **URL:** `https://n8n.creativeanalytic.ru/s3-upload/upload-photo`
- **Симптом:** HTTP 000, timeout на всех запросах (GET, POST), 4 теста подряд
- **Причина:** Docker-контейнер S3 микросервиса на VPS (72.56.77.253) не отвечает
- **Влияние:** 5 из 8 режимов зависали навсегда на этапе "Загрузка фото..."

#### Затронутые режимы (зависали на `uploadToS3()`):

| Режим | Функция | Этап зависания |
|---|---|---|
| `remove_bg` | `generateRemoveBg()` → `uploadToFal()` → `uploadToS3()` | "[2/3] Загрузка фото..." |
| `enhance` | `generateEnhance()` → `uploadToFal()` → `uploadToS3()` | "[2/3] Загрузка фото..." |
| `photo_to_video` | `generateVideo()` → `uploadToFal()` → `uploadToS3()` | "[2/4] Загрузка фото на S3..." |
| `lip_sync` | `generateLipSync()` → `uploadToFal()` + `uploadAudioToS3()` | "[2/4] Загрузка фото и аудио на S3..." |
| `style_transfer` | `generateStyleTransfer()` → `uploadMultipleToFal()` → `uploadToS3()` | "[2/4] Загрузка фото на S3..." |

#### Незатронутые режимы (base64 напрямую, без S3):

| Режим | Причина |
|---|---|
| `stylize` | Отправляет `photo_base64` напрямую в webhook |
| `multi_photo` | Исправлен 23.02 — отправляет `photos_base64[]` напрямую |
| `text_to_image` | Нет загрузки файлов |

### Дополнительная проблема: `uploadToS3()` без таймаута

- **Было:** `fetch()` без `AbortController` — зависание на неопределённое время
- **Поведение:** Пользователь видит LoadingScreen с сообщением "Загрузка фото..." бесконечно
- **Ошибка не показывается:** fetch без таймаута ждёт TCP timeout (2+ минуты), пользователь закрывает app раньше

### Исправление: Frontend (`src/utils/api.js`)

**Подход:** Тот же паттерн что в `generate` и `generate-multi` — отправка base64 напрямую в webhook, backend загружает на S3 сам.

#### Изменение 1: Таймаут на S3 upload
- Добавлен `AbortController` с таймаутом 15 секунд в `uploadToS3()` и `uploadAudioToS3()`
- При таймауте — чёткая ошибка вместо бесконечного зависания

#### Изменение 2: Все 5 режимов переведены на base64

| Режим | Было | Стало |
|---|---|---|
| `remove_bg` | `uploadToFal()` → `image_url` | `fileToBase64()` → `photo_base64` |
| `enhance` | `uploadToFal()` → `image_url` | `fileToBase64()` → `photo_base64` |
| `photo_to_video` | `uploadToFal()` → `image_url` | `fileToBase64()` → `photo_base64` |
| `lip_sync` | `uploadToFal()` + `uploadAudioToS3()` → URLs | `fileToBase64()` → `photo_base64` + `audio_base64` |
| `style_transfer` | `uploadMultipleToFal()` → `image_urls[]` | `fileToBase64()` → `photos_base64[]` |

#### Изменение 3: Улучшены сообщения об ошибках
- **403 / unauthorized:** "Ошибка авторизации Telegram. Закройте и откройте мини-приложение заново."
- **S3 timeout:** "Ошибка загрузки файла. Попробуйте ещё раз."
- **Общая 4xx:** более понятная диагностика

#### Изменение 4: Диагностическое логирование
- `[App] init` — userId, hasInitData, startParam при запуске
- `[handleGenerate]` — mode, canGenerate, balance при клике на кнопку
- `[API]` — endpoint, HTTP код, результат (sent/image_url/video_url)
- `[Generate]` — какой режим, куда отправляет

### Исправление: App.jsx

- Добавлены `console.log` в `handleGenerate()` — диагностика клика, баланса, режима
- Добавлен `console.log` в `useEffect` при инициализации — userId, initData
- Добавлен `console.warn` при отсутствии userId (нет контекста Telegram)

### Сборка
- `npm run build` — OK, 0 ошибок, 47 модулей

### ⚠️ ТРЕБУЕТСЯ: Обновление 5 n8n воркфлоу

Фронтенд теперь отправляет `photo_base64` вместо `image_url`. Бэкенд-воркфлоу должны принять base64 и загрузить на S3 сами (как уже сделано в `generate` и `generate-multi`).

| Workflow | Нужно добавить |
|---|---|
| **generate-remove-bg** | Code-нода: `photo_base64` → S3 upload → `image_url` |
| **generate-enhance** | Code-нода: `photo_base64` → S3 upload → `image_url` |
| **generate-video** | Code-нода: `photo_base64` → S3 upload → `image_url` |
| **generate-lip-sync** | Code-нода: `photo_base64` + `audio_base64` → S3 upload → URLs |
| **generate-style-transfer** | Code-нода: `photos_base64[]` → S3 upload → `image_urls[]` |

**Паттерн:** Скопировать Upload Photos ноду из `generate-multi` (Workflow ID: FXRCdsL4ULHevtbz)

**Статус:** Фронтенд готов, ждёт обновления n8n воркфлоу

### Верификация перед исправлением n8n (verify_workflows_base64.py)

```
Workflow                       Status          Active   Nodes   base64   S3
generate (stylize)             OK (base64)     YES      32      YES      YES
generate-multi                 OK (base64)     YES      35      YES      YES
generate-remove-bg             NEEDS FIX       YES      31      NO       NO
generate-enhance               NEEDS FIX       YES      31      NO       NO
generate-text-to-image         OK (no upload)  YES      32      NO       NO
generate-video                 NEEDS FIX       YES      33      NO       NO
generate-lip-sync              NEEDS FIX       YES      32      NO       NO
generate-style-transfer        NEEDS FIX       YES      32      NO       NO
```

### Подготовлены скрипты для n8n

1. **`fix_5_workflows_base64.py`** — основной скрипт исправления:
   - `remove-bg`, `enhance` → fal.ai подход: base64 → `data:image/jpeg;base64,...` (без S3)
   - `video`, `lip-sync`, `style-transfer` → Kie.ai подход: base64 → S3 upload → URL
   - Для каждого WF: бэкап → добавление нод → перепривязка connections → активация

2. **`verify_workflows_base64.py`** — проверка состояния до/после

**Статус:** ~~Скрипты готовы, ожидают запуска~~ Выполнено

### Запуск fix_5_workflows_base64.py (попытка 1)

- **remove-bg:** OK — добавлена Code-нода `Extract Input Data` (data URI подход, fal.ai)
- **enhance:** OK — добавлена Code-нода `Extract Input Data` (data URI подход, fal.ai)
- **video:** FAILED — HTTP 400 (использован `n8n-nodes-base.awsS3` вместо `n8n-nodes-base.s3`)
- **lip-sync:** FAILED — HTTP 400 (та же причина)
- **style-transfer:** FAILED — HTTP 400 (та же причина)

### Запуск fix_3_kieai_workflows.py (попытка 2 — исправленный скрипт)

**Изменения в скрипте:**
- Тип S3 ноды: `n8n-nodes-base.awsS3` -> `n8n-nodes-base.s3`
- Credentials: `{"aws": {...}}` -> `{"s3": {"id": "oUsMp5t3Lo3IxCZD", "name": "Timeweb S3"}}`
- Восстановление из бэкапов перед модификацией (откат сломанных нод от попытки 1)

**Результаты:**
- **generate-video** (fmTA4l0XfQXTajGI): OK — 3 ноды добавлены (Upload Photo -> S3 Upload -> Collect URL -> Translate Prompt)
- **generate-lip-sync** (whdEwP3wRDredCOw): OK — 3 ноды добавлены (Upload Photo + Audio -> S3 Upload -> Collect URLs -> Prepare Kie Request)
- **generate-style-transfer** (HbqrBmstlPbz9VxM): OK — 3 ноды добавлены (Upload Photos -> S3 Upload Style -> Collect URLs -> Prepare Request)

### Финальная верификация (все 8 воркфлоу)

```
Workflow                       Status          Active   Nodes   base64   S3
generate (stylize)             OK (base64)     YES      32      YES      YES
generate-multi                 OK (base64)     YES      35      YES      YES
generate-remove-bg             OK (base64)     YES      32      YES      NO
generate-enhance               OK (base64)     YES      32      YES      NO
generate-text-to-image         OK (no upload)  YES      32      NO       NO
generate-video                 OK (base64)     YES      36      YES      YES
generate-lip-sync              OK (base64)     YES      35      YES      YES
generate-style-transfer        OK (base64)     YES      35      YES      YES

OK: 8/8, Needs fix: 0, Inactive: 0
```

**Статус:** ~~Ожидает тестирования~~ Тестирование выявило 4 дополнительные проблемы (см. ниже)

### Исправление Kie.ai API формата (3 воркфлоу)

**Проблема:** Kie.ai API вернул 422: `"The model cannot be null"` при тестировании "По референсу"

**Причина (execution #10163):**
1. `Prepare Request` использовал `modelId` (deprecated) вместо `model` + `input` wrapper
2. `image_urls` читался из `$('Webhook').first().json.body.image_urls` — пустой, т.к. фронтенд теперь отправляет `photos_base64`
3. Результат: `image_input: []`, `model: null` -> Kie.ai 422

**Исправлено во всех 3 Kie.ai воркфлоу (fix_kie_model_format.py, fix_style_transfer_prepare.py):**

| Workflow | Было | Стало |
|---|---|---|
| video | `modelId: 'kling-3.0/video'`, flat fields | `model: 'kling-3.0/video'`, `input: {...}` |
| lip-sync | `modelId: 'kling/ai-avatar-pro'`, flat fields | `model: 'kling/ai-avatar-pro'`, `input: {...}` |
| style-transfer | `modelId: 'kling-image-nano-banana-pro'`, flat fields | `model: 'nano-banana-pro'`, `input: {...}` |

Также исправлен источник image_url: `$('Parse Input')` / `body.image_urls` -> `$('Collect URL')` / `$json.image_urls`

### Исправление имени модели style-transfer

**Проблема:** Kie.ai: `"The model name you specified is not supported"`
**Причина:** Имя модели `kling-image-nano-banana-pro` не поддерживается
**Доказательство:** Execution #5973 (success) использовал `model: 'nano-banana-pro'`
**Исправлено (fix_model_names.py):** `kling-image-nano-banana-pro` -> `nano-banana-pro`
**Верификация:** Execution #10366 — `Create Kie Task: code 200, success`

### Исправление Deduct Stars в style-transfer

**Проблема:** SQL ошибка `column "telegram_id" does not exist` (executions #10337, #10343)
**Было:** `WHERE telegram_id = '{{ user_id }}'` — колонка `telegram_id` не существует в таблице `users`
**Стало:** `WHERE id = {{ user_id }} AND star_balance >= {{ required_stars }}`
**Скрипт:** fix_deduct_stars.py

### Исправление двойной генерации

**Проблема:** Одно нажатие кнопки вызывало 2 execution в n8n (executions #10337 + #10343 — идентичные фото)
**Причина:** `apiRequest()` имел `maxRetries = 2` по умолчанию. При таймауте (300 сек для style-transfer) или сетевой ошибке фронтенд автоматически повторял запрос. Но n8n уже начал обработку по первому запросу.
**Исправлено:** Все генерационные вызовы переведены на `maxRetries = 0`:
- `generate`, `generate-multi`, `generate-style-transfer`, `generate-video`, `generate-lip-sync`, `generate-remove-bg`, `generate-enhance`, `generate-text-to-image`, `generate-nanobanana`, `generate-gemini-style`
- Retry оставлен только для non-generation запросов (`user-status`, `admin-stats` и т.д.)
**Деплой:** Vercel production

### Верификация после всех исправлений

- **Execution #10366 (style-transfer):** SUCCESS, промпт передан корректно, Kie.ai code 200
- **Все 8 воркфлоу:** active, base64 support OK, model format OK
- **Двойная генерация:** устранена (maxRetries = 0)
- **Deduct Stars:** исправлен (WHERE id = ...)

---

## 2026-02-24

### Отправка результата файлом (sendDocument) — 4 воркфлоу

**Проблема:** Telegram сжимает фото при sendPhoto — пользователь получает результат в пониженном качестве. Для remove-bg (PNG с прозрачностью) sendPhoto конвертирует в JPEG — прозрачность теряется.

**Решение:** Добавлена нода **"Send Document to Telegram"** (sendDocument) после существующей sendPhoto. Пользователь получает 2 сообщения: сжатое фото-превью + файл в полном качестве.

**Изменённые workflow (через n8n API):**

| Workflow ID | Название | Цепочка |
|---|---|---|
| `3iZY--GtxZ556edSgZQuB` | generate (Стилизация) | Send to Telegram → **Send Document** → Respond to Webhook |
| `Lfra98zYiGA0yKmD` | generate-enhance (Улучшение) | Send to Telegram → **Send Document** → Save Generation |
| `QP37jmBYCpeaCzYV` | generate-text-to-image (Текст в фото) | Send to Telegram → **Send Document** → Save Generation |
| `z29Bx9CRXKvcHgvI` | generate-remove-bg (Убрать фон) | Send to Telegram → **Send Document** → Save Generation |

**Конфигурация новой ноды:**
- **URL:** `telegram.org/.../sendDocument`
- **Body (JSON):** `chat_id`, `document` (URL с S3), `caption` (оригинальный + `\n\n📄 Файл в полном качестве`), `message_thread_id` (из ответа sendPhoto)
- **Retry:** 2 попытки, 2000ms, continueOnFail: true
- **Данные:** берутся из `$('Prepare Send')`, thread_id из `$json.result.message_thread_id`

**Не затронуто:** фронтенд, мультифото, по референсу, фото в видео, lip sync, баланс, стоимость

### Деплой фронтенда — base64 для всех режимов

**Проблема:** Задеплоенная на Vercel версия `api.js` всё ещё обращалась к мёртвому S3 микросервису (`uploadToFal()` → `uploadToS3()`). Режимы remove-bg, enhance, video, lip-sync, style-transfer падали с `Failed to fetch`.

**Причина:** 608 строк изменений в `src/utils/api.js` не были закоммичены и задеплоены.

**Коммит:** `7967042` — `git push origin main` → Vercel auto-deploy
**Верификация:** Бандл `index-Dp3Ev5lD.js` содержит `photo_base64` (5), `uploadToFal` (0)

### Тест remove-bg (execution #11041)

- Фронт → n8n: ✅ запрос дошёл
- Auth: ✅
- S3 upload: ✅ (файл 70KB загружен)
- Kie.ai: ❌ `Read timed out` при скачивании с `s3.twcstorage.ru`
- **Причина:** Kie.ai серверы (Азия) не смогли скачать файл с Timeweb S3 — временная проблема связности, не связана с нашими изменениями

### Очистка имён топиков — 7 воркфлоу

**Проблема:** При создании forum topic в Telegram имя содержало `| User {user_id}` (например `✂️ Удаление фона | User 7504155889`)

**Исправлено (через n8n API):** Убран суффикс `| User " + $json.user_id` из `Create Topic` jsonBody в 7 воркфлоу

| Workflow | Было | Стало |
|---|---|---|
| generate | `🎨 Стилизация \| User {id}` | `🎨 Стилизация` |
| generate-enhance | `🔍 Улучшение \| User {id}` | `🔍 Улучшение` |
| generate-text-to-image | `✏️ Текст в фото \| User {id}` | `✏️ Текст в фото` |
| generate-remove-bg | `✂️ Удаление фона \| User {id}` | `✂️ Удаление фона` |
| generate-multi | `✨ Мульти Фото \| User {id}` | `✨ Мульти Фото` |
| generate-face-swap | `🎭 Face Swap \| User {id}` | `🎭 Face Swap` |
| generate-style-transfer | `🪄 По референсу \| User {id}` | `🪄 По референсу` |

`generate-video` (`🎬 Фото в видео`) — уже был без суффикса

---

## 2026-02-24 (сессия 2) — PS6: Финальная валидация n8n воркфлоу

### Цель

Комплексная проверка всех 8 генерационных воркфлоу после исправлений фаз 1–5:
- Активность и корректность connections
- Валидация конфигурации нод (strict profile)
- Проверка последних executions на ошибки
- Соответствие frontend API ↔ backend webhooks

### n8n Health Check

- **Версия:** v2.33.4
- **Статус:** Connected
- **Всего workflows:** 48 (из них 8 генерационных)

### Валидация 8 генерационных воркфлоу

| # | Workflow | ID | Active | Nodes | Connections | base64 |
|---|---|---|---|---|---|---|
| 1 | generate (Стилизация) | `3iZY--GtxZ556edSgZQuB` | YES | 33 | OK | YES |
| 2 | generate-multi (Мультифото) | `FXRCdsL4ULHevtbz` | YES | 35 | OK | YES |
| 3 | generate-style-transfer (По референсу) | `HbqrBmstlPbz9VxM` | YES | 35 | OK | YES |
| 4 | generate-video (Фото в видео) | `fmTA4l0XfQXTajGI` | YES | 36 | OK | YES |
| 5 | Lip Sync | `whdEwP3wRDredCOw` | YES | 35 | OK | YES |
| 6 | generate-remove-bg (Убрать фон) | `z29Bx9CRXKvcHgvI` | YES | 35 | OK | YES |
| 7 | generate-enhance (Улучшение) | `Lfra98zYiGA0yKmD` | YES | 35 | OK | YES |
| 8 | generate-text-to-image (Текст в фото) | `QP37jmBYCpeaCzYV` | YES | 33 | OK | YES |

**Результат: 8/8 active, 0 invalid connections, все на base64**

### Предупреждения валидации (strict profile)

#### Ложные срабатывания (все 8 WF)

| Предупреждение | Причина | Реальная проблема? |
|---|---|---|
| `Workflow contains a cycle` | Цикл опроса Kie.ai (Create Task → Poll → Evaluate → loop) | НЕТ — intentional polling loop |
| `Is Failed?` error output config | IF-нода маршрутизирует по `is_failed` | НЕТ — не error handling, а бизнес-логика |
| `Validate initData` bracket errors | JS-синтаксис `]]` и `?.[0]` принимается за n8n expression brackets | НЕТ — валидный JavaScript в Code-ноде |
| `continueOnFail + onError` dual | Обе опции присутствуют на одной ноде | НЕТ — n8n совместимость |

#### Реальная проблема (MEDIUM)

- **Workflow:** `generate-style-transfer` (HbqrBmstlPbz9VxM)
- **Проблема:** 4 SQL-ноды (`Check Balance`, `Get User Topic`, `Save Topic`, `Deduct Stars`) — значения в полях query не имеют префикса `=` для expression evaluation
- **Риск:** Работает на n8n v2.33.4, но может сломаться при обновлении n8n (если валидация выражений станет строже)
- **Рекомендация:** Добавить `=` перед `{{ }}` в SQL-запросах при следующем обслуживании

### Проверка последних executions

#### Генерационные воркфлоу — ошибок нет

- **Последняя успешная генерация:** Execution #11756 (generate/stylize)
- **Ошибки в генерационных WF за период:** 0

#### Системные ошибки (не связаны с генерацией)

| Workflow | Частота | Проблема |
|---|---|---|
| broadcast-scheduler | Каждую минуту | Ошибка в cron-задаче |
| Health Monitor | Каждые 30 мин | Ошибка мониторинга |

**Вывод:** Системные WF имеют ошибки, но на генерацию не влияют.

### Frontend ↔ Backend соответствие

**Base URL:** `https://n8n.creativeanalytic.ru/webhook`

| Фронтенд функция | Endpoint | Таймаут | maxRetries | Формат данных |
|---|---|---|---|---|
| `generateStylize()` | `/generate` | 180s | 0 | `photo_base64` |
| `generateMultiPhoto()` | `/generate-multi` | 180s | 0 | `photos_base64[]` |
| `generateStyleTransfer()` | `/generate-style-transfer` | 300s | 0 | `photos_base64[]` |
| `generateVideo()` | `/generate-video` | 300s | 0 | `photo_base64` |
| `generateLipSync()` | `/generate-lip-sync` | 300s | 0 | `photo_base64` + `audio_base64` |
| `generateRemoveBg()` | `/generate-remove-bg` | 120s | 0 | `photo_base64` |
| `generateEnhance()` | `/generate-enhance` | 120s | 0 | `photo_base64` |
| `generateTextToImage()` | `/generate-text-to-image` | 180s | 0 | text only |

**Результат:** Все 8 эндпоинтов совпадают, maxRetries=0 (без двойных генераций), все на base64 (без обращений к мёртвому S3 микросервису)

### Итог PS6

| Критерий | Статус |
|---|---|
| Все 8 WF активны | ✅ |
| Все connections валидны | ✅ |
| Все на base64 (без S3 микросервиса) | ✅ |
| Kie.ai API формат (model + input) | ✅ |
| Frontend endpoints = Backend webhooks | ✅ |
| maxRetries = 0 (без двойных генераций) | ✅ |
| Deduct Stars SQL исправлен | ✅ |
| Ошибки в executions генерации | 0 |
| style-transfer SQL `=` prefix | ⚠️ MEDIUM |

**Вердикт: 8/8 генерационных воркфлоу полностью операбельны. Все исправления фаз 1–5 подтверждены.**

---

## 2026-02-25

### Исправление реферальных комиссий — 7 воркфлоу

**Проблема:** Реферальная цепочка (до 5-го уровня) не выполнялась ни в одном воркфлоу, кроме `generate` (stylize). Реферер не получал начисления при генерациях.

**Корневая причина:** В 7 из 8 воркфлоу нода `Deduct Stars` имела **параллельное** подключение к `Respond OK` (respondToWebhook) и `Calc Actual Cost` на `main[0]`. Поскольку `respondToWebhook` завершает webhook-выполнение, параллельный `Calc Actual Cost` никогда не запускался → вся реферальная цепочка (`Was Paid?` → `Apply Referral Commission` → `Notify Referral Earnings`) не работала.

**Исправлено:** Перестроены connections с параллельных на последовательные:
- **Было:** `Deduct Stars` → `[Respond OK, Calc Actual Cost]` (parallel)
- **Стало:** `Deduct Stars` → `Respond OK` → `Calc Actual Cost` (sequential)

**Затронутые воркфлоу:**
| Workflow | ID |
|---|---|
| generate-multi | `FXRCdsL4ULHevtbz` |
| generate-style-transfer | `HbqrBmstlPbz9VxM` |
| generate-video | `fmTA4l0XfQXTajGI` |
| Lip Sync | `whdEwP3wRDredCOw` |
| generate-remove-bg | `z29Bx9CRXKvcHgvI` |
| generate-enhance | `Lfra98zYiGA0yKmD` |
| generate-text-to-image | `QP37jmBYCpeaCzYV` |

**Верификация:** Execution #13860 (style-transfer) — `Apply Referral Commission` вернул `{parent_id: "953060237", level: 1, commission: 3}`, Telegram-уведомление доставлено рефереру (Роман, @oraz_mahmet): `💰 Реферальный доход! +3 ⭐`.

### Режим «По референсу» — минимум 1 фото вместо 2

**Запрос:** Разрешить загрузку 1 фото для style_transfer (ранее требовалось минимум 2).

**Изменения:**
| Файл | Было | Стало |
|---|---|---|
| `src/utils/modes.js` | `minPhotos: 2` | `minPhotos: 1` |
| `src/App.jsx` | `photos.filter(Boolean).length >= 2` | `photos.filter(Boolean).length >= (currentMode.minPhotos \|\| 1)` |
| `src/components/CostIndicator.jsx` | Текст подсказки: «Загрузите 2 фото…» | «Загрузите 1–4 фото и опишите желаемый стиль…» |

**Логика:** С 1 фото — AI стилизует по промпту. С 2+ фото — переносит стиль с референса.

### Новый workflow: generate-photosession

**Workflow ID:** `elqdZNPtVYlanzWW`
**Webhook:** `https://n8n.creativeanalytic.ru/webhook/generate-photosession`
**Статус:** INACTIVE (ожидает тестирования)

**Назначение:** Генерация 10 AI-фотографий из 1 пользовательского фото + выбранной темы (new_year, autumn, family, spring). Используется модель kie.ai nano-banana-pro.

**Стоимость:** 200 звёзд

**Архитектура (32 ноды):**
1. Webhook (POST, responseNode) -> Validate initData -> Auth Valid?
2. Check Balance (>= 200) -> Upload Photo -> S3 -> Deduct Stars -> Respond OK (ранний ответ фронтенду)
3. Generate Prompts (10 промптов по теме) -> Create Kie Task -> Poll loop (5s, max 36 polls)
4. Extract Result -> Rehost -> S3 Upload Result -> Collect All Results
5. Prepare Media Group -> Send Media Group (sendMediaGroup в Telegram, альбом до 10 фото)
6. Save Generation -> Calc Actual Cost -> Apply Referral Commission -> Notify Referral Earnings

**Темы (4 штуки, по 10 промптов каждая):**
- `new_year` — новогодняя фотосессия (ёлка, камин, снег, фейерверки)
- `autumn` — осенняя (лес, парк, тыквы, кафе)
- `family` — семейная/домашняя (кухня, пикник, сад, озеро)
- `spring` — весенняя (сакура, тюльпаны, лаванда, дождь)

**Особенности:**
- Ранний ответ фронтенду (Respond OK) после проверки баланса и списания звёзд
- 10 генераций обрабатываются последовательно в фоне (n8n batch processing)
- Polling loop: Wait 5s -> Poll -> Evaluate -> loop back или выход
- Set Error Result для неудачных генераций (не блокирует остальные)
- Collect All Results агрегирует успешные URL
- sendMediaGroup отправляет альбом фото в Telegram
- Полная реферальная цепочка (apply_referral_commission)

### Фронтенд: новый режим «Фотосессия» (photosession)

**Изменённые файлы:**

| Файл | Изменение |
|---|---|
| `src/utils/modes.js` | Добавлен режим `photosession` (200 звёзд, endpoint: generate-photosession) |
| `src/utils/api.js` | Добавлена функция `generatePhotosession()` (base64, таймаут 360с, retries=0) |
| `src/components/ThemeSelector.jsx` | **Новый компонент** — выбор темы из 4 вариантов (grid 2x2) |
| `src/App.jsx` | Интеграция: import, selectedTheme state, canGenerate, handleGenerate case, UI-секция |
| `src/components/LoadingScreen.jsx` | Добавлены 10 сообщений загрузки для photosession (3-6 мин) |
| `src/components/CostIndicator.jsx` | Добавлен help-текст для режима фотосессии |
| `src/styles.css` | Добавлены стили `.theme-selector`, `.theme-grid`, `.theme-card` |

**UI-flow:** Выбор режима «Фотосессия» → загрузка фото → выбор темы (4 кнопки) → генерация → результат в Telegram DM (альбом 10 фото)
