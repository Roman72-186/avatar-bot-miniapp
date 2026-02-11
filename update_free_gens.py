"""
Update free generations: distribute 3/day across 3 modes (1 each):
- free_stylize (1/day)
- free_remove_bg (1/day)
- free_enhance (1/day)

Steps:
1. ALTER TABLE: add 3 new columns
2. Update user-status workflow
3. Update generate (stylize) workflow
4. Update generate-remove-bg workflow
5. Update generate-enhance workflow
6. Create daily cron reset workflow
"""
import json
import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YjlmMzhmMC0wZGZlLTQwNGEtYTY3Ny1iYTU0MGJiZjUwYzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcwNjUwNzk0LCJleHAiOjE3NzMyMDE2MDB9.UVG3WEUUhsglQ8h4SZ92jp1JzTcJ_UQYiSp6r0Fk7jY"
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


def activate(wf_id):
    api_post(f"/workflows/{wf_id}/activate")


def update_workflow(wf_id, updates):
    """Fetch workflow, update specific nodes, save and activate."""
    wf = api_get(f"/workflows/{wf_id}")
    for node in wf["nodes"]:
        if node["name"] in updates:
            for key, val in updates[node["name"]].items():
                if key == "parameters":
                    node["parameters"].update(val)
                else:
                    node[key] = val
    api_put(f"/workflows/{wf_id}", {
        "name": wf["name"],
        "nodes": wf["nodes"],
        "connections": wf["connections"],
        "settings": wf.get("settings", {})
    })
    activate(wf_id)


# ============================================================
# Step 1: ALTER TABLE - add per-mode free columns
# ============================================================
print("1. Altering users table (adding free_stylize, free_remove_bg, free_enhance)...")

# We'll use the user-status workflow to run the ALTER temporarily.
# Actually, let's create a quick one-shot webhook to run the SQL.

alter_sql = """
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_stylize INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_remove_bg INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_enhance INT DEFAULT 1;

-- Initialize for existing users: set to 1 if it's still today, 0 if they already used free gens
UPDATE users SET
  free_stylize = CASE WHEN free_generations >= 3 THEN 1 WHEN free_generations >= 1 THEN 1 ELSE 0 END,
  free_remove_bg = 1,
  free_enhance = 1
WHERE free_stylize IS NULL OR free_remove_bg IS NULL OR free_enhance IS NULL;
"""

# Create a temporary workflow to run the ALTER
temp_wf = api_post("/workflows", {
    "name": "temp-alter-table",
    "nodes": [
        {
            "id": "wh1", "name": "Webhook", "type": "n8n-nodes-base.webhook",
            "typeVersion": 2, "position": [250, 300],
            "webhookId": "temp-alter-table",
            "parameters": {
                "path": "temp-alter-table", "httpMethod": "POST",
                "responseMode": "lastNode", "options": {}
            }
        },
        {
            "id": "sql1", "name": "Run SQL", "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5, "position": [500, 300],
            "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
            "parameters": {
                "operation": "executeQuery",
                "query": alter_sql,
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
activate(temp_id)

import time
time.sleep(1)

# Execute the ALTER
req = urllib.request.Request(
    f"{N8N}/webhook/temp-alter-table",
    data=b'{}', method="POST"
)
req.add_header("Content-Type", "application/json")
resp = urllib.request.urlopen(req, context=ctx)
print(f"  ALTER result: HTTP {resp.status}")

# Deactivate and delete temp workflow
api_post(f"/workflows/{temp_id}/deactivate")
req_del = urllib.request.Request(f"{N8N}/api/v1/workflows/{temp_id}", method="DELETE")
req_del.add_header("X-N8N-API-KEY", API_KEY)
urllib.request.urlopen(req_del, context=ctx)
print("  Temp workflow cleaned up.")


# ============================================================
# Step 2: Update user-status workflow
# ============================================================
print("\n2. Updating user-status workflow...")
wf_id = "FqO0ER3eF7GgbESNhfC9C"
wf = api_get(f"/workflows/{wf_id}")

# Find the Postgres node and update its SQL
for node in wf["nodes"]:
    if node["type"] == "n8n-nodes-base.postgres":
        node["parameters"]["query"] = """=
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_stylize INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_remove_bg INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_enhance INT DEFAULT 1;

INSERT INTO users (id, username, created_at)
VALUES ('{{ $json.body.user_id }}', '{{ $json.body.username }}', NOW())
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

UPDATE users SET
  free_stylize = 1,
  free_remove_bg = 1,
  free_enhance = 1,
  free_reset_date = CURRENT_DATE
WHERE id = '{{ $json.body.user_id }}'
  AND (free_reset_date IS NULL OR free_reset_date < CURRENT_DATE);

SELECT id,
  COALESCE(free_stylize, 0) as free_stylize,
  COALESCE(free_remove_bg, 0) as free_remove_bg,
  COALESCE(free_enhance, 0) as free_enhance,
  COALESCE(star_balance, 0) as star_balance
FROM users WHERE id = '{{ $json.body.user_id }}';"""
        print(f"  Updated node: {node['name']}")

api_put(f"/workflows/{wf_id}", {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": wf.get("settings", {})
})
activate(wf_id)
print("  Activated!")


# ============================================================
# Step 3: Update generate (stylize) - use free_stylize
# ============================================================
print("\n3. Updating generate (stylize) workflow...")
wf_id_stylize = "3iZY--GtxZ556edSgZQuB"
wf = api_get(f"/workflows/{wf_id_stylize}")

for node in wf["nodes"]:
    # Find Check Balance node (Postgres)
    if node["name"] == "Check Balance":
        node["parameters"]["query"] = """=
UPDATE users SET
  free_stylize = 1,
  free_remove_bg = 1,
  free_enhance = 1,
  free_reset_date = CURRENT_DATE
WHERE id = '{{ $json.body.user_id }}'
  AND (free_reset_date IS NULL OR free_reset_date < CURRENT_DATE);

SELECT COALESCE(free_stylize, 0) as free_left,
       COALESCE(star_balance, 0) as star_balance
FROM users WHERE id = '{{ $json.body.user_id }}';"""
        print(f"  Updated: {node['name']}")

    # Find the combined SQL node that deducts
    if "SQL" in node["name"] or "Deduct" in node["name"] or "Execute SQL" in node["name"]:
        q = node["parameters"].get("query", "")
        if "free_generations" in q:
            # Replace free_generations with free_stylize
            new_q = q.replace("free_generations", "free_stylize")
            node["parameters"]["query"] = new_q
            print(f"  Updated deduct in: {node['name']}")

api_put(f"/workflows/{wf_id_stylize}", {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": wf.get("settings", {})
})
activate(wf_id_stylize)
print("  Activated!")


# ============================================================
# Step 4: Update generate-remove-bg - add free_remove_bg support
# ============================================================
print("\n4. Updating generate-remove-bg workflow...")
wf_id_rmbg = "z29Bx9CRXKvcHgvI"
wf = api_get(f"/workflows/{wf_id_rmbg}")

for node in wf["nodes"]:
    if node["name"] == "Check Balance":
        node["parameters"]["query"] = """=
UPDATE users SET
  free_stylize = 1, free_remove_bg = 1, free_enhance = 1,
  free_reset_date = CURRENT_DATE
WHERE id = '{{ $json.body.user_id }}'
  AND (free_reset_date IS NULL OR free_reset_date < CURRENT_DATE);

SELECT COALESCE(free_remove_bg, 0) as free_left,
       COALESCE(star_balance, 0) as star_balance
FROM users WHERE id = '{{ $json.body.user_id }}';"""
        print(f"  Updated: {node['name']}")

    # Update Has Balance? condition: free_left > 0 OR star_balance >= 3
    if node["name"] == "Has Balance?" and node["type"] == "n8n-nodes-base.if":
        node["parameters"]["conditions"]["conditions"] = [{
            "id": "cond_bal",
            "leftValue": "={{ $json.free_left > 0 ? 1 : ($json.star_balance >= 3 ? 1 : 0) }}",
            "rightValue": 1,
            "operator": {"type": "number", "operation": "gte"}
        }]
        print(f"  Updated: {node['name']} (free_left > 0 OR star_balance >= 3)")

    # Update Deduct Stars: use free_remove_bg first
    if node["name"] == "Deduct Stars":
        node["parameters"]["query"] = """=UPDATE users SET
  free_remove_bg = CASE WHEN free_remove_bg > 0 THEN free_remove_bg - 1 ELSE free_remove_bg END,
  star_balance = CASE WHEN free_remove_bg > 0 THEN star_balance ELSE star_balance - 3 END
WHERE id = '{{ $json.body.user_id }}';"""
        print(f"  Updated: {node['name']}")

api_put(f"/workflows/{wf_id_rmbg}", {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": wf.get("settings", {})
})
activate(wf_id_rmbg)
print("  Activated!")


# ============================================================
# Step 5: Update generate-enhance - add free_enhance support
# ============================================================
print("\n5. Updating generate-enhance workflow...")
wf_id_enh = "Lfra98zYiGA0yKmD"
wf = api_get(f"/workflows/{wf_id_enh}")

for node in wf["nodes"]:
    if node["name"] == "Check Balance":
        node["parameters"]["query"] = """=
UPDATE users SET
  free_stylize = 1, free_remove_bg = 1, free_enhance = 1,
  free_reset_date = CURRENT_DATE
WHERE id = '{{ $json.body.user_id }}'
  AND (free_reset_date IS NULL OR free_reset_date < CURRENT_DATE);

SELECT COALESCE(free_enhance, 0) as free_left,
       COALESCE(star_balance, 0) as star_balance
FROM users WHERE id = '{{ $json.body.user_id }}';"""
        print(f"  Updated: {node['name']}")

    # Update Has Balance?
    if node["name"] == "Has Balance?" and node["type"] == "n8n-nodes-base.if":
        node["parameters"]["conditions"]["conditions"] = [{
            "id": "cond_bal",
            "leftValue": "={{ $json.free_left > 0 ? 1 : ($json.star_balance >= 5 ? 1 : 0) }}",
            "rightValue": 1,
            "operator": {"type": "number", "operation": "gte"}
        }]
        print(f"  Updated: {node['name']} (free_left > 0 OR star_balance >= 5)")

    # Update Deduct Stars
    if node["name"] == "Deduct Stars":
        node["parameters"]["query"] = """=UPDATE users SET
  free_enhance = CASE WHEN free_enhance > 0 THEN free_enhance - 1 ELSE free_enhance END,
  star_balance = CASE WHEN free_enhance > 0 THEN star_balance ELSE star_balance - 5 END
WHERE id = '{{ $json.body.user_id }}';"""
        print(f"  Updated: {node['name']}")

api_put(f"/workflows/{wf_id_enh}", {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": wf.get("settings", {})
})
activate(wf_id_enh)
print("  Activated!")


# ============================================================
# Step 6: Create cron workflow for daily reset (backup)
# ============================================================
print("\n6. Creating daily cron reset workflow...")

cron_wf = api_post("/workflows", {
    "name": "daily-free-reset",
    "nodes": [
        {
            "id": "cron1", "name": "Every Day at 00:00",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.2,
            "position": [250, 300],
            "parameters": {
                "rule": {
                    "interval": [{"field": "cronExpression", "expression": "0 0 * * *"}]
                }
            }
        },
        {
            "id": "sql1", "name": "Reset Free Gens",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5,
            "position": [500, 300],
            "credentials": {"postgres": {"id": POSTGRES_CRED_ID, "name": "avatar_bot"}},
            "parameters": {
                "operation": "executeQuery",
                "query": "UPDATE users SET free_stylize = 1, free_remove_bg = 1, free_enhance = 1, free_reset_date = CURRENT_DATE WHERE free_reset_date IS NULL OR free_reset_date < CURRENT_DATE;",
                "options": {}
            }
        }
    ],
    "connections": {
        "Every Day at 00:00": {"main": [[{"node": "Reset Free Gens", "type": "main", "index": 0}]]}
    },
    "settings": {"executionOrder": "v1"}
})
cron_id = cron_wf["id"]
activate(cron_id)
print(f"  Created and activated: {cron_id}")


print("\n=== Done! ===")
print("New free generation system:")
print("  - free_stylize: 1/day")
print("  - free_remove_bg: 1/day")
print("  - free_enhance: 1/day")
print("  - Cron resets at 00:00 UTC daily")
