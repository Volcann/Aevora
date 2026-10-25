# Aevora tool execution documentation

Start with `documents/01_Foundations_and_Migration.docx`.

This package explains how your Docker backend dispatches Celery jobs to a laptop worker, how real tool progress reaches an SSE response, why two backend threads are used, and how the design can grow into supervised subprocesses and cooperating agents.

## Reading order

1. **Foundations and migration**: previous MCP path, Redis roles, background jobs, Docker-to-host networking, threads, progress, and token-cost distinctions.
2. **Stream code walkthrough**: request setup, discovery, `stream.py`, `CeleryToolClient`, async bridging, SSE payloads, source defects, and one complete source-derived trace.
3. **Reliability, subprocesses and agents**: prioritized fixes, durable jobs/events, local runbook, acceptance tests, subprocess supervision, Antigravity and a phased multi-agent roadmap.

Editable Word documents are in `documents/`. Matching searchable Markdown versions are in `markdown/`. Citations and review evidence are in `reference/`; event examples are in `examples/`; editable Mermaid architecture/sequence definitions are in `diagrams/`.

## Important findings

The uploads contain a schema-symbol import mismatch that blocks the normal import path. The collected `chat.js` asset has no `tool_log` handler. Failed tasks can currently be reported with `status="completed"`. Progress is a sampled latest-state mechanism, and the `stream:<job_id>` key is a Redis list rather than Redis Streams.

These findings are documented rather than silently repaired. The original application archives were not modified. The old architecture is reconstructed from your description, not a retrieved previous implementation.

## Evidence boundaries

Source behavior, isolated mock checks and future proposals are labelled separately. The example events are illustrative—not recorded live executions. Twelve isolated checks were performed; no live Django/Celery/Docker/browser or agent integration test was performed. See `reference/VALIDATION.md` for the exact scope.

Only documentation, example event data and editable diagram definitions are included. Original code archives, `.env` files, credentials, databases, personal reports, binaries, fonts and intermediate render images are not included.

Prepared: 18 October 2026.
