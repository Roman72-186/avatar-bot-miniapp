"""
Add referral system:
1. ALTER TABLE users ADD referred_by
2. Update bot-start-handler Route Update to parse /start ref_USERID
3. Add Process Referral node after Send Photo
"""
import json
import urllib.request
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YjlmMzhmMC0wZGZlLTQwNGEtYTY3Ny1iYTU0MGJiZjUwYzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcwNjUwNzk0LCJleHAiOjE3NzMyMDE2MDB9.UVG3WEUUhsglQ8h4SZ92jp1JzTcJ_UQYiSp6r0Fk7jY"
BOT_TOKEN = "6939723174:AAE59AdG4oigMzBmWQQmxbUiidm562T_Fnc"
N8N = "https://n8n.creativeanalytic.ru"
POSTGRES_CRED_ID = "UirFNzTALE9CZEcQ"


def api_put(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{N8N}/api/v1{path}", data=body, method="PUT")
    req.add_header("X-N8N-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")
    return json.loads(urllib.request.urlopen(req, context=ctx).read().decode())


def api_post(path, data=None):
    body = json.dumps(data or {}).encode()
    req = urllib.request.Request(f"{N8N}/api/v1{path}", data=body, method="POST")
    req.add_header("X-N8N-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")
    return json.loads(urllib.request.urlopen(req, context=ctx).read().decode())


def api_get(path):
    req = urllib.request.Request(f"{N8N}/api/v1{path}", method="GET")
    req.add_header("X-N8N-API-KEY", API_KEY)
    return json.loads(urllib.request.urlopen(req, context=ctx).read().decode())


# ============================================================
# Step 1: ALTER TABLE - add referred_by column
# ============================================================
print("1. Adding referred_by column...")

temp_wf = api_post("/workflows", {
    "name": "temp-referral-alter",
    "nodes": [
        {
            "id": "wh1", "name": "Webhook", "type": "n8n-nodes-base.webhook",
            "typeVersion": 2, "position": [250, 300],
            "webhookId": "temp-referral-alter",
            "parameters": {
                "path": "temp-referral-alter", "httpMethod": "POST",
                "responseMode": "lastNode", "options": {}
            }
        },
        {
            "id": "sql1", "name": "Run SQL", "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5, "position": [500, 300],
            "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
            "parameters": {
                "operation": "executeQuery",
                "query": "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;",
                "options": {}
            }
        }
    ],
    "connections": {
        "Webhook": {"main": [[{"node": "Run SQL", "type": "main", "index": 0}]]}
    },
    "settings": {"executionOrder": "v1"}
})
temp_id = temp_wf["id"]
api_post(f"/workflows/{temp_id}/activate")
time.sleep(1)

req = urllib.request.Request(f"{N8N}/webhook/temp-referral-alter", data=b'{}', method="POST")
req.add_header("Content-Type", "application/json")
resp = urllib.request.urlopen(req, context=ctx)
print(f"  ALTER result: HTTP {resp.status}")

api_post(f"/workflows/{temp_id}/deactivate")
req_del = urllib.request.Request(f"{N8N}/api/v1/workflows/{temp_id}", method="DELETE")
req_del.add_header("X-N8N-API-KEY", API_KEY)
urllib.request.urlopen(req_del, context=ctx)
print("  Cleaned up.")


# ============================================================
# Step 2: Update bot-start-handler
# ============================================================
print("\n2. Updating bot-start-handler workflow...")
wf_id = "G52H2goZzpFSLUSa"
wf = api_get(f"/workflows/{wf_id}")

# Updated Route Update code - parses ref_USERID from /start
new_router_code = r"""const body = $input.first().json.body || $input.first().json;

// 1. Handle pre_checkout_query
if (body.pre_checkout_query) {
  return [{json: {
    action: "pre_checkout",
    pre_checkout_query_id: body.pre_checkout_query.id
  }}];
}

const message = body.message;
if (!message) return [];

// 2. Handle successful_payment
if (message.successful_payment) {
  const payment = message.successful_payment;
  let payload = {};
  try { payload = JSON.parse(payment.invoice_payload); } catch(e) {}
  return [{json: {
    action: "payment",
    user_id: payload.user_id || String(message.from.id),
    stars: payload.stars || payment.total_amount,
    charge_id: payment.telegram_payment_charge_id
  }}];
}

// 3. Handle /start command
if (message.text && message.text.startsWith("/start")) {
  // Parse referral: /start ref_123456
  const parts = message.text.split(" ");
  let referrer_id = "";
  if (parts.length > 1 && parts[1].startsWith("ref_")) {
    referrer_id = parts[1].substring(4);
  }

  const photos = [
    "https://v3b.fal.media/files/b/0a8e0d2f/gEMpmNLzXYFtNd_QBifK8.jpg",
    "https://v3b.fal.media/files/b/0a8e0d30/NxJ3LXVjJhLkAbfAakWjt.jpg",
    "https://v3b.fal.media/files/b/0a8e0d31/rZewaTG7IKXztThMC6ZFp.jpg",
    "https://v3b.fal.media/files/b/0a8e0d32/URQAXaoew19LsSBcxGrk-.jpg"
  ];
  const randomPhoto = photos[Math.floor(Math.random() * photos.length)];

  const caption = "\ud83c\udfa8 <b>Avatar Studio AI</b>\n\n" +
    "AI-\u0433\u0435\u043d\u0435\u0440\u0430\u0442\u043e\u0440 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439 \u0438 \u0432\u0438\u0434\u0435\u043e \u043f\u0440\u044f\u043c\u043e \u0432 Telegram!\n\n" +
    "<b>\u0427\u0442\u043e \u0443\u043c\u0435\u0435\u0442 \u0431\u043e\u0442:</b>\n" +
    "\ud83c\udfa8 \u0421\u0442\u0438\u043b\u0438\u0437\u0430\u0446\u0438\u044f \u2014 \u043f\u0440\u0435\u0432\u0440\u0430\u0442\u0438 \u0444\u043e\u0442\u043e \u0432 \u0430\u0440\u0442\n" +
    "\ud83d\uddbc\ufe0f \u041c\u0443\u043b\u044c\u0442\u0438-\u0444\u043e\u0442\u043e \u2014 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u0438\u0437 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u0438\u0445 \u0444\u043e\u0442\u043e\n" +
    "\ud83e\ude84 \u041f\u043e \u0440\u0435\u0444\u0435\u0440\u0435\u043d\u0441\u0443 \u2014 \u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0438 \u0441\u0442\u0438\u043b\u044c\n" +
    "\ud83c\udfac \u0424\u043e\u0442\u043e \u0432 \u0432\u0438\u0434\u0435\u043e \u2014 \u043e\u0436\u0438\u0432\u0438 \u0444\u043e\u0442\u043e\n" +
    "\ud83d\udd04 Face Swap \u2014 \u0437\u0430\u043c\u0435\u043d\u0430 \u043b\u0438\u0446\u0430\n" +
    "\u2702\ufe0f \u0423\u0431\u0440\u0430\u0442\u044c \u0444\u043e\u043d\n" +
    "\u2728 \u0423\u043b\u0443\u0447\u0448\u0438\u0442\u044c \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0444\u043e\u0442\u043e\n" +
    "\ud83d\udcac \u0422\u0435\u043a\u0441\u0442 \u0432 \u0444\u043e\u0442\u043e \u2014 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043f\u043e \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044e\n\n" +
    "\ud83c\udf1f <b>3 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0445 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u043a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c!</b>";

  return [{json: {
    action: "start",
    chat_id: message.chat.id,
    user_id: String(message.from.id),
    referrer_id: referrer_id,
    photo: randomPhoto,
    caption: caption,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{
        text: "\ud83d\ude80 \u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435",
        web_app: { url: "https://avatar-bot-miniapp.vercel.app/" }
      }]]
    })
  }}];
}

return [];"""

# Find and update nodes
for node in wf["nodes"]:
    if node["name"] == "Route Update":
        node["parameters"]["jsCode"] = new_router_code
        print("  Updated Route Update code (with referral parsing)")

# Add Process Referral node
referral_node = {
    "id": "ref1",
    "name": "Process Referral",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [1300, 500],
    "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
    "parameters": {
        "operation": "executeQuery",
        "query": """=DO $$
DECLARE
  v_new_user TEXT := '{{ $json.user_id }}';
  v_referrer TEXT := '{{ $json.referrer_id }}';
BEGIN
  IF v_referrer = '' OR v_referrer = v_new_user THEN RETURN; END IF;

  -- Ensure new user exists
  INSERT INTO users (id, created_at) VALUES (v_new_user, NOW()) ON CONFLICT (id) DO NOTHING;

  -- Set referred_by only if not already set
  UPDATE users SET referred_by = v_referrer WHERE id = v_new_user AND referred_by IS NULL;

  -- If update actually happened (referral is new), give bonus to referrer
  IF FOUND THEN
    UPDATE users SET
      free_stylize = free_stylize + 1,
      free_remove_bg = free_remove_bg + 1,
      free_enhance = free_enhance + 1
    WHERE id = v_referrer;
  END IF;
END $$;""",
        "options": {}
    }
}

# Add node
wf["nodes"].append(referral_node)

# Add connection: Send Photo -> Process Referral
conns = wf["connections"]
if "Send Photo" not in conns:
    conns["Send Photo"] = {"main": [[]]}
conns["Send Photo"]["main"][0].append({
    "node": "Process Referral", "type": "main", "index": 0
})

api_put(f"/workflows/{wf_id}", {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": conns,
    "settings": wf.get("settings", {})
})
api_post(f"/workflows/{wf_id}/activate")
print("  Workflow updated and activated!")


# ============================================================
# Verify
# ============================================================
print("\n3. Verifying...")
wf2 = api_get(f"/workflows/{wf_id}")
node_names = [n["name"] for n in wf2["nodes"]]
print(f"  Nodes: {node_names}")
print(f"  Send Photo connections: {wf2['connections'].get('Send Photo', {})}")

print("\nDone! Referral system active.")
print("  Link format: t.me/those_are_the_gifts_bot?start=ref_USERID")
print("  Bonus: +1 free gen for each mode (stylize, remove_bg, enhance)")
