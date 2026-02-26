#!/bin/bash
# ============================================================
# Avatar Bot — Post-installation Health Check
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

# Load config
if [[ -f "$DEPLOY_DIR/config.env" ]]; then
    set -a
    source "$DEPLOY_DIR/config.env"
    set +a
fi

DOMAIN="${DOMAIN:-localhost}"
BOT_TOKEN="${BOT_TOKEN:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
    local name="$1"
    local result="$2"
    if [[ "$result" == "ok" ]]; then
        echo -e "  ${GREEN}[PASS]${NC} $name"
        ((PASS++))
    elif [[ "$result" == "warn" ]]; then
        echo -e "  ${YELLOW}[WARN]${NC} $name"
        ((WARN++))
    else
        echo -e "  ${RED}[FAIL]${NC} $name"
        ((FAIL++))
    fi
}

echo ""
echo "═══ Avatar Bot Health Check ═══"
echo ""

# 1. Docker containers
echo "Docker:"
if docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps --format json 2>/dev/null | grep -q "running"; then
    check "Docker containers running" "ok"
else
    # Fallback for older docker compose
    RUNNING=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps 2>/dev/null | grep -c "Up" || echo "0")
    if [[ "$RUNNING" -ge 2 ]]; then
        check "Docker containers running ($RUNNING)" "ok"
    else
        check "Docker containers running ($RUNNING, expected 2)" "fail"
    fi
fi

# 2. PostgreSQL
echo ""
echo "PostgreSQL:"
if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres pg_isready -U avatar_bot -d avatar_bot &>/dev/null; then
    check "PostgreSQL accepting connections" "ok"
else
    check "PostgreSQL accepting connections" "fail"
fi

# Check tables
TABLE_COUNT=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres \
    psql -U avatar_bot -d avatar_bot -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ' || echo "0")
if [[ "$TABLE_COUNT" -ge 5 ]]; then
    check "Database tables created ($TABLE_COUNT)" "ok"
else
    check "Database tables created ($TABLE_COUNT, expected >=5)" "fail"
fi

# 3. n8n
echo ""
echo "n8n:"
N8N_HEALTH=$(curl -sf http://localhost:5678/healthz 2>/dev/null || echo "fail")
if [[ "$N8N_HEALTH" != "fail" ]]; then
    check "n8n /healthz" "ok"
else
    check "n8n /healthz" "fail"
fi

# Count active workflows
if [[ -n "${N8N_API_KEY:-}" ]]; then
    WF_COUNT=$(curl -sf http://localhost:5678/api/v1/workflows?active=true \
        -H "X-N8N-API-KEY: $N8N_API_KEY" 2>/dev/null | \
        python3 -c "import sys,json; r=json.load(sys.stdin); print(len(r.get('data',[])))" 2>/dev/null || echo "?")
    if [[ "$WF_COUNT" =~ ^[0-9]+$ ]] && [[ "$WF_COUNT" -ge 10 ]]; then
        check "Active workflows: $WF_COUNT" "ok"
    elif [[ "$WF_COUNT" =~ ^[0-9]+$ ]]; then
        check "Active workflows: $WF_COUNT (expected >=10)" "warn"
    else
        check "Active workflows: could not count" "warn"
    fi
fi

# 4. Webhook endpoint
echo ""
echo "Webhooks:"
WEBHOOK_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://$DOMAIN/webhook/user-status" -X POST \
    -H "Content-Type: application/json" \
    -d '{"user_id": 0}' 2>/dev/null || echo "000")
if [[ "$WEBHOOK_STATUS" =~ ^(200|400|401|422)$ ]]; then
    check "Webhook endpoint reachable (HTTP $WEBHOOK_STATUS)" "ok"
elif [[ "$WEBHOOK_STATUS" == "000" ]]; then
    check "Webhook endpoint (connection failed)" "fail"
else
    check "Webhook endpoint (HTTP $WEBHOOK_STATUS)" "warn"
fi

# 5. S3 Upload Service
echo ""
echo "S3 Upload Service:"
S3_HEALTH=$(curl -sf http://localhost:3001/health 2>/dev/null || echo "fail")
if echo "$S3_HEALTH" | grep -q '"ok"'; then
    check "S3 service /health" "ok"
else
    check "S3 service /health" "fail"
fi

# 6. Frontend
echo ""
echo "Frontend:"
FRONTEND_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null || echo "000")
if [[ "$FRONTEND_STATUS" == "200" ]]; then
    check "Frontend loading (HTTP 200)" "ok"
elif [[ "$FRONTEND_STATUS" == "000" ]]; then
    check "Frontend (connection failed)" "fail"
else
    check "Frontend (HTTP $FRONTEND_STATUS)" "warn"
fi

# 7. Telegram webhook
echo ""
echo "Telegram:"
if [[ -n "$BOT_TOKEN" ]]; then
    TG_WEBHOOK=$(curl -sf "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" 2>/dev/null | \
        python3 -c "import sys,json; r=json.load(sys.stdin); w=r.get('result',{}); print(f\"{w.get('url','NONE')} (pending: {w.get('pending_update_count',0)})\")" 2>/dev/null || echo "error")
    if echo "$TG_WEBHOOK" | grep -q "$DOMAIN"; then
        check "Telegram webhook: $TG_WEBHOOK" "ok"
    elif [[ "$TG_WEBHOOK" == "error" ]]; then
        check "Telegram webhook (API error)" "fail"
    else
        check "Telegram webhook: $TG_WEBHOOK" "warn"
    fi
else
    check "Telegram webhook (BOT_TOKEN not set)" "warn"
fi

# 8. Nginx
echo ""
echo "Nginx:"
if systemctl is-active --quiet nginx; then
    check "Nginx running" "ok"
else
    check "Nginx running" "fail"
fi

# SSL certificate check
if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null | cut -d= -f2)
    check "SSL certificate valid (expires: $EXPIRY)" "ok"
else
    check "SSL certificate" "fail"
fi

# Summary
echo ""
echo "═══════════════════════════════"
TOTAL=$((PASS + FAIL + WARN))
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}WARN: $WARN${NC}  Total: $TOTAL"
echo "═══════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo "Some checks failed. Review the output above and check logs."
    exit 1
fi
