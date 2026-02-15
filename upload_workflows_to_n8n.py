# -*- coding: utf-8 -*-
"""
Upload NanoBanana workflows to n8n via API
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

print("=== Загрузка workflows на n8n ===\n")

# Load workflow files
print("[1/3] Чтение workflow файлов...")

with open('workflow_generate_nanobanana.json', 'r', encoding='utf-8') as f:
    generate_wf = json.load(f)

with open('workflow_nanobanana_callback.json', 'r', encoding='utf-8') as f:
    callback_wf = json.load(f)

# Remove read-only fields
for wf in [generate_wf, callback_wf]:
    for field in ['active', 'id', 'createdAt', 'updatedAt', 'versionId']:
        wf.pop(field, None)

print("✓ Файлы загружены")

# Upload callback workflow first
print("\n[2/3] Создание workflow: nanobanana-callback...")

try:
    req = urllib.request.Request(f"{N8N}/api/v1/workflows", method="POST")
    req.add_header("X-N8N-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")

    data = json.dumps(callback_wf).encode('utf-8')
    resp = urllib.request.urlopen(req, data=data, context=ctx)
    result = json.load(resp)

    callback_id = result['id']
    print(f"✓ Создан: {result['name']}")
    print(f"  ID: {callback_id}")
    print(f"  Webhook: {N8N}/webhook/nanobanana-callback")

except urllib.error.HTTPError as e:
    error_body = e.read().decode('utf-8')
    print(f"❌ HTTP Error {e.code}:")
    print(error_body)

    # Try to activate existing workflow
    print("\nВозможно workflow уже существует. Попробуйте активировать вручную.")
    sys.exit(1)

except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Upload generate workflow
print("\n[3/3] Создание workflow: generate-nanobanana...")

try:
    req = urllib.request.Request(f"{N8N}/api/v1/workflows", method="POST")
    req.add_header("X-N8N-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")

    data = json.dumps(generate_wf).encode('utf-8')
    resp = urllib.request.urlopen(req, data=data, context=ctx)
    result = json.load(resp)

    generate_id = result['id']
    print(f"✓ Создан: {result['name']}")
    print(f"  ID: {generate_id}")
    print(f"  Webhook: {N8N}/webhook/generate-nanobanana")

except urllib.error.HTTPError as e:
    error_body = e.read().decode('utf-8')
    print(f"❌ HTTP Error {e.code}:")
    print(error_body)

    print("\nВозможно workflow уже существует. Попробуйте активировать вручную.")
    sys.exit(1)

except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Activate workflows
print("\n=== Активация workflows ===")

for wf_id, wf_name in [(callback_id, "nanobanana-callback"), (generate_id, "generate-nanobanana")]:
    print(f"\nАктивация {wf_name}...")
    try:
        req = urllib.request.Request(f"{N8N}/api/v1/workflows/{wf_id}", method="PATCH")
        req.add_header("X-N8N-API-KEY", API_KEY)
        req.add_header("Content-Type", "application/json")

        patch_data = json.dumps({"active": True}).encode('utf-8')
        resp = urllib.request.urlopen(req, data=patch_data, context=ctx)
        result = json.load(resp)

        print(f"✓ {wf_name} активирован")

    except Exception as e:
        print(f"⚠ Не удалось активировать {wf_name}: {e}")

print("\n" + "="*60)
print("✅ УСПЕХ! Workflows созданы на n8n")
print("="*60)

print(f"""
Callback ID: {callback_id}
Generate ID: {generate_id}

Webhook URLs:
- {N8N}/webhook/nanobanana-callback
- {N8N}/webhook/generate-nanobanana

⚠ ВАЖНО: Создайте таблицы в PostgreSQL!

Запустите в n8n Code node:

await $pool.query(`
    CREATE TABLE IF NOT EXISTS user_photos (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        file_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_user_photos_user_id ON user_photos(user_id);

    CREATE TABLE IF NOT EXISTS generation_tasks (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        task_id TEXT NOT NULL UNIQUE,
        prompt TEXT,
        status TEXT DEFAULT 'pending',
        result_url TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_generation_tasks_task_id ON generation_tasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id ON generation_tasks(user_id);
`);

🎉 Теперь можно тестировать в боте!
""")
