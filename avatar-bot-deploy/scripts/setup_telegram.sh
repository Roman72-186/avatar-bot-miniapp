#!/bin/bash
# ============================================================
# Setup Telegram Bot: webhook, description, commands, menu button
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

# Load config
if [[ -f "$DEPLOY_DIR/config.env" ]]; then
    set -a
    source "$DEPLOY_DIR/config.env"
    set +a
fi

BOT_TOKEN="${BOT_TOKEN:?ERROR: BOT_TOKEN not set}"
DOMAIN="${DOMAIN:?ERROR: DOMAIN not set}"
MINIAPP_URL="${MINIAPP_URL:?ERROR: MINIAPP_URL not set}"
BOT_USERNAME="${BOT_USERNAME:?ERROR: BOT_USERNAME not set}"

API="https://api.telegram.org/bot${BOT_TOKEN}"

echo "Setting up Telegram bot @${BOT_USERNAME}..."

# 1. Set Webhook
echo -n "  setWebhook... "
WEBHOOK_URL="https://${DOMAIN}/webhook/bot-start-handler"
RESULT=$(curl -s -X POST "$API/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"callback_query\", \"pre_checkout_query\", \"successful_payment\"]}")
echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print('OK' if r.get('ok') else f'FAIL: {r}')" 2>/dev/null || echo "$RESULT"

# 2. Set Bot Description
echo -n "  setMyDescription... "
RESULT=$(curl -s -X POST "$API/setMyDescription" \
    -H "Content-Type: application/json" \
    -d '{"description": "AI-генератор аватарок, видео и арта. Загрузи фото — получи шедевр! Бесплатные генерации каждый день."}')
echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print('OK' if r.get('ok') else f'FAIL: {r}')" 2>/dev/null || echo "$RESULT"

# 3. Set Short Description
echo -n "  setMyShortDescription... "
RESULT=$(curl -s -X POST "$API/setMyShortDescription" \
    -H "Content-Type: application/json" \
    -d '{"short_description": "AI аватарки и видео из фото"}')
echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print('OK' if r.get('ok') else f'FAIL: {r}')" 2>/dev/null || echo "$RESULT"

# 4. Set Bot Commands
echo -n "  setMyCommands... "
RESULT=$(curl -s -X POST "$API/setMyCommands" \
    -H "Content-Type: application/json" \
    -d '{"commands": [{"command": "start", "description": "Запустить бота"}]}')
echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print('OK' if r.get('ok') else f'FAIL: {r}')" 2>/dev/null || echo "$RESULT"

# 5. Set Menu Button (Mini App)
echo -n "  setChatMenuButton... "
RESULT=$(curl -s -X POST "$API/setChatMenuButton" \
    -H "Content-Type: application/json" \
    -d "{\"menu_button\": {\"type\": \"web_app\", \"text\": \"Открыть\", \"web_app\": {\"url\": \"https://${MINIAPP_URL}\"}}}")
echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print('OK' if r.get('ok') else f'FAIL: {r}')" 2>/dev/null || echo "$RESULT"

# 6. Verify webhook
echo -n "  getWebhookInfo... "
RESULT=$(curl -s "$API/getWebhookInfo")
WEBHOOK=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('result',{}).get('url','NONE'))" 2>/dev/null || echo "?")
echo "$WEBHOOK"

echo ""
echo "Telegram bot setup complete!"
