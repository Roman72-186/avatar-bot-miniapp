# AI Avatar Bot — Telegram Mini App

Telegram Mini App для генерации AI-аватарок из фото пользователя.

## Стек

- **Frontend:** React + Vite
- **Backend:** n8n (webhooks)
- **AI:** fal.ai (face-to-sticker + FLUX)
- **БД:** PostgreSQL 16 (Docker)
- **Деплой:** Vercel (фронт), Timeweb VPS (бэкенд)

## Быстрый старт

### 1. Клонирование и установка!

```bash
git clone https://github.com/YOUR_USERNAME/avatar-bot-miniapp.git
cd avatar-bot-miniapp
npm install
```

### 2. Настройка переменных окружения.  прнр

```bash
cp .env.example .env
```

Отредактируй `.env`:
```
VITE_API_BASE=https://YOUR_N8N_DOMAIN/webhook
```

### 3. Локальная разработка

```bash
npm run dev
```

### 4. Деплой на Vercel

```bash
# Через CLI
npx vercel

# Или через GitHub — подключи репо в дашборде Vercel
```

Не забудь добавить `VITE_API_BASE` в Environment Variables на Vercel.

### 5. Настройка бота

В BotFather:
```
/mybots → @those_are_the_gifts_bot → Bot Settings → Menu Button
→ URL: https://YOUR_VERCEL_DOMAIN.vercel.app
```

## Настройка n8n

Импортируй `n8n-workflow-skeleton.json` в n8n и настрой 3 webhook-эндпоинта:

### Webhook: user-status (POST)
Принимает: `{ user_id, init_data }`
Возвращает: `{ free_generations, total_paid }`

### Webhook: upload-photo (POST, multipart)
Принимает: FormData с `photo` и `user_id`
Сохраняет файл на VPS в `/opt/avatar-bot/images/`
Возвращает: `{ photo_url }`

### Webhook: generate (POST)
Принимает: `{ user_id, photo_url, style, init_data }`
1. Проверяет лимиты в PostgreSQL
2. Вызывает fal.ai API
3. Сохраняет результат
4. Возвращает: `{ image_url, free_left }`

## fal.ai API

Модель: `fal-ai/face-to-sticker`

```bash
curl -X POST "https://queue.fal.run/fal-ai/face-to-sticker" \
  -H "Authorization: Key YOUR_FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "PHOTO_URL",
    "prompt": "anime style portrait...",
    "num_inference_steps": 20,
    "guidance_scale": 4.5,
    "instant_id_strength": 0.7,
    "image_size": "square_hd"
  }'
```

## Структура проекта

```
avatar-bot-miniapp/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles.css
│   ├── components/
│   │   ├── PhotoUpload.jsx
│   │   ├── StyleSelector.jsx
│   │   ├── GenerateButton.jsx
│   │   ├── LoadingScreen.jsx
│   │   └── ResultScreen.jsx
│   ├── hooks/
│   │   └── useTelegram.js
│   └── utils/
│       ├── api.js
│       └── styles.js
└── n8n-workflow-skeleton.json
```

## Модели стилей

| Стиль | Промпт (ключевые слова) |
|-------|------------------------|
| Аниме | anime style, studio ghibli |
| Пиксель-арт | pixel art, retro 8-bit |
| GTA | GTA V loading screen, comic book |
| 3D Мультяшный | pixar style, 3D cartoon |

## Лимиты

- 3 бесплатных генерации в день
- 1 Telegram Star за генерацию без водяного знака
- 15 Stars за пак из 10 генераций
