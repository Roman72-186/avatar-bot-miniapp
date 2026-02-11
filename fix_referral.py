"""
Fix referral system: BIGINT type mismatch.
users.id is BIGINT, but queries pass TEXT values.
Also referred_by is TEXT, so need to cast consistently.
"""
import json
import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YjlmMzhmMC0wZGZlLTQwNGEtYTY3Ny1iYTU0MGJiZjUwYzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcwNjUwNzk0LCJleHAiOjE3NzMyMDE2MDB9.UVG3WEUUhsglQ8h4SZ92jp1JzTcJ_UQYiSp6r0Fk7jY"
N8N = "https://n8n.creativeanalytic.ru"
WF_ID = "G52H2goZzpFSLUSa"


def api_get(path):
    req = urllib.request.Request(f"{N8N}/api/v1{path}", method="GET")
    req.add_header("X-N8N-API-KEY", API_KEY)
    return json.loads(urllib.request.urlopen(req, context=ctx).read().decode())


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


wf = api_get(f"/workflows/{WF_ID}")

for node in wf["nodes"]:
    if node["name"] == "Process Referral":
        node["parameters"]["query"] = (
            '=DO $$\n'
            'DECLARE\n'
            '  v_new_user BIGINT := \'{{ $("Route Update").first().json.user_id }}\'::BIGINT;\n'
            '  v_referrer TEXT := \'{{ $("Route Update").first().json.referrer_id }}\';\n'
            'BEGIN\n'
            '  IF v_referrer = \'\' OR v_referrer::BIGINT = v_new_user THEN RETURN; END IF;\n'
            '  INSERT INTO users (id, created_at) VALUES (v_new_user, NOW()) ON CONFLICT (id) DO NOTHING;\n'
            '  UPDATE users SET referred_by = v_referrer WHERE id = v_new_user AND referred_by IS NULL;\n'
            'END $$;'
        )
        print("Fixed: Process Referral (id BIGINT cast)")

    elif node["name"] == "Check Referral":
        node["parameters"]["query"] = (
            "=SELECT COALESCE("
            "(SELECT referred_by FROM users"
            ' WHERE id = \'{{ $("Route Update").first().json.user_id }}\'::BIGINT'
            " AND referred_by IS NOT NULL AND referred_by != ''"
            " AND (ref_bonus_given IS NULL OR ref_bonus_given = false)),"
            " '') as referred_by"
        )
        print("Fixed: Check Referral (id BIGINT cast)")

    elif node["name"] == "Apply Ref Bonus":
        node["parameters"]["query"] = (
            "=WITH referral AS (\n"
            "  SELECT referred_by FROM users\n"
            '  WHERE id = \'{{ $("Route Update").first().json.user_id }}\'::BIGINT\n'
            "),\n"
            "calc AS (\n"
            "  SELECT\n"
            "    u.id as referrer_id,\n"
            "    (COALESCE(u.ref_paid_count, 0) / 5) + 1 as bonus\n"
            "  FROM users u\n"
            "  JOIN referral r ON u.id::TEXT = r.referred_by\n"
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
            '  UPDATE users SET ref_bonus_given = true\n'
            '  WHERE id = \'{{ $("Route Update").first().json.user_id }}\'::BIGINT\n'
            ")\n"
            "SELECT c.referrer_id, c.bonus FROM calc c;"
        )
        print("Fixed: Apply Ref Bonus (id BIGINT cast, JOIN on id::TEXT)")

api_put(f"/workflows/{WF_ID}", {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": wf.get("settings", {})
})
api_post(f"/workflows/{WF_ID}/activate")
print("\nWorkflow updated and activated!")

# Also fix referral-stats workflow
print("\nFixing referral-stats workflow...")
REF_STATS_ID = "fxEYkG4lywhfuoLX"
rs = api_get(f"/workflows/{REF_STATS_ID}")

for node in rs["nodes"]:
    if node["name"] == "Get Stats":
        node["parameters"]["query"] = (
            "=SELECT\n"
            "  COALESCE((SELECT COUNT(*)::int FROM users WHERE referred_by = '{{ $json.body.user_id }}'), 0) as total_referrals,\n"
            "  COALESCE((SELECT ref_paid_count FROM users WHERE id = '{{ $json.body.user_id }}'::BIGINT), 0)::int as paid_referrals,\n"
            "  COALESCE((SELECT ref_earnings FROM users WHERE id = '{{ $json.body.user_id }}'::BIGINT), 0)::int as total_earnings,\n"
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
        )
        print("Fixed: Get Stats (id BIGINT cast)")

api_put(f"/workflows/{REF_STATS_ID}", {
    "name": rs["name"],
    "nodes": rs["nodes"],
    "connections": rs["connections"],
    "settings": rs.get("settings", {})
})
api_post(f"/workflows/{REF_STATS_ID}/activate")
print("referral-stats updated and activated!")

print("\nDone! Now test: send /start ref_YOURID from another account.")
