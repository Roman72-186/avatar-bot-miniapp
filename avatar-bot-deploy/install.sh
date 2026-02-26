#!/bin/bash
# ============================================================
# Avatar Bot — One-Command Installer
# Deploys PostgreSQL, n8n, S3 service, frontend, Nginx + SSL
# on a fresh Ubuntu 22.04+ VPS
#
# Usage:
#   1. Fill in config.env (copy from config.env.example)
#   2. sudo ./install.sh
# ============================================================

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/avatar-bot-install.log"

# ─── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; echo "[$(date '+%H:%M:%S')] $1" >> "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; echo "[$(date '+%H:%M:%S')] WARN: $1" >> "$LOG_FILE"; }
err()  { echo -e "${RED}[✗]${NC} $1"; echo "[$(date '+%H:%M:%S')] ERROR: $1" >> "$LOG_FILE"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
step() { echo -e "\n${BLUE}━━━ Step $1: $2 ━━━${NC}"; echo "" >> "$LOG_FILE"; echo "=== Step $1: $2 ===" >> "$LOG_FILE"; }

# ─── Step 0: Pre-flight checks ────────────────────────────────
step "0" "Pre-flight checks"

# Must be root
if [[ $EUID -ne 0 ]]; then
    err "This script must be run as root (sudo ./install.sh)"
    exit 1
fi

# Check Ubuntu version
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
    warn "This script is designed for Ubuntu. Proceeding anyway..."
fi

# Check config.env
CONFIG_FILE="$DEPLOY_DIR/config.env"
if [[ ! -f "$CONFIG_FILE" ]]; then
    err "config.env not found!"
    err "Copy config.env.example to config.env and fill in your values."
    exit 1
fi

# Load config
set -a
source "$CONFIG_FILE"
set +a

# Validate required variables
REQUIRED_VARS=(DOMAIN BOT_TOKEN BOT_USERNAME MINIAPP_URL ADMIN_EMAIL S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET S3_ENDPOINT)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        MISSING+=("$var")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    err "Missing required variables in config.env:"
    for var in "${MISSING[@]}"; do
        err "  - $var"
    done
    exit 1
fi

log "Config loaded: DOMAIN=$DOMAIN, BOT=@$BOT_USERNAME"

# Check DNS
info "Checking DNS for $DOMAIN..."
RESOLVED_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -n1 || true)
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

if [[ -z "$RESOLVED_IP" ]]; then
    warn "Could not resolve $DOMAIN — make sure DNS A-record points to $SERVER_IP"
elif [[ "$RESOLVED_IP" != "$SERVER_IP" ]]; then
    warn "DNS mismatch: $DOMAIN -> $RESOLVED_IP, but server IP is $SERVER_IP"
else
    log "DNS OK: $DOMAIN -> $SERVER_IP"
fi

# ─── Step 1: Install system packages ──────────────────────────
step "1" "Installing system packages"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl wget gnupg2 lsb-release ca-certificates \
    nginx certbot python3-certbot-nginx \
    python3 python3-pip python3-venv \
    jq git unzip >> "$LOG_FILE" 2>&1

log "System packages installed"

# ─── Step 2: Install Docker ───────────────────────────────────
step "2" "Installing Docker"

if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh >> "$LOG_FILE" 2>&1
    systemctl enable docker
    systemctl start docker
    log "Docker installed: $(docker --version)"
fi

# Docker Compose (v2 plugin)
if docker compose version &>/dev/null; then
    log "Docker Compose already available: $(docker compose version --short)"
else
    apt-get install -y -qq docker-compose-plugin >> "$LOG_FILE" 2>&1
    log "Docker Compose installed"
fi

# ─── Step 3: Install Node.js 20 ──────────────────────────────
step "3" "Installing Node.js 20"

if command -v node &>/dev/null && node -v | grep -q "v20\|v22"; then
    log "Node.js already installed: $(node -v)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1
    apt-get install -y -qq nodejs >> "$LOG_FILE" 2>&1
    log "Node.js installed: $(node -v)"
fi

# Install PM2
if command -v pm2 &>/dev/null; then
    log "PM2 already installed"
else
    npm install -g pm2 >> "$LOG_FILE" 2>&1
    log "PM2 installed"
fi

# ─── Step 4: SSL Certificate ─────────────────────────────────
step "4" "SSL Certificate"

if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    log "SSL certificate already exists for $DOMAIN"
else
    # Stop nginx temporarily for standalone cert
    systemctl stop nginx 2>/dev/null || true

    certbot certonly --standalone \
        --non-interactive --agree-tos \
        --email "$ADMIN_EMAIL" \
        -d "$DOMAIN" >> "$LOG_FILE" 2>&1

    log "SSL certificate obtained for $DOMAIN"
fi

# ─── Step 5: Generate secrets ─────────────────────────────────
step "5" "Generating secrets"

# PostgreSQL password
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
    echo "POSTGRES_PASSWORD=\"$POSTGRES_PASSWORD\"" >> "$CONFIG_FILE"
    log "Generated POSTGRES_PASSWORD"
else
    log "POSTGRES_PASSWORD already set"
fi

# n8n encryption key
if [[ -z "${N8N_ENCRYPTION_KEY:-}" ]]; then
    N8N_ENCRYPTION_KEY=$(openssl rand -hex 24)
    echo "N8N_ENCRYPTION_KEY=\"$N8N_ENCRYPTION_KEY\"" >> "$CONFIG_FILE"
    log "Generated N8N_ENCRYPTION_KEY"
else
    log "N8N_ENCRYPTION_KEY already set"
fi

# Admin password
if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '=/+' | head -c 12)
    echo "ADMIN_PASSWORD=\"$ADMIN_PASSWORD\"" >> "$CONFIG_FILE"
    log "Generated ADMIN_PASSWORD: $ADMIN_PASSWORD (save this!)"
else
    log "ADMIN_PASSWORD already set"
fi

# Reload config with new secrets
set -a
source "$CONFIG_FILE"
set +a

# ─── Step 6: Docker Compose (PostgreSQL + n8n) ────────────────
step "6" "Starting PostgreSQL + n8n"

export POSTGRES_PASSWORD DOMAIN N8N_ENCRYPTION_KEY TIMEZONE

cd "$DEPLOY_DIR"
docker compose down 2>/dev/null || true
docker compose up -d >> "$LOG_FILE" 2>&1

log "Docker Compose started"

# Wait for PostgreSQL
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U avatar_bot -d avatar_bot &>/dev/null; then
        log "PostgreSQL ready"
        break
    fi
    sleep 2
    if [[ $i -eq 30 ]]; then
        err "PostgreSQL did not become ready in 60s"
        exit 1
    fi
done

# Wait for n8n
info "Waiting for n8n..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:5678/healthz &>/dev/null; then
        log "n8n ready"
        break
    fi
    sleep 3
    if [[ $i -eq 60 ]]; then
        err "n8n did not become ready in 180s"
        docker compose logs n8n >> "$LOG_FILE" 2>&1
        exit 1
    fi
done

# ─── Step 7: Create n8n owner (admin user) + API key ──────────
step "7" "Creating n8n admin user"

N8N_ADMIN_EMAIL="${N8N_ADMIN_EMAIL:-$ADMIN_EMAIL}"
N8N_ADMIN_PASSWORD="${N8N_ADMIN_PASSWORD:-$ADMIN_PASSWORD}"

# Try to set up owner via n8n CLI inside container
info "Setting up n8n owner account..."
docker compose exec -T n8n n8n user-management:create-owner \
    --email "$N8N_ADMIN_EMAIL" \
    --password "$N8N_ADMIN_PASSWORD" \
    --firstName "Admin" \
    --lastName "Bot" >> "$LOG_FILE" 2>&1 || warn "Owner may already exist"

# Login and get API key
info "Obtaining n8n API key..."
LOGIN_RESP=$(curl -s -X POST http://localhost:5678/api/v1/login \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$N8N_ADMIN_EMAIL\", \"password\": \"$N8N_ADMIN_PASSWORD\"}" 2>/dev/null || echo "{}")

# Extract cookie for subsequent requests
LOGIN_COOKIE=$(echo "$LOGIN_RESP" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    print(r.get('data', {}).get('cookie', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [[ -z "$LOGIN_COOKIE" ]]; then
    # Try alternative: use the session from response headers
    warn "Could not extract login cookie via JSON. Trying cookie-based auth..."
    LOGIN_COOKIE_FILE="/tmp/n8n_cookies.txt"
    curl -s -c "$LOGIN_COOKIE_FILE" -X POST http://localhost:5678/api/v1/login \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$N8N_ADMIN_EMAIL\", \"password\": \"$N8N_ADMIN_PASSWORD\"}" > /dev/null 2>&1

    # Create API key using cookie auth
    API_KEY_RESP=$(curl -s -b "$LOGIN_COOKIE_FILE" -X POST http://localhost:5678/api/v1/api-keys \
        -H "Content-Type: application/json" \
        -d '{"label": "avatar-bot-deploy"}' 2>/dev/null || echo "{}")
else
    API_KEY_RESP=$(curl -s -X POST http://localhost:5678/api/v1/api-keys \
        -H "Content-Type: application/json" \
        -H "Cookie: $LOGIN_COOKIE" \
        -d '{"label": "avatar-bot-deploy"}' 2>/dev/null || echo "{}")
fi

N8N_API_KEY=$(echo "$API_KEY_RESP" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    # Could be directly the key or nested in data
    key = r.get('apiKey', r.get('data', {}).get('apiKey', ''))
    print(key)
except:
    print('')
" 2>/dev/null || echo "")

if [[ -z "$N8N_API_KEY" ]]; then
    warn "Could not create API key automatically."
    warn "Please create one manually in n8n UI: https://$DOMAIN/n8n/ -> Settings -> API"
    read -p "Paste your n8n API key here: " N8N_API_KEY
fi

# Save API URL and key
N8N_API_URL="http://localhost:5678/api/v1"
echo "N8N_API_URL=\"$N8N_API_URL\"" >> "$CONFIG_FILE"
echo "N8N_API_KEY=\"$N8N_API_KEY\"" >> "$CONFIG_FILE"

# Reload
set -a
source "$CONFIG_FILE"
set +a

log "n8n admin configured"

# ─── Step 8: Create n8n credentials ───────────────────────────
step "8" "Creating n8n credentials (PostgreSQL + S3)"

# Install python requests if not available
pip3 install requests -q >> "$LOG_FILE" 2>&1 || true

export N8N_API_URL N8N_API_KEY POSTGRES_PASSWORD
export POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_USER="${POSTGRES_USER:-avatar_bot}"

python3 "$DEPLOY_DIR/scripts/create_credentials.py"

log "n8n credentials created"

# ─── Step 9: Import n8n workflows ─────────────────────────────
step "9" "Importing n8n workflows"

python3 "$DEPLOY_DIR/scripts/import_workflows.py"

log "Workflows imported"

# ─── Step 10: S3 Upload Service ───────────────────────────────
step "10" "Setting up S3 Upload Service"

S3_SERVICE_DIR="/opt/s3-upload-service"
mkdir -p "$S3_SERVICE_DIR/logs"

cp "$DEPLOY_DIR/s3-upload-service/server.js" "$S3_SERVICE_DIR/"
cp "$DEPLOY_DIR/s3-upload-service/package.json" "$S3_SERVICE_DIR/"
cp "$DEPLOY_DIR/s3-upload-service/ecosystem.config.js" "$S3_SERVICE_DIR/"

cd "$S3_SERVICE_DIR"
npm install --production >> "$LOG_FILE" 2>&1

# Set environment variables for PM2
export S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET S3_ENDPOINT
export S3_REGION="${S3_REGION:-ru-1}"
export PORT=3001

pm2 delete s3-upload-service 2>/dev/null || true
S3_ACCESS_KEY="$S3_ACCESS_KEY" \
S3_SECRET_KEY="$S3_SECRET_KEY" \
S3_BUCKET="$S3_BUCKET" \
S3_ENDPOINT="$S3_ENDPOINT" \
S3_REGION="$S3_REGION" \
PORT=3001 \
pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1

pm2 save >> "$LOG_FILE" 2>&1
pm2 startup systemd -u root --hp /root >> "$LOG_FILE" 2>&1 || true

log "S3 Upload Service started on port 3001"

# ─── Step 11: Build Frontend ─────────────────────────────────
step "11" "Building frontend"

FRONTEND_DIR="$DEPLOY_DIR/frontend"
WEB_ROOT="/var/www/avatar-bot"

if [[ ! -d "$FRONTEND_DIR" ]]; then
    # If frontend directory doesn't exist in deploy package,
    # check if we're inside the main project
    if [[ -f "$DEPLOY_DIR/../package.json" ]] && grep -q "avatar-bot-miniapp" "$DEPLOY_DIR/../package.json" 2>/dev/null; then
        FRONTEND_DIR="$DEPLOY_DIR/.."
    else
        err "Frontend source not found. Place React source in avatar-bot-deploy/frontend/"
        exit 1
    fi
fi

cd "$FRONTEND_DIR"

# Create .env.production for the build
cat > .env.production <<EOF
VITE_API_BASE=https://${DOMAIN}/webhook
VITE_BOT_USERNAME=${BOT_USERNAME}
EOF

npm install >> "$LOG_FILE" 2>&1
npm run build >> "$LOG_FILE" 2>&1

# Deploy built files
mkdir -p "$WEB_ROOT"
rm -rf "$WEB_ROOT"/*
cp -r dist/* "$WEB_ROOT/"

log "Frontend built and deployed to $WEB_ROOT"

# ─── Step 12: Configure Nginx ─────────────────────────────────
step "12" "Configuring Nginx"

cd "$DEPLOY_DIR"

# Generate nginx config from template
export DOMAIN
envsubst '${DOMAIN}' < nginx/site.conf.template > /etc/nginx/sites-available/avatar-bot.conf

# Enable site
ln -sf /etc/nginx/sites-available/avatar-bot.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart
nginx -t >> "$LOG_FILE" 2>&1
systemctl restart nginx

log "Nginx configured and restarted"

# ─── Step 13: Setup Telegram Bot ──────────────────────────────
step "13" "Setting up Telegram bot"

chmod +x "$DEPLOY_DIR/scripts/setup_telegram.sh"
bash "$DEPLOY_DIR/scripts/setup_telegram.sh"

log "Telegram bot configured"

# ─── Step 14: Health Check ────────────────────────────────────
step "14" "Running health checks"

chmod +x "$DEPLOY_DIR/scripts/healthcheck.sh"
bash "$DEPLOY_DIR/scripts/healthcheck.sh"

# ─── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Avatar Bot installed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Domain:     https://$DOMAIN"
echo "  n8n Editor: https://$DOMAIN/n8n/"
echo "  n8n Login:  $N8N_ADMIN_EMAIL / $N8N_ADMIN_PASSWORD"
echo "  Bot:        @$BOT_USERNAME"
echo "  Mini App:   https://$MINIAPP_URL"
echo ""
echo "  Admin password (for bot admin panel): $ADMIN_PASSWORD"
echo ""
echo "  Full log: $LOG_FILE"
echo ""
info "Send /start to @$BOT_USERNAME to test!"
