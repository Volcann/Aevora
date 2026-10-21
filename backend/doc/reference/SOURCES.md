# Source register and review boundaries

Review date: 18 October 2026.

## What this documentation is based on

The previous MCP/SSE-to-stdio architecture comes from the user’s description. The current path comes from backend.zip and utils.zip. No former MCP-manager implementation or commit history was available to establish a dated migration diff. Source-level findings are not live deployment observations. The page images supplied with the conversation were not treated as evidence of application behavior.

Only selected source/configuration/test files were inspected. Secret-bearing .env files, databases, logs, reports, binaries, Git internals and unrelated collected static assets were excluded from the document package. The one collected chat.js asset was inspected specifically for its SSE event contract; it may not be the deployed frontend.

## Uploaded code sources

### [C01] `backend/aevora/ai_chat/utils/stream.py`
17-53 async bridge; 67-88 framing/history; 91-192 chat/tool loop.

### [C02] `backend/aevora/ai_chat/services/celery_tool_client.py`
11-42 discovery/dispatch; 44-58 polling; 60-81 logging and Redis list.

### [C03] `backend/aevora/ai_chat/utils/tools.py`
12-37 schema normalization/discovery; 40-56 declarations and 60-second cache.

### [C04] `backend/aevora/ai_chat/utils/schema.py`
1-28 schema converter; defines schema_to_gemini, not _schema_to_gemini.

### [C05] `backend/aevora/ai_chat/api/v1/views/stream.py`
16-50 POST view, bridge, streaming headers.

### [C06] `backend/docker-compose.yml`
11-16 Redis environment; 50-76 Django/container worker; 104-118 Redis port mapping.

### [C07] `backend/config/settings/base.py`
107-113 Redis/Celery and JSON serialization; 125-130 authentication and permissions.

### [C08] `utils/src/app.py`
3-16 host Redis address and included tasks; 18-24 queue settings.

### [C09] `utils/src/tasks/list_tools.py`
4-19 active weather catalogue; 21-48 commented-out tools.

### [C10] `utils/src/tasks/weather.py`
13-18 progress; 21-89 provider functions; 92-158 task and report.

### [C11] `utils/start.sh`
23-30 laptop worker startup and queue subscriptions.

### [C12] `backend/aevora/ai_chat/models/ai_log.py`
7-18 persisted text logs related to Message.

### [C13] `backend/aevora/ai_chat/api/v1/serializers/message.py`
8-24 exposes nested logs with messages.

### [C14] `backend/aevora/ai_chat/utils/__init__.py`
7-11 imports missing schema symbol; 29-47 public exports.

### [C15] `backend/staticfiles/ai_chat/chat.js`
575-639 fetch reader, SSE frame parsing and event switch; no tool_log case.

### [C16] `utils/src/tasks/setup_project.py`
10-29 one progress update, global stdout capture, direct local function calls.

### [C17] `utils/src/tasks/review_pr.py`
7-24 one progress update, direct run_review, global stdout capture.

### [C18] `utils/src/tasks/report_status.py`
7-23 one progress update and captured stdout.

### [C19] `utils/environment/environment/folder_setup/launcher.py`
8-38 subprocess/window launch; 129-136 Antigravity GUI launcher.

### [C20] `utils/ghToolkit/src/core/runner.py`
44-106 existing subprocess.run wrapper and error handling.

### [C21] `backend/aevora/ai_chat/tests/test_celery_tool_client.py`
19-76 mocked dispatch tests.

### [C22] `utils/tests/test_tasks.py`
7-45 catalogue and mocked provider/progress tests.

### [C23] `backend/aevora/ai_chat/utils/session.py`
9-19 user-scoped session lookup and creation.

### [C24] `backend/aevora/ai_chat/api/v1/urls.py`
23-25 stream/models/tools routes; mounted by backend/config/urls.py:28.

### [C25] `backend/pyproject.toml`
Django, legacy google-generativeai, mcp and Celery dependency declarations.

### [C26] `utils/README.md`
Task descriptions are broader than the active app include list and tool catalogue.

### [C27] `utils/environment/environment/executor/shell.py`
59-62 existing shell=True launch paths; not an approved generic agent runner.

## Primary technical references

Official documentation checked on 18 October 2026. The MCP links deliberately use the 2025-06-18 revision to substantiate that progress already existed; they are not labelled the latest specification. Celery “stable” and product documentation can change. Current docs may describe newer APIs than those in the uploaded dependency set.

### [R01] Celery: Tasks (states, names, retries, acknowledgement semantics)
https://docs.celeryq.dev/en/stable/userguide/tasks.html

### [R02] Celery: Using Redis
https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html

### [R03] Python: threading
https://docs.python.org/3/library/threading.html

### [R04] Python: Coroutines and tasks; scheduling from other threads
https://docs.python.org/3/library/asyncio-task.html

### [R05] Django 5.2: StreamingHttpResponse
https://docs.djangoproject.com/en/5.2/ref/request-response/#streaminghttpresponse-objects

### [R06] Redis: BLPOP
https://redis.io/docs/latest/commands/blpop/

### [R07] Docker: Networking in Compose
https://docs.docker.com/compose/how-tos/networking/

### [R08] MCP: Progress, specification 2025-06-18
https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress

### [R09] MCP: Transports, specification 2025-06-18
https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

### [R10] Google: Function calling with the Gemini API
https://ai.google.dev/gemini-api/docs/function-calling

### [R11] Google: Understand and count tokens
https://ai.google.dev/gemini-api/docs/tokens

### [R12] Celery: Routing tasks
https://docs.celeryq.dev/en/stable/userguide/routing.html

### [R13] Python 3.12: subprocess
https://docs.python.org/3.12/library/subprocess.html

### [R14] Celery: Canvas workflows
https://docs.celeryq.dev/en/stable/userguide/canvas.html

### [R15] Redis: XADD
https://redis.io/docs/latest/commands/xadd/

### [R16] Redis: XREAD
https://redis.io/docs/latest/commands/xread/

### [R17] Google Antigravity: Headless mode
https://antigravity.google/docs/cli/headless/

### [R18] Google Antigravity: SDK overview
https://antigravity.google/docs/sdk/overview/

### [R19] Google: Migrate to the Google GenAI SDK
https://ai.google.dev/gemini-api/docs/migrate

## Archive identity

SHA-256 identifies exactly which uploads were reviewed; the original archives are not redistributed.

`backend.zip`
```text
a1f1679944d155d85a68675bc62fa29fa1cecba86c7b09c2881be02bf414ef45
```

`utils.zip`
```text
cf0b11427499ef81c2fa93dfb79fe3ba6f2175c247fbb2a961449385aceb5ee4
```
