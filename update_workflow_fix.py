# -*- coding: utf-8 -*-
"""
Update generate-nanobanana workflow to fix responseMode
"""
import json
import urllib.request
import ssl
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YjlmMzhmMC0wZGZlLTQwNGEtYTY3Ny1iYTU0MGJiZjUwYzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcwNjUwNzk0LCJleHAiOjE3NzMyMDE2MDB9.UVG3WEUUhsglQ8h4SZ92jp1JzTcJ_UQYiSp6r0Fk7jY"
N8N = "https://n8n.creativeanalytic.ru"
WF_ID = "Nyrs3xgCsNiw6a3o"  # generate-nanobanana workflow ID

print("=== Обновление workflow generate-nanobanana ===\n")

# Load updated workflow
with open('workflow_generate_nanobanana.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# Remove read-only fields
for field in ['active', 'id', 'createdAt', 'updatedAt', 'versionId']:
    wf.pop(field, None)

print("Обновление workflow...")

try:
    req = urllib.request.Request(f"{N8N}/api/v1/workflows/{WF_ID}", method="PUT")
    req.add_header("X-N8N-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")

    data = json.dumps(wf).encode('utf-8')
    resp = urllib.request.urlopen(req, data=data, context=ctx)
    result = json.load(resp)

    print(f"✓ Workflow обновлен: {result['name']}")
    print(f"  ID: {result['id']}")
    print(f"  responseMode исправлен на: lastNode")

except urllib.error.HTTPError as e:
    error_body = e.read().decode('utf-8')
    print(f"❌ HTTP Error {e.code}:")
    print(error_body)
    sys.exit(1)

except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n✅ Готово! Теперь можно тестировать.")
