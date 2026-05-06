# Codex Project Memory

Captured: 2026-05-06

## Project

- Repository: `Roman72-186/avatar-bot-miniapp`
- Local path: `c:\Users\User\Desktop\Project\avatar-bot-miniapp`
- Main Mini App URL: `https://avatar-bot-miniapp.vercel.app/?v=20260506-2`
- n8n editor URL: `https://n8n.creativeanalytic.ru/`
- n8n server host alias: `server-main`
- n8n version after update: `2.19.2`

## Current Server Layout

- n8n runs in Docker Compose at `/root/n8n`.
- n8n container listens locally on `127.0.0.1:5678`.
- Public HTTPS for n8n is served through nginx on port `8443`.
- Port `443` is occupied by another service, so n8n must stay on `8443`.
- n8n compose uses:
  - `WEBHOOK_URL=https://n8n.creativeanalytic.ru/`
  - `N8N_EDITOR_BASE_URL=https://n8n.creativeanalytic.ru/`
  - `N8N_PROXY_HOPS=1`
- Known non-blocking log warning: Python task runner cannot start because the n8n image has no Python. JS task runner works and Mini App workflows use JS.

## Completed Fixes

- Updated n8n to version `2.19.2`.
- n8n public access currently works on `https://n8n.creativeanalytic.ru/`.
- Fixed Mini App frontend API webhook base URL to include `:8443`.
- Vercel CSP allows `https://n8n.creativeanalytic.ru`.
- Pushed latest local fixes to GitHub.
- Updated Telegram Mini App menu/button URL to cache-busted app URL.
- Replaced old internal n8n webhook URLs without `:8443`.
- Browser E2E check confirmed:
  - photo preview works
  - generate button enables
  - browser sends requests to n8n webhook on `:8443`
  - no CSP block

## S3 / Kie.ai Timeout Fix

Observed user error:

```text
HTTPSConnectionPool(host='avatar-bot-generations.s3.twcstorage.ru', port=443): Read timed out. (read timeout=10)
```

Diagnosis:

- n8n was receiving Mini App requests.
- Photos were uploaded to Timeweb S3 and were publicly readable from local machine and server.
- Kie.ai intermittently timed out when reading the Timeweb virtual-host S3 URL.

Fixes applied in n8n workflows:

- Replaced S3 public URL format from:
  - `https://avatar-bot-generations.s3.twcstorage.ru/...`
- To:
  - `https://s3.timeweb.cloud/avatar-bot-generations/...`
- Added preflight/retry before Kie.ai task creation so workflows wait briefly until the uploaded S3 image is publicly readable.

Affected workflows:

- `[MINIAPP] generate`
- `[MINIAPP] generate-enhance`
- `[MINIAPP] generate-multi`
- `[MINIAPP] generate-remove-bg`
- `[MINIAPP] generate-style-transfer`
- `[MINIAPP] generate-video`
- Matching `[DEV] [MINIAPP] ...` variants

Verification:

- n8n restarted successfully.
- All active workflows loaded.
- Changed JS code nodes passed syntax checks.
- Old operational S3 URL usage removed; only compatibility replacement remains where needed.

Backup before S3 preflight change:

- `/root/n8n/backups/workflow_entity-before-s3-preflight-20260506-083150.sql`

## Telegram `/start` and Menu Button Fix

User requested:

- Create a welcome message sent by `/start`.
- Add button `Открыть`.
- Rename broken `????` menu/button to `Визуализатор`.

Fixes applied:

- Updated `[MINIAPP] bot-start-handler`.
- Updated `[DEV] [MINIAPP] bot-start-handler`.
- Updated `[MINIAPP] welcome-delayed-message`.
- `/start` now sends a normal HTML welcome message for `Визуализатор`.
- Inline buttons now use text `Открыть`.
- Telegram chat menu button is set to `Визуализатор`.
- Bot commands updated:
  - `/start` - open Visualizer
  - `/inforef` - partner program
- Applied to:
  - prod bot `@those_are_the_gifts_bot`
  - dev bot `@nutriiiiiic_bot`

Important implementation note:

- Cyrillic text sent through the Windows/SSH path can become literal `????`.
- For n8n workflow JSON and Telegram API writes, use Unicode-safe strings or codepoint construction to avoid terminal encoding corruption.

Verification:

- n8n restarted successfully after changes.
- n8n health check returned `200`.
- Mini App returned `200`.
- Telegram menu button check returned:
  - `menu_type=web_app`
  - `text_ok=True`
  - `url_ok=True`
- Target Mini App workflows no longer contain `????`.
- Missing `welcome_text` references removed.

Backup before `/start` welcome change:

- `/root/n8n/backups/workflow_entity-before-start-welcome-20260506-091600.sql`

## Security Notes

- Do not store Telegram bot tokens, n8n passwords, Kie keys, or initData in this file.
- When checking workflows, avoid printing full node JSON if it contains API tokens.
- For replay tests with real Telegram initData or paid Kie.ai workflows, ask before triggering anything that may consume balance.

## Useful Checks

```powershell
ssh -o BatchMode=yes -o ConnectTimeout=20 server-main "curl -k -sS -o /dev/null -w 'n8n_health=%{http_code}\n' https://n8n.creativeanalytic.ru/healthz"
```

```powershell
ssh -o BatchMode=yes -o ConnectTimeout=20 server-main "cd /root/n8n && docker compose ps && docker logs --tail 120 n8n-n8n-1 2>&1"
```

```powershell
git status --short
```
