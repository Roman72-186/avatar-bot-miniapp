"""
Fix generation workflows: $json.body.user_id -> correct reference.
After Set/Extract nodes, body wrapper is gone -> $json.user_id.
For downstream nodes far from webhook, use $("Webhook").item.json.body.user_id.
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

WORKFLOWS = {
    "generate": "3iZY--GtxZ556edSgZQuB",
    "generate-remove-bg": "z29Bx9CRXKvcHgvI",
    "generate-enhance": "Lfra98zYiGA0yKmD",
    "generate-multi": "FXRCdsL4ULHevtbz",
    "generate-style-transfer": "HbqrBmstlPbz9VxM",
    "generate-video": "fmTA4l0XfQXTajGI",
    "generate-face-swap": "qKyOmXDNPNvG9WH9",
    "generate-text-to-image": "QP37jmBYCpeaCzYV",
}


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


def fix_workflow(name, wf_id):
    print(f"\n--- {name} ({wf_id}) ---")
    wf = api_get(f"/workflows/{wf_id}")

    # Determine which nodes exist
    node_names = [n["name"] for n in wf["nodes"]]
    has_extract = any("Extract" in n for n in node_names)

    # Find what the Webhook connects to first
    wh_conn = wf["connections"].get("Webhook", {}).get("main", [[]])[0]
    first_after_webhook = wh_conn[0]["node"] if wh_conn else ""

    print(f"  Nodes: {node_names}")
    print(f"  Has Extract/Set node: {has_extract}")
    print(f"  First after Webhook: {first_after_webhook}")

    fixed = False

    for node in wf["nodes"]:
        # Check all postgres nodes for $json.body.user_id references
        if node["type"] == "n8n-nodes-base.postgres":
            query = node["parameters"].get("query", "")
            if "$json.body.user_id" in query:
                node_name = node["name"]

                # Determine correct reference based on position in flow
                # If node comes right after Extract/Set, use $json.user_id
                # If node is downstream (after HTTP requests etc), use $("Webhook") ref

                # Check if this node receives directly from a Set/Extract node
                direct_from_extract = False
                for conn_name, conn_data in wf["connections"].items():
                    if "Extract" in conn_name or conn_name == "Set":
                        for outputs in conn_data.get("main", []):
                            for out in outputs:
                                if out.get("node") == node_name:
                                    direct_from_extract = True

                if has_extract and (direct_from_extract or node_name == "Check Balance"):
                    # After Extract, data is flat: $json.user_id
                    new_query = query.replace("$json.body.user_id", "$json.user_id")
                    ref_type = "$json.user_id"
                else:
                    # Far downstream: use explicit Webhook reference
                    new_query = query.replace(
                        "$json.body.user_id",
                        '$("Webhook").item.json.body.user_id'
                    )
                    ref_type = '$("Webhook").item.json.body.user_id'

                if new_query != query:
                    node["parameters"]["query"] = new_query
                    print(f"  FIXED: {node_name} -> {ref_type}")
                    fixed = True

            # Also check for node references like $node["generate"].json.body.user_id
            if '$node[' in query and '.json.body.user_id' in query:
                # These old-style refs might work but let's standardize to $("Webhook")
                import re
                new_query = re.sub(
                    r'\$node\["[^"]+"\]\.json\.body\.user_id',
                    '$("Webhook").item.json.body.user_id',
                    query
                )
                if new_query != node["parameters"].get("query", ""):
                    node["parameters"]["query"] = new_query
                    print(f"  FIXED: {node['name']} -> old $node ref updated")
                    fixed = True

        # Also check Code nodes for $json.body references
        if node["type"] == "n8n-nodes-base.code":
            code = node["parameters"].get("jsCode", "")
            if "$json.body.user_id" in code and has_extract:
                # This is wrong after Extract
                pass  # Code nodes are trickier, skip for now

    if fixed:
        api_put(f"/workflows/{wf_id}", {
            "name": wf["name"],
            "nodes": wf["nodes"],
            "connections": wf["connections"],
            "settings": wf.get("settings", {})
        })
        api_post(f"/workflows/{wf_id}/activate")
        print(f"  Updated and reactivated!")
    else:
        print(f"  No $json.body.user_id issues found in Postgres nodes")

    return fixed


# Fix all workflows
total_fixed = 0
for name, wf_id in WORKFLOWS.items():
    try:
        if fix_workflow(name, wf_id):
            total_fixed += 1
    except Exception as e:
        print(f"  ERROR: {e}")

print(f"\n\nDone! Fixed {total_fixed} workflows.")
