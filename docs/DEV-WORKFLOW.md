# Dev-окружение: Разработка и тестирование

## Архитектура

```
             PROD                          DEV
        +--------------+             +------------------+
  Bot:  | @AvatarBot   |             | @AvatarBot_dev   |
        +------+-------+             +------+-----------+
               |                            |
  Mini App:    | vercel.app (main)          | Vercel preview URL (ветка)
               |                            |
  API_BASE:    | .../webhook                | .../webhook/dev
               |                            |
  n8n:         | Production workflows       | [DEV] workflows
               | webhook: generate          | webhook: dev/generate
               +------------+---------------+
                            |
  DB:              PostgreSQL (общая)
```

## Как переключается окружение

Переменная `VITE_API_BASE` определяет, куда идут все API-запросы:

| Окружение | VITE_API_BASE | Пример запроса |
|---|---|---|
| **Production** (main) | `https://n8n.creativeanalytic.ru/webhook` | `/webhook/generate` |
| **Preview** (ветки) | `https://n8n.creativeanalytic.ru/webhook/dev` | `/webhook/dev/generate` |
| **Local dev** | `https://n8n.creativeanalytic.ru/webhook/dev` | `/webhook/dev/generate` |

Настройка через Vercel Environment Variables:
- **Production**: `VITE_API_BASE=https://n8n.creativeanalytic.ru/webhook`
- **Preview**: `VITE_API_BASE=https://n8n.creativeanalytic.ru/webhook/dev`

Локально: файл `.env.development` уже содержит dev URL.

## Workflow разработки

### 1. Создать ветку
```bash
git checkout -b feature/new-feature
```

### 2. Разрабатывать локально
```bash
npm run dev  # автоматически использует .env.development -> dev webhook'и
```

### 3. n8n workflows
- Если нужен **новый workflow** -- создавать в папке DEV (с `dev/` префиксом в webhook path)
- Если **меняем существующий** -- редактировать [DEV] копию workflow в n8n

### 4. Тестировать
- Локально: `npm run dev` (dev webhook'и)
- Vercel preview: пушим ветку, Vercel создаст preview deploy с dev API_BASE
- Telegram: тестировать через `@AvatarBot_dev`

### 5. Когда готово -- merge в main
```bash
git checkout main
git merge feature/new-feature
git push  # Vercel деплоит прод
```

### 6. Перенести n8n изменения
После merge в main -- вручную перенести изменения из [DEV] workflow в Production workflow в n8n.

## DEV workflows в n8n

Все DEV-копии workflow имеют:
- Префикс `[DEV]` в имени
- Webhook path с префиксом `dev/` (напр. `dev/generate` вместо `generate`)
- По умолчанию **НЕ активны** -- активировать только при разработке

### Когда активировать DEV workflow

1. Перед началом разработки: активировать нужные [DEV] workflow
2. После завершения: деактивировать [DEV] workflow
3. Можно оставить постоянно активными базовые (user-status, create-invoice)

## Важно

- **БД общая** для prod и dev -- используйте тестовый аккаунт для тестирования
- **Не забывайте деактивировать** DEV workflow после разработки (экономия ресурсов)
- **Vercel preview** автоматически использует dev API при пуше веток (кроме main)
