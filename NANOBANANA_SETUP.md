# NanoBanana Pro Integration - Setup Guide

## Обзор

Интеграция NanoBanana Pro API для генерации AI-аватаров по 2-8 фотографиям пользователя.

**Стоимость:** 15 звёзд
**API Key:** `e5e4877b659ed877497901f0c773b529`
**Режим:** 🌟 AI Магия (ai_magic)

---

## ✅ Что уже сделано

### 1. Frontend (Vercel)
- ✅ Добавлен режим "AI Магия" в `src/utils/modes.js`
- ✅ Создана функция `generateNanoBanana()` в `src/utils/api.js`
- ✅ Добавлен UI с поддержкой 2-8 фото + опциональный промпт
- ✅ Задеплоен на Vercel (автоматически при пуше в GitHub)

### 2. Workflows (готовы к импорту)
- ✅ `workflow_generate_nanobanana.json` - основной endpoint
- ✅ `workflow_nanobanana_callback.json` - обработка результата

---

## 📋 Что нужно сделать вручную

### Шаг 1: Создать таблицы в PostgreSQL

Откройте n8n → Create new workflow → Add Code node

Скопируйте и выполните:

```sql
-- Таблица для хранения фотографий пользователей
CREATE TABLE IF NOT EXISTS user_photos (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    file_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_photos_user_id
ON user_photos(user_id);

-- Таблица для задач генерации
CREATE TABLE IF NOT EXISTS generation_tasks (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    task_id TEXT NOT NULL UNIQUE,
    prompt TEXT,
    status TEXT DEFAULT 'pending',
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_task_id
ON generation_tasks(task_id);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id
ON generation_tasks(user_id);
```

**Или через n8n Code node:**

```javascript
await $pool.query(`
    CREATE TABLE IF NOT EXISTS user_photos (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        file_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
`);

await $pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_photos_user_id
    ON user_photos(user_id);
`);

await $pool.query(`
    CREATE TABLE IF NOT EXISTS generation_tasks (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        task_id TEXT NOT NULL UNIQUE,
        prompt TEXT,
        status TEXT DEFAULT 'pending',
        result_url TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
    );
`);

await $pool.query(`
    CREATE INDEX IF NOT EXISTS idx_generation_tasks_task_id
    ON generation_tasks(task_id);
`);

await $pool.query(`
    CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id
    ON generation_tasks(user_id);
`);

return [{ json: { success: true, message: "Tables created" } }];
```

### Шаг 2: Импортировать workflows в n8n

1. Откройте https://n8n.creativeanalytic.ru
2. Workflows → **Import from File**
3. Выберите файл `workflow_generate_nanobanana.json`
4. Импортируйте
5. Повторите для `workflow_nanobanana_callback.json`

### Шаг 3: Активировать workflows

1. Откройте workflow `[MINIAPP] generate-nanobanana`
2. Нажмите **Active** (переключатель в правом верхнем углу)
3. Повторите для `[MINIAPP] nanobanana-callback`

### Шаг 4: Проверить environment variables

Убедитесь что в n8n настроена переменная окружения:

- `TELEGRAM_BOT_TOKEN` - токен вашего Telegram бота

Это можно проверить в Settings → Environment Variables

---

## 🎯 Тестирование

### 1. Проверка через Telegram бот

1. Откройте [@those_are_the_gifts_bot](https://t.me/those_are_the_gifts_bot)
2. Выберите режим **🌟 AI Магия**
3. Загрузите 2-8 фотографий
4. (Опционально) Добавьте промпт: "professional portrait, business suit"
5. Нажмите **🌟 Создать AI-аватар**

**Ожидаемое поведение:**
- Списание 15 звёзд
- Сообщение: "Генерация запущена! Ожидайте результат через 30-60 секунд..."
- Через 30-60 сек придёт готовый AI-аватар в личные сообщения бота

### 2. Проверка в n8n

**Workflow: generate-nanobanana**
- Executions должно показать успешный запуск
- Проверить что `Call NanoBanana API` вернул `taskId`
- Проверить что в БД создана запись в `generation_tasks`

**Workflow: nanobanana-callback**
- Должен сработать через 30-60 секунд после генерации
- Проверить что статус задачи обновлён на `completed`
- Проверить что фото отправлено в Telegram

### 3. Проверка базы данных

Через n8n Code node:

```javascript
// Проверить последние задачи
const tasks = await $pool.query(
    'SELECT * FROM generation_tasks ORDER BY created_at DESC LIMIT 5'
);

return tasks.rows;
```

---

## 🔧 Архитектура

```
[Frontend] → [n8n: generate-nanobanana]
                ↓
            Check Balance (15⭐)
                ↓
            Call NanoBanana API
                ↓
            Save task_id to DB
                ↓
            Deduct 15 stars
                ↓
            Response: "Генерация запущена"

[NanoBanana API] → (генерация 30-60 сек)
                ↓
            POST callback → [n8n: nanobanana-callback]
                ↓
            Find user_id by task_id
                ↓
            Update task status
                ↓
            Send photo to Telegram
```

---

## 🛠 Troubleshooting

### Ошибка: "insufficient_balance"
- Пользователь не имеет 15 звёзд
- Предложить пополнить баланс

### Ошибка: "Минимум 2 фото требуется"
- Фронтенд не передал массив `photos`
- Проверить что фото загружены на S3 перед отправкой

### Генерация не приходит (timeout)
1. Проверить что callback workflow **АКТИВЕН**
2. Проверить logs в NanoBanana dashboard
3. Проверить callback URL доступен из интернета: https://n8n.creativeanalytic.ru/webhook/nanobanana-callback

### Ошибка в БД: "relation does not exist"
- Таблицы не созданы
- Вернуться к Шагу 1

---

## 📊 Мониторинг

### NanoBanana API баланс

```bash
curl -H "Authorization: Bearer e5e4877b659ed877497901f0c773b529" \
  https://api.nanobananaapi.ai/api/v1/common/credit
```

**Цена:** ~$0.12 за изображение (24 кредита для 2K)

### Проверка задач в БД

```sql
-- Статистика за последние 24 часа
SELECT
  status,
  COUNT(*) as count
FROM generation_tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Последние ошибки
SELECT
  user_id,
  error_message,
  created_at
FROM generation_tasks
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 Документация NanoBanana

- Dashboard: https://nanobananaapi.ai/dashboard
- Docs: https://docs.nanobananaapi.ai/
- API Key: `e5e4877b659ed877497901f0c773b529`

---

## ✅ Checklist финальной проверки

- [ ] Таблицы `user_photos` и `generation_tasks` созданы в PostgreSQL
- [ ] Workflow `generate-nanobanana` импортирован и активирован
- [ ] Workflow `nanobanana-callback` импортирован и активирован
- [ ] `TELEGRAM_BOT_TOKEN` настроен в n8n environment
- [ ] Frontend задеплоен на Vercel (кнопка AI Магия видна)
- [ ] Тест: загрузка 2 фото → генерация → получен результат
- [ ] Проверен баланс NanoBanana API (достаточно кредитов)

---

**Готово!** 🎉

После завершения всех шагов пользователи смогут генерировать AI-аватары через режим **🌟 AI Магия** в боте.
