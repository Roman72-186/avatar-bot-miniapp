# Avatar Bot — Turnkey Deployment

AI-генератор аватарок, видео и арта в Telegram Mini App. Полный пакет для развёртывания на VPS за одну команду.

## Что устанавливается

```
VPS (Ubuntu 22.04+)
├── Docker Compose
│   ├── PostgreSQL 16 (users, generations, referrals, monitoring)
│   └── n8n (бэкенд: ~23 workflow)
├── Nginx + Let's Encrypt SSL
│   ├── /webhook/*    → n8n (порт 5678)
│   ├── /s3-upload/*  → S3 сервис (порт 3001)
│   └── /*            → React фронтенд
├── S3 Upload Service (Node.js + PM2)
└── Frontend (React SPA)
```

## Требования

- **VPS**: Ubuntu 22.04+, минимум 4 GB RAM, 2 vCPU, 40 GB SSD
- **Домен**: с DNS A-записью, направленной на IP сервера
- **Telegram бот**: создан через @BotFather
- **S3 хранилище**: Timeweb S3, AWS S3 или любое S3-совместимое

## Быстрый старт

### 1. Подготовка

```bash
# Купить VPS (Ubuntu 22.04+), подключиться по SSH
ssh root@your-server-ip

# Направить домен на IP сервера (A-запись в DNS)
# Подождать 5-10 минут для распространения DNS
```

### 2. Создать Telegram-бота

1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. Отправить `/newbot`
3. Выбрать имя и username
4. Сохранить **токен** (формат: `1234567890:ABC...`)

### 3. Создать S3 хранилище

Рекомендуем [Timeweb S3](https://timeweb.cloud/services/s3-storage):

1. Создать бакет с именем `avatar-bot-generations`
2. Включить **публичный доступ** для бакета
3. Сохранить: Access Key, Secret Key, Endpoint

### 4. Установка

```bash
# Скачать пакет на сервер
cd /opt
git clone <repo-url> avatar-bot-deploy
cd avatar-bot-deploy

# Настроить конфиг
cp config.env.example config.env
nano config.env   # Заполнить все значения

# Запустить установку
chmod +x install.sh
sudo ./install.sh
```

### 5. Готово!

После установки вы увидите:
- URL n8n редактора
- Логин/пароль для n8n
- Пароль администратора бота

Отправьте `/start` вашему боту для проверки.

## Структура проекта

```
avatar-bot-deploy/
├── install.sh                  # Главный скрипт установки
├── config.env.example          # Шаблон конфигурации
├── docker-compose.yml          # PostgreSQL + n8n
├── db/
│   ├── 01_schema.sql           # Основные таблицы
│   ├── 02_referral.sql         # Реферальная система
│   └── 03_monitoring.sql       # Логирование ошибок
├── workflows/
│   ├── *.json                  # Шаблоны n8n workflow
│   └── manifest.json           # Порядок импорта
├── nginx/
│   └── site.conf.template      # Шаблон Nginx
├── s3-upload-service/
│   ├── server.js               # Микросервис загрузки в S3
│   ├── package.json
│   └── ecosystem.config.js     # PM2 конфиг
├── frontend/                   # React исходники
└── scripts/
    ├── export_workflows.py     # Экспорт workflow (для разработчика)
    ├── import_workflows.py     # Импорт workflow
    ├── create_credentials.py   # Создание n8n credentials
    ├── setup_telegram.sh       # Настройка Telegram-бота
    └── healthcheck.sh          # Проверка здоровья системы
```

## Конфигурация

Все настройки в файле `config.env`:

| Переменная | Описание | Пример |
|---|---|---|
| `DOMAIN` | Домен сервера | `bot.yourdomain.com` |
| `ADMIN_EMAIL` | Email для SSL | `admin@yourdomain.com` |
| `BOT_TOKEN` | Токен Telegram-бота | `123:ABC...` |
| `BOT_USERNAME` | Username бота (без @) | `my_bot` |
| `MINIAPP_URL` | URL фронтенда | `bot.yourdomain.com` |
| `S3_ACCESS_KEY` | Ключ доступа S3 | |
| `S3_SECRET_KEY` | Секретный ключ S3 | |
| `S3_BUCKET` | Имя бакета | `avatar-bot-generations` |
| `S3_ENDPOINT` | Эндпоинт S3 | `s3.twcstorage.ru` |

## Функции бота

### Режимы генерации

| Режим | Стоимость | Описание |
|---|---|---|
| Стилизация | 8 звёзд | AI-стилизация фото (70+ стилей) |
| Мульти-фото | 10 звёзд | Слияние 2-4 фото |
| Style Transfer | 30-40 звёзд | Перенос стиля |
| Фото-в-видео | 155-620 звёзд | Анимация фото |
| Lip Sync | 250 звёзд | Синхронизация губ |
| Удаление фона | 3 звёзды | Прозрачный PNG |
| Улучшение | 8 звёзд | Апскейл 2x |
| Текст-в-картинку | 8 звёзд | Генерация по тексту |

### Бесплатные генерации

- Стилизация: 1/день
- Удаление фона: 1/день
- Улучшение: 1/день

### Реферальная система (5 уровней)

| Уровень | Комиссия |
|---|---|
| L1 (прямой реферал) | 7% |
| L2 | 3% |
| L3 | 2% |
| L4 | 1% |
| L5 | 0.5% |

## Управление

### Проверка здоровья
```bash
sudo bash scripts/healthcheck.sh
```

### Просмотр логов
```bash
# n8n
docker compose logs -f n8n

# PostgreSQL
docker compose logs -f postgres

# S3 сервис
pm2 logs s3-upload-service

# Nginx
tail -f /var/log/nginx/error.log
```

### Перезапуск сервисов
```bash
# Все Docker сервисы
docker compose restart

# S3 сервис
pm2 restart s3-upload-service

# Nginx
systemctl restart nginx
```

### Обновление фронтенда
```bash
cd /opt/avatar-bot-deploy/frontend
npm run build
cp -r dist/* /var/www/avatar-bot/
```

### Бэкап базы данных
```bash
docker compose exec postgres pg_dump -U avatar_bot avatar_bot > backup_$(date +%Y%m%d).sql
```

### Восстановление из бэкапа
```bash
docker compose exec -T postgres psql -U avatar_bot avatar_bot < backup_YYYYMMDD.sql
```

## Админ-панель

Доступ к админ-панели бота:
1. Открыть Mini App
2. 3 раза нажать на текст "AI" в шапке
3. Ввести пароль из `ADMIN_PASSWORD`

Возможности:
- Статистика пользователей
- Начисление звёзд
- Блокировка/удаление пользователей
- Массовая рассылка

## Устранение неполадок

### n8n не стартует
```bash
docker compose logs n8n
# Проверить порт 5678 свободен
ss -tlnp | grep 5678
```

### SSL не работает
```bash
# Убедиться что домен резолвится
dig +short your-domain.com
# Перевыпустить сертификат
certbot certonly --nginx -d your-domain.com
```

### Webhook не отвечает
```bash
# Проверить что n8n принимает запросы
curl -X POST http://localhost:5678/webhook/user-status \
  -H "Content-Type: application/json" \
  -d '{"user_id": 0}'
```

### Бот не отвечает на /start
```bash
# Проверить webhook
curl https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo
# Переустановить webhook
bash scripts/setup_telegram.sh
```

## Для разработчиков

### Экспорт workflow с действующего сервера
```bash
export N8N_API_KEY="your-key"
export N8N_API_URL="https://your-n8n.com/api/v1"
python3 scripts/export_workflows.py
```

Это создаст темплейтизированные JSON-файлы в `workflows/` с плейсхолдерами вместо секретов.
