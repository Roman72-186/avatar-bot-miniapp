"""
Update referral system:
1. ALTER TABLE: add ref_bonus_given, ref_earnings, ref_paid_count
2. Update bot-start-handler:
   - Remove old free gen bonus from Process Referral
   - Add Has Referrer? IF → Process Referral → Notify Ref Signup
   - Add Check Referral → Has Unpaid Ref? → Apply Ref Bonus → Notify Ref Paid
3. Create referral-stats workflow

Tier system: paid_count 0-4 → +1⭐, 5-9 → +2⭐, 10-14 → +3⭐, etc.
Formula: FLOOR(ref_paid_count / 5) + 1
Trigger: referral's FIRST payment only
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


def run_sql(sql, label=""):
    """Run SQL via temp workflow."""
    name = f"temp-sql-{label or 'run'}"
    temp_wf = api_post("/workflows", {
        "name": name,
        "nodes": [
            {
                "id": "wh1", "name": "Webhook", "type": "n8n-nodes-base.webhook",
                "typeVersion": 2, "position": [250, 300],
                "webhookId": name,
                "parameters": {
                    "path": name, "httpMethod": "POST",
                    "responseMode": "lastNode", "options": {}
                }
            },
            {
                "id": "sql1", "name": "Run SQL", "type": "n8n-nodes-base.postgres",
                "typeVersion": 2.5, "position": [500, 300],
                "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
                "parameters": {"operation": "executeQuery", "query": sql, "options": {}}
            }
        ],
        "connections": {
            "Webhook": {"main": [[{"node": "Run SQL", "type": "main", "index": 0}]]}
        },
        "settings": {"executionOrder": "v1"}
    })
    tid = temp_wf["id"]
    api_post(f"/workflows/{tid}/activate")
    time.sleep(1)
    req = urllib.request.Request(f"{N8N}/webhook/{name}", data=b'{}', method="POST")
    req.add_header("Content-Type", "application/json")
    resp = urllib.request.urlopen(req, context=ctx)
    print(f"  SQL ({label}): HTTP {resp.status}")
    api_post(f"/workflows/{tid}/deactivate")
    req_del = urllib.request.Request(f"{N8N}/api/v1/workflows/{tid}", method="DELETE")
    req_del.add_header("X-N8N-API-KEY", API_KEY)
    urllib.request.urlopen(req_del, context=ctx)


# ============================================================
# Step 1: ALTER TABLE
# ============================================================
print("1. Adding referral columns...")
run_sql(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_bonus_given BOOLEAN DEFAULT FALSE;"
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_earnings INTEGER DEFAULT 0;"
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_paid_count INTEGER DEFAULT 0;",
    "ref-cols"
)
print("  Done!")


# ============================================================
# Step 2: Update bot-start-handler
# ============================================================
print("\n2. Updating bot-start-handler...")
wf_id = "G52H2goZzpFSLUSa"
wf = api_get(f"/workflows/{wf_id}")

# --- Update Process Referral: remove free gen bonus, fix expression refs ---
for node in wf["nodes"]:
    if node["name"] == "Process Referral":
        node["parameters"]["query"] = (
            '=DO $$\n'
            'DECLARE\n'
            '  v_new_user TEXT := \'{{ $("Route Update").first().json.user_id }}\';\n'
            '  v_referrer TEXT := \'{{ $("Route Update").first().json.referrer_id }}\';\n'
            'BEGIN\n'
            '  IF v_referrer = \'\' OR v_referrer = v_new_user THEN RETURN; END IF;\n'
            '  INSERT INTO users (id, created_at) VALUES (v_new_user, NOW()) ON CONFLICT (id) DO NOTHING;\n'
            '  UPDATE users SET referred_by = v_referrer WHERE id = v_new_user AND referred_by IS NULL;\n'
            'END $$;'
        )
        node["position"] = [1250, 600]
        print("  Updated Process Referral (removed free gen bonus)")

# --- Add new nodes ---
new_nodes = [
    # Has Referrer? — IF after Send Photo, before Process Referral
    {
        "id": "has_ref",
        "name": "Has Referrer?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": [1000, 600],
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": ""},
                "conditions": [{
                    "id": "cond_has_ref",
                    "leftValue": '={{ $("Route Update").first().json.referrer_id }}',
                    "rightValue": "",
                    "operator": {"type": "string", "operation": "notEquals"}
                }],
                "combinator": "and"
            },
            "options": {"looseTypeValidation": True}
        }
    },
    # Notify Referrer about new signup
    {
        "id": "notify_signup",
        "name": "Notify Ref Signup",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1550, 600],
        "parameters": {
            "method": "POST",
            "url": f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": (
                '={"chat_id":"{{ $("Route Update").first().json.referrer_id }}",'
                '"text":"\\ud83d\\udc64 \\u041d\\u043e\\u0432\\u044b\\u0439 \\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u0442\\u0435\\u043b\\u044c \\u043f\\u0435\\u0440\\u0435\\u0448\\u0451\\u043b \\u043f\\u043e \\u0432\\u0430\\u0448\\u0435\\u0439 \\u0440\\u0435\\u0444\\u0435\\u0440\\u0430\\u043b\\u044c\\u043d\\u043e\\u0439 \\u0441\\u0441\\u044b\\u043b\\u043a\\u0435!",'
                '"parse_mode":"HTML"}'
            ),
            "options": {"response": {"response": {"neverError": True}}}
        }
    },
    # Check Referral — after Update Balance on payment
    {
        "id": "check_ref",
        "name": "Check Referral",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [1250, 300],
        "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
        "parameters": {
            "operation": "executeQuery",
            "query": (
                "=SELECT COALESCE("
                "(SELECT referred_by FROM users"
                ' WHERE id = \'{{ $("Route Update").first().json.user_id }}\''
                " AND referred_by IS NOT NULL AND referred_by != ''"
                " AND (ref_bonus_given IS NULL OR ref_bonus_given = false)),"
                " '') as referred_by"
            ),
            "options": {}
        }
    },
    # Has Unpaid Ref? — IF check on Check Referral result
    {
        "id": "has_unpaid_ref",
        "name": "Has Unpaid Ref?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": [1500, 300],
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": ""},
                "conditions": [{
                    "id": "cond_unpaid_ref",
                    "leftValue": "={{ $json.referred_by }}",
                    "rightValue": "",
                    "operator": {"type": "string", "operation": "notEquals"}
                }],
                "combinator": "and"
            },
            "options": {"looseTypeValidation": True}
        }
    },
    # Apply Ref Bonus — CTE: calc tier, add stars, update counters
    {
        "id": "apply_bonus",
        "name": "Apply Ref Bonus",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [1750, 300],
        "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
        "parameters": {
            "operation": "executeQuery",
            "query": (
                "=WITH referral AS (\n"
                "  SELECT referred_by FROM users\n"
                '  WHERE id = \'{{ $("Route Update").first().json.user_id }}\'\n'
                "),\n"
                "calc AS (\n"
                "  SELECT\n"
                "    u.id as referrer_id,\n"
                "    (COALESCE(u.ref_paid_count, 0) / 5) + 1 as bonus\n"
                "  FROM users u\n"
                "  JOIN referral r ON u.id = r.referred_by\n"
                "),\n"
                "upd_referrer AS (\n"
                "  UPDATE users SET\n"
                "    star_balance = COALESCE(star_balance, 0) + c.bonus,\n"
                "    ref_paid_count = COALESCE(ref_paid_count, 0) + 1,\n"
                "    ref_earnings = COALESCE(ref_earnings, 0) + c.bonus\n"
                "  FROM calc c\n"
                "  WHERE users.id = c.referrer_id\n"
                "  RETURNING users.id\n"
                "),\n"
                "upd_user AS (\n"
                "  UPDATE users SET ref_bonus_given = true\n"
                '  WHERE id = \'{{ $("Route Update").first().json.user_id }}\'\n'
                ")\n"
                "SELECT c.referrer_id, c.bonus FROM calc c;"
            ),
            "options": {}
        }
    },
    # Notify Referrer about payment bonus
    {
        "id": "notify_paid",
        "name": "Notify Ref Paid",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [2000, 300],
        "parameters": {
            "method": "POST",
            "url": f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": (
                '={"chat_id":"{{ $json.referrer_id }}",'
                '"text":"\\ud83c\\udf89 \\u0412\\u0430\\u0448 \\u0440\\u0435\\u0444\\u0435\\u0440\\u0430\\u043b \\u043f\\u043e\\u043f\\u043e\\u043b\\u043d\\u0438\\u043b \\u0431\\u0430\\u043b\\u0430\\u043d\\u0441!\\n\\u0412\\u0430\\u043c \\u043d\\u0430\\u0447\\u0438\\u0441\\u043b\\u0435\\u043d\\u043e <b>+{{ $json.bonus }} \\u2b50</b>",'
                '"parse_mode":"HTML"}'
            ),
            "options": {"response": {"response": {"neverError": True}}}
        }
    },
]

wf["nodes"].extend(new_nodes)

# --- Update connections ---
conns = wf["connections"]

# Send Photo → Has Referrer? (instead of → Process Referral)
conns["Send Photo"] = {"main": [[{"node": "Has Referrer?", "type": "main", "index": 0}]]}

# Has Referrer? true → Process Referral, false → nothing
conns["Has Referrer?"] = {"main": [
    [{"node": "Process Referral", "type": "main", "index": 0}],
    []
]}

# Process Referral → Notify Ref Signup
conns["Process Referral"] = {"main": [[{"node": "Notify Ref Signup", "type": "main", "index": 0}]]}

# Update Balance → Check Referral
conns["Update Balance"] = {"main": [[{"node": "Check Referral", "type": "main", "index": 0}]]}

# Check Referral → Has Unpaid Ref?
conns["Check Referral"] = {"main": [[{"node": "Has Unpaid Ref?", "type": "main", "index": 0}]]}

# Has Unpaid Ref? true → Apply Ref Bonus, false → nothing
conns["Has Unpaid Ref?"] = {"main": [
    [{"node": "Apply Ref Bonus", "type": "main", "index": 0}],
    []
]}

# Apply Ref Bonus → Notify Ref Paid
conns["Apply Ref Bonus"] = {"main": [[{"node": "Notify Ref Paid", "type": "main", "index": 0}]]}

# Push updated workflow
api_put(f"/workflows/{wf_id}", {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": conns,
    "settings": wf.get("settings", {})
})
api_post(f"/workflows/{wf_id}/activate")
print("  Workflow updated and activated!")


# ============================================================
# Step 3: Create referral-stats workflow
# ============================================================
print("\n3. Creating referral-stats workflow...")

ref_stats_wf = api_post("/workflows", {
    "name": "referral-stats",
    "nodes": [
        {
            "id": "wh", "name": "Webhook", "type": "n8n-nodes-base.webhook",
            "typeVersion": 2, "position": [250, 300],
            "webhookId": "referral-stats",
            "parameters": {
                "path": "referral-stats", "httpMethod": "POST",
                "responseMode": "lastNode", "options": {}
            }
        },
        {
            "id": "stats", "name": "Get Stats", "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5, "position": [500, 300],
            "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
            "parameters": {
                "operation": "executeQuery",
                "query": (
                    "=SELECT\n"
                    "  COALESCE((SELECT COUNT(*)::int FROM users WHERE referred_by = '{{ $json.body.user_id }}'), 0) as total_referrals,\n"
                    "  COALESCE((SELECT ref_paid_count FROM users WHERE id = '{{ $json.body.user_id }}'), 0)::int as paid_referrals,\n"
                    "  COALESCE((SELECT ref_earnings FROM users WHERE id = '{{ $json.body.user_id }}'), 0)::int as total_earnings,\n"
                    "  COALESCE(\n"
                    "    (SELECT json_agg(row_to_json(r))\n"
                    "     FROM (\n"
                    "       SELECT id, username, created_at, COALESCE(ref_bonus_given, false) as paid\n"
                    "       FROM users\n"
                    "       WHERE referred_by = '{{ $json.body.user_id }}'\n"
                    "       ORDER BY created_at DESC\n"
                    "       LIMIT 10\n"
                    "     ) r\n"
                    "    ),\n"
                    "    '[]'::json\n"
                    "  ) as recent_referrals"
                ),
                "options": {}
            }
        }
    ],
    "connections": {
        "Webhook": {"main": [[{"node": "Get Stats", "type": "main", "index": 0}]]}
    },
    "settings": {"executionOrder": "v1"}
})

ref_stats_id = ref_stats_wf["id"]
api_post(f"/workflows/{ref_stats_id}/activate")
print(f"  Created and activated! ID: {ref_stats_id}")


# ============================================================
# Verify
# ============================================================
print("\n4. Verifying...")
wf2 = api_get(f"/workflows/{wf_id}")
node_names = [n["name"] for n in wf2["nodes"]]
print(f"  Nodes: {node_names}")
print(f"  Update Balance →: {wf2['connections'].get('Update Balance', {})}")
print(f"  Send Photo →: {wf2['connections'].get('Send Photo', {})}")
print(f"  Has Referrer? →: {wf2['connections'].get('Has Referrer?', {})}")
print(f"  Process Referral →: {wf2['connections'].get('Process Referral', {})}")
print(f"  Check Referral →: {wf2['connections'].get('Check Referral', {})}")
print(f"  Has Unpaid Ref? →: {wf2['connections'].get('Has Unpaid Ref?', {})}")
print(f"  Apply Ref Bonus →: {wf2['connections'].get('Apply Ref Bonus', {})}")

print("\nDone! Referral system updated.")
print("  Tier: FLOOR(paid_count/5)+1 stars per referral")
print("  Trigger: referral's FIRST star payment")
print("  Notifications: signup + first payment")
