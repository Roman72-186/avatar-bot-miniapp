# -*- coding: utf-8 -*-
"""
Simplified n8n workflow creation for NanoBanana Pro
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

print("=== Создание NanoBanana workflows ===\n")

print("""
ИНСТРУКЦИЯ:
Создайте workflows вручную в n8n интерфейсе по инструкции из паиапи.md

Или импортируйте готовые JSON файлы, которые я создам для вас.

Нажмите Enter чтобы создать JSON файлы для импорта...
""")

input()

# Создаем JSON файлы для ручного импорта
print("\n[1/2] Создание generate-nanobanana.json...")

generate_workflow = {
    "name": "[MINIAPP] generate-nanobanana",
    "nodes": [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "generate-nanobanana",
                "responseMode": "onReceived"
            },
            "id": "webhook",
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [240, 300]
        },
        {
            "parameters": {
                "operation": "executeQuery",
                "query": "=SELECT stars FROM users WHERE user_id = {{ $json.body.user_id }}"
            },
            "id": "check-balance",
            "name": "Check Balance",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5,
            "position": [460, 300]
        },
        {
            "parameters": {
                "conditions": {
                    "number": [
                        {
                            "value1": "={{ $json.stars }}",
                            "operation": "largerEqual",
                            "value2": 15
                        }
                    ]
                }
            },
            "id": "has-balance",
            "name": "Has Balance?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": [680, 300]
        },
        {
            "parameters": {
                "respondWith": "json",
                "responseBody": "={{ { status: 'error', error_msg: 'insufficient_balance', required: 15 } }}"
            },
            "id": "no-balance",
            "name": "No Balance",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [900, 400]
        },
        {
            "parameters": {
                "language": "javaScript",
                "jsCode": "const userId = $('Webhook').first().json.body.user_id;\nconst customPrompt = $('Webhook').first().json.body.prompt || null;\nconst photoUrls = $('Webhook').first().json.body.photos || [];\n\nconst NANOBANANA_API_KEY = 'e5e4877b659ed877497901f0c773b529';\nconst CALLBACK_URL = 'https://n8n.creativeanalytic.ru/webhook/nanobanana-callback';\nconst DEFAULT_PROMPT = \"Professional high-quality portrait photo of this person, studio lighting, sharp focus, 8k resolution\";\n\nconst prompt = customPrompt || DEFAULT_PROMPT;\n\nif (!photoUrls || photoUrls.length < 2) {\n    return [{ json: { success: false, error: \"Минимум 2 фото требуется\" } }];\n}\n\ntry {\n    const nanoBananaResp = await fetch(\n        'https://api.nanobananaapi.ai/api/v1/nanobanana/generate-pro',\n        {\n            method: 'POST',\n            headers: {\n                'Authorization': `Bearer ${NANOBANANA_API_KEY}`,\n                'Content-Type': 'application/json'\n            },\n            body: JSON.stringify({\n                prompt: prompt,\n                imageUrls: photoUrls,\n                resolution: \"2K\",\n                aspectRatio: \"1:1\",\n                callBackUrl: CALLBACK_URL\n            })\n        }\n    );\n\n    const taskData = await nanoBananaResp.json();\n\n    if (taskData.code !== 200) {\n        return [{ json: { success: false, error: taskData.message || taskData.msg || \"NanoBanana API error\" } }];\n    }\n\n    const taskId = taskData.data.taskId;\n\n    await $pool.query(\n        `INSERT INTO generation_tasks (user_id, task_id, prompt, status) VALUES ($1, $2, $3, $4)`,\n        [userId, taskId, prompt, 'generating']\n    );\n\n    return [{ json: { success: true, taskId: taskId, userId: userId, photoCount: photoUrls.length, message: \"Генерация запущена! Ожидайте результат через 30-60 секунд...\" } }];\n\n} catch (err) {\n    return [{ json: { success: false, error: `NanoBanana API error: ${err.message}` } }];\n}"
            },
            "id": "call-nanobanana",
            "name": "Call NanoBanana API",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [900, 200]
        },
        {
            "parameters": {
                "operation": "executeQuery",
                "query": "=UPDATE users SET stars = stars - 15 WHERE user_id = {{ $('Webhook').first().json.body.user_id }}"
            },
            "id": "deduct-stars",
            "name": "Deduct Stars",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.5,
            "position": [1120, 200]
        },
        {
            "parameters": {
                "respondWith": "json",
                "responseBody": "={{ $json }}"
            },
            "id": "send-response",
            "name": "Send Response",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [1340, 200]
        }
    ],
    "connections": {
        "webhook": { "main": [[{ "node": "check-balance", "type": "main", "index": 0 }]] },
        "check-balance": { "main": [[{ "node": "has-balance", "type": "main", "index": 0 }]] },
        "has-balance": { "main": [[{ "node": "no-balance", "type": "main", "index": 0 }], [{ "node": "call-nanobanana", "type": "main", "index": 0 }]] },
        "call-nanobanana": { "main": [[{ "node": "deduct-stars", "type": "main", "index": 0 }]] },
        "deduct-stars": { "main": [[{ "node": "send-response", "type": "main", "index": 0 }]] }
    },
    "settings": {},
    "active": False
}

with open('workflow_generate_nanobanana.json', 'w', encoding='utf-8') as f:
    json.dump(generate_workflow, f, indent=2, ensure_ascii=False)
print("✓ Создан: workflow_generate_nanobanana.json")

# ==========================================
# Workflow 2: nanobanana-callback
# ==========================================
print("\n[2/2] Создание nanobanana-callback.json...")

callback_workflow = {
    "name": "[MINIAPP] nanobanana-callback",
    "nodes": [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "nanobanana-callback",
                "responseMode": "onReceived"
            },
            "id": "webhook",
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [240, 300]
        },
        {
            "parameters": {
                "language": "javaScript",
                "jsCode": "const body = items[0].json.body || items[0].json;\n\nconst code = body.code;\nconst msg = body.msg;\nconst taskId = body.data?.taskId;\nconst resultImageUrl = body.data?.info?.resultImageUrl;\n\nif (!taskId) {\n    return [{ json: { success: false, error: \"Missing taskId\" } }];\n}\n\nconst taskResult = await $pool.query('SELECT user_id, prompt FROM generation_tasks WHERE task_id = $1', [taskId]);\n\nif (taskResult.rows.length === 0) {\n    return [{ json: { success: false, error: `Task not found: ${taskId}` } }];\n}\n\nconst userId = taskResult.rows[0].user_id;\nconst prompt = taskResult.rows[0].prompt;\n\nif (code === 200 && resultImageUrl) {\n    await $pool.query(`UPDATE generation_tasks SET status = $1, result_url = $2, completed_at = NOW() WHERE task_id = $3`, ['completed', resultImageUrl, taskId]);\n    await $pool.query('DELETE FROM user_photos WHERE user_id = $1', [userId]);\n\n    return [{ json: { success: true, action: \"send_result\", userId: userId, resultImageUrl: resultImageUrl, message: \"✨ Ваш AI-аватар готов!\", prompt: prompt } }];\n} else {\n    await $pool.query(`UPDATE generation_tasks SET status = $1, error_message = $2, completed_at = NOW() WHERE task_id = $3`, ['failed', msg, taskId]);\n\n    return [{ json: { success: false, action: \"send_error\", userId: userId, error: msg, message: \"😔 Генерация не удалась. Попробуйте ещё раз.\" } }];\n}"
            },
            "id": "process-callback",
            "name": "Process Callback",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [460, 300]
        },
        {
            "parameters": {
                "conditions": {
                    "boolean": [
                        {
                            "value1": "={{ $json.success }}",
                            "value2": True
                        }
                    ]
                }
            },
            "id": "check-success",
            "name": "Success?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": [680, 300]
        },
        {
            "parameters": {
                "method": "POST",
                "url": "=https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendPhoto",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify({ chat_id: $json.userId, photo: $json.resultImageUrl, caption: $json.message + '\\n\\nПромпт: ' + ($json.prompt || 'стандартный') }) }}"
            },
            "id": "send-photo",
            "name": "Send Photo",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [900, 200]
        },
        {
            "parameters": {
                "method": "POST",
                "url": "=https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify({ chat_id: $json.userId, text: $json.message + '\\n\\nОшибка: ' + ($json.error || 'unknown') }) }}"
            },
            "id": "send-error",
            "name": "Send Error",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [900, 400]
        }
    ],
    "connections": {
        "webhook": { "main": [[{ "node": "process-callback", "type": "main", "index": 0 }]] },
        "process-callback": { "main": [[{ "node": "check-success", "type": "main", "index": 0 }]] },
        "check-success": { "main": [[{ "node": "send-error", "type": "main", "index": 0 }], [{ "node": "send-photo", "type": "main", "index": 0 }]] }
    },
    "settings": {},
    "active": False
}

with open('workflow_nanobanana_callback.json', 'w', encoding='utf-8') as f:
    json.dump(callback_workflow, f, indent=2, ensure_ascii=False)
print("✓ Создан: workflow_nanobanana_callback.json")

print("""
\n✅ ГОТОВО! Файлы созданы для ручного импорта.

=== Следующие шаги ===

1. Откройте n8n: https://n8n.creativeanalytic.ru

2. Создайте таблицы в PostgreSQL через n8n Code node или вручную:

   CREATE TABLE IF NOT EXISTS user_photos (
       id SERIAL PRIMARY KEY,
       user_id BIGINT NOT NULL,
       file_id TEXT NOT NULL,
       created_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_user_photos_user_id ON user_photos(user_id);

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
   CREATE INDEX idx_generation_tasks_task_id ON generation_tasks(task_id);
   CREATE INDEX idx_generation_tasks_user_id ON generation_tasks(user_id);

3. Импортируйте workflows:
   - Workflows → Import from File
   - Выберите workflow_generate_nanobanana.json
   - Выберите workflow_nanobanana_callback.json

4. Активируйте оба workflow в n8n

5. Проверьте что TELEGRAM_BOT_TOKEN настроен в n8n environment

6. Тестируйте через бота!

=== Callback URL для NanoBanana ===
https://n8n.creativeanalytic.ru/webhook/nanobanana-callback
""")
