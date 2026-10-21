# How one tool call reaches your screen

A source-by-source walkthrough of stream.py and CeleryToolClient

Reviewed against the uploaded source on 18 October 2026. Source IDs resolve in ../reference/SOURCES.md.

## Start with the files, then the blocker

| File / source ID | Responsibility |
| --- | --- |
| utils/stream.py [C01] | Gemini loop, SSE framing and sync-to-async bridge |
| services/celery_tool_client.py [C02] | Discover, dispatch, observe and transfer tool events |
| utils/tools.py + schema.py [C03-C04] | Build the model-facing tool declarations |
| api/v1/views/stream.py [C05] | Validate POST and construct StreamingHttpResponse |
| utils/src/app.py + tasks/ [C08-C10] | Laptop worker configuration, catalogue and tool code |
| models/ai_log.py + message serializer [C12-C13] | Persist and expose chat-linked progress logs |

### Resolve this before calling the snapshot runnable

tools.py imports _schema_to_gemini from schema.py. The utils package initializer imports both _schema_to_gemini and schema_to_gemini. But schema.py defines only schema_to_gemini and contains no underscored alias. On ordinary source imports, that missing symbol blocks this import path. An isolated static check confirmed the mismatch. [C03:7; C04:13-28; C14:7-11]

```text
# Proposed compatibility fix at the end of schema.py
# Keep one implementation while old imports are updated.
_schema_to_gemini = schema_to_gemini
```

Alternatively, consistently change both callers and the package export list to the public name. The alias is the smaller compatibility change; a cleanup can follow. Add an import regression test before proceeding. This documentation has not applied either change to your uploaded application. [Proposed fix]

> Evidence labels throughout: Source behavior = visible in uploaded code. Isolated check = selected definitions run with in-memory mocks. Proposed = design or patch not integrated. Live deployment behavior was not tested.

All Cxx references point to archive-relative paths and line ranges in reference/SOURCES.md. The original manager implementation was not available, so this is not a commit-by-commit migration diff.

## The HTTP request and conversation setup

The route is POST /api/v1/chat/stream/. Global REST framework settings require authentication; session lookup includes the requesting user. The view validates the prompt and optional model field, chooses or creates the session, then wraps _gemini_stream inside sync_to_async_gen. [C24:23; C07:125-130; C23:9-19; C05:18-43]

| Source location | What happens | Why it matters |
| --- | --- | --- |
| View, 19-24 | Invalid input returns a done-only SSE response | Validation errors are not clearly exposed |
| View, 26-33 | Resolve model and user-owned session | Separates request setup from streamed work |
| View, 35-49 | Create async streaming response and headers | Response uses text/event-stream |
| Stream, 98-104 | Emit session_created when new; load history | New chat ID can arrive before tool discovery |
| Stream, 106-123 | Build model/tools and create user/model rows | The model message exists before logs attach |

### History is text, not a saved tool transcript

get_history loads ordered Message objects, keeps the last five, maps roles and drops leading non-user entries. AILog rows are not inserted into that history. The returned function_response is used in the in-memory model conversation, but no separate durable tool-result transcript is stored by this loop. The final accumulated text is saved to the model message only near the end. [C01:71-88,181-190; C12-C13]

### Model fallback is narrower than it sounds

The source chooses the supplied AIModel name, or the literal default gemini-3.5-flash-lite. The inner fallback catches model construction/start_chat exceptions, not later send_message failures. The outer exception handler then yields an error as a text chunk. This description records the literal source value; it does not certify that the named model is available in your account. [C01:108-128,191-192]

The headers request no caching or transformation and disable buffering for proxies that honor X-Accel-Buffering. They are useful, but do not prove that every proxy, middleware layer or frontend flushes immediately. The response still needs a correctly typed async iterator. [C05:44-49; R05]

## Tool discovery and schema preparation

```text
get_gemini_tools()
  -> check gemini_tools_cache
  -> get_tool_list()
  -> CeleryToolClient.list_tools()
  -> tools.list_tools on laptop.tools
  -> FunctionDeclaration objects
  -> model tools configuration
```

The backend submits discovery using send_task and then waits up to 10 seconds for the result. On discovery failure, get_tool_list logs a warning and uses an empty tool list. Chat may then continue without tools instead of exposing a clear “laptop unavailable” event. Discovery can happen before the first generated text chunk. [C02:22-24; C03:27-56; C01:106-128]

### Two names for one tool

| Name | Where it appears | Meaning |
| --- | --- | --- |
| get_weather | Catalogue and Gemini function call | Model-facing capability name |
| tools.get_weather | Celery task decorator and dispatcher | Registered execution name |
| laptop.tools | send_task queue argument and worker subscription | Where this job should be consumed |

format_tools copies dictionary entries and normalizes inputSchema and parameters when one is missing. The Gemini conversion consumes inputSchema. The schema converter handles a top-level object and shallow property type/description pairs; it does not recursively preserve nested object schemas, array item schemas or richer constraints. That matters when adding more complex agent tools. [C03:12-24,44-49; C04:13-28]

### Which tools are enabled today?

The active catalogue returns only get_weather, and the worker includes tasks.list_tools and tasks.weather. The three workflow wrappers are commented out in both places. A file’s existence is not enough to make its task available: the worker must register it, discovery must advertise it, and the backend must be allowed to dispatch it. [C08:8-15; C09:4-48]

> Proposed registration checklist: define and validate the task; include its module; expose an approved schema; restart the worker; refresh discovery cache; test dispatch and progress. Do not add an unrestricted “run any command” tool.

## The central Gemini-to-tool loop

The while loop is a repeated model/tool exchange. First the model responds. When a function call is found, your application executes the tool. Its final output becomes the next model input. When no function call remains, the loop finishes. [C01:125-190]

| Lines in stream.py | Action | Output or consequence |
| --- | --- | --- |
| 127-135 | send_message(..., stream=True); iterate chunks | Text becomes chunk SSE events and full_text |
| 137-147 | Inspect first candidate; select first function call | Break when no call is found |
| 149-156 | Emit tool_start; dispatch job; start watcher | Tool stage begins; watcher runs concurrently |
| 158-173 | Wait for and forward tool-log events | No event in 30 seconds triggers tool_error |
| 174-179 | On completed, extract output and emit tool_done | Stop waiting for this job |
| 181-186 | Build function_response with result | Feed tool result into next model turn |
| 188-190 | Save accumulated text; emit done | Final message ID becomes available |

### What this loop is not doing

Function-call inspection happens after the response iterator is consumed. Only the first discovered call in the first candidate is selected. There is no dispatch of a batch of parallel function calls and no maximum tool-turn limit. The presence of background threads does not change those orchestration rules. [C01:127-147,181-186]

```text
# Actual shape built for the next model input
{
  "function_response": {
    "name": function_call.name,
    "response": {"result": tool_output}
  }
}
```

The weather tool returns a report string, so tool_output is not always a dictionary. The expression output or {} also changes valid falsey results such as 0, False or an empty string into an empty object. Future adapters should use an explicit result envelope and distinguish None from valid falsey values. [C10:139-158; C01:158,175,181-185]

## The watcher is an observer, not the worker

watch_job executes in a backend daemon thread. It does not call the weather providers. It repeatedly asks the AsyncResult whether the job is ready; while the state is PROGRESS, it reads info["msg"], suppresses repeated text and forwards changed messages. Each loop sleeps for 0.1 seconds. [C02:44-52]

```text
# Condensed source logic, not a replacement implementation
seen_msg = None
while not job.ready():
    if job.state == "PROGRESS":
        msg = job.info.get("msg", "Processing...")
        if msg != seen_msg:
            seen_msg = msg
            save_and_push(msg, status="running")
    sleep(0.1)
result = job.get()
save_and_push("Done!", status="completed", output=result)
```

The source catches exceptions from the final get() and converts them to {"error": str(exc)}, then still pushes “Done!” with completed status. An isolated mock check reproduced that behavior. The condensed sketch above leaves out this exception conversion so that the normal path is easy to see; it is not a full copy. [C02:54-58; reference/VALIDATION.md]

### Database first, event list second

_push creates an AILog row with text like [get_weather] Fetching…, constructs the tool_log JSON, appends it to stream:<job_id> and refreshes that list’s 120-second expiry. The stored row’s ID becomes log_id in the event. Later, the message serializer exposes nested log records. [C02:60-74; C12-C13]

This order has a failure boundary: if database logging raises, no Redis event is sent. If Redis publishing fails after the row is created, a saved log may exist that the live stream never received. There is no transaction spanning those stores and no outer retry/cancellation guard around the watcher loop. [Inference from C02:44-74]

### State is not an append-only log

The watcher sees snapshots. A fast task can move from one message to another or directly to completion between reads. Also, state and info are read separately; a state transition can change the metadata shape between those reads. A robust observer should normalize types and terminal states, and a lossless design should publish events at their source. [C02:46-58; R01]

## sync_to_async_gen: the reason for the bridge

_gemini_stream is synchronous because it uses blocking model iteration, ORM work and Redis calls. The HTTP path runs under Uvicorn/ASGI. Django expects an async iterator there; adapting the wrong iterator type can force complete consumption and defeat incremental streaming. Your bridge supplies the right kind of iterator while isolating blocking work. [C01:17-53,91-192; C06:53; R05]

| Lines | Concept | Plain-language explanation |
| --- | --- | --- |
| 23-26 | Loop, queue, sentinel, stop flag | Remember the event loop; create a handoff channel and completion marker |
| 28-34 | Producer thread | Advance the sync generator and schedule each queue.put on the loop |
| 33-34 | run_coroutine_threadsafe / result | Safely submit async work from another thread; wait for enqueue completion |
| 35-40 | Error and completion forwarding | Send an exception or sentinel through the same queue |
| 42 | Daemon thread starts | Synchronous generation can progress beside the event loop |
| 44-51 | Async consumer | Await each item; re-raise errors; yield values to Django |
| 52-53 | finally: stopped.set() | Signal that this consumer no longer wants more output |

The queue belongs to the event loop. The producer does not call a non-thread-safe queue method directly; it schedules queue.put using run_coroutine_threadsafe. future.result() waits for the handoff, not for the browser to display the message. The unique sentinel distinguishes normal completion from a normal data value. [C01:23-51; R04]

### The current shutdown boundary

The queue has no maxsize, so it provides no explicit bounded backpressure. The stop flag is checked only after the synchronous iterator produces an item. A blocked SDK call or BLPOP can remain blocked, the iterator is not explicitly closed here, and the separate watcher has no shared stop flag. Neither thread is a durable service. [C01:24-53,152-160]

> An isolated test held the producer after its first item and confirmed that the async consumer received that item before the producer finished. Another test confirmed exception forwarding. These tests did not run Django, Redis or a browser. [reference/VALIDATION.md]

## The SSE contract and the missing UI handler

_sse serializes a dictionary as “data: <JSON>” followed by a blank line. The event name is carried in the JSON type field, not an SSE event: line. The included frontend reads the POST response using fetch and a streaming reader, buffering text until the blank-line delimiter. [C01:67-68; C15:575-606]

| JSON type | Important fields | When emitted |
| --- | --- | --- |
| session_created | session_id, title | Only for a new session |
| chunk | text | Model text; also outer exceptions as text |
| tool_start | tool | Before task submission |
| tool_log | log_id, tool, step, log, status, output | Watcher-observed progress and completion |
| tool_done | tool, output | After a completed tool_log is consumed |
| tool_error | tool, error | No event arrives during the 30-second wait |
| done | message_id | Normal conversation completion |

### Backend emission is only half of visibility

The collected static chat.js handles chunk, tool_start, tool_busy, tool_done, tool_error and done, but not tool_log or session_created. Consequently, that file does not display the detailed progress steps. It may be an older collected asset; the uploads do not establish which frontend your deployment serves. [C15:608-635]

```text
// Proposed addition to the actual frontend event switch
case "tool_log": {
  const row = document.createElement("div");
  row.textContent = ev.step ?? ev.log ?? "";
  getToolEl(ev.tool).appendChild(row);
  break;
}
```

This is only a small illustrative handler. A production implementation should preserve log rows when the done indicator changes, key separate calls by job ID, deduplicate by event ID and render untrusted text safely. The current tool_start/tool_done payloads contain no job ID, so richer correlation requires a backend contract change too. [C01:149,175-178; proposed design]

> examples/current_events.sse contains source-shaped example frames. They are illustrative, not captured live logs or actual weather measurements.

## Completion, timeout and failure are different

| Situation | What this source does | What a stronger contract should do |
| --- | --- | --- |
| Task raises an exception | Watcher turns it into output.error but marks completed; stream emits tool_done | Emit failed with typed error, not success-like completion |
| Task is quiet for 30 seconds | Stream emits tool_error and sends a timeout result to Gemini | Separate idle heartbeat from total deadline |
| HTTP client disconnects | Async bridge sets a local stop flag only | Apply an explicit detach-or-cancel policy |
| Watcher fails while logging | Thread can exit without a terminal event | Persist failure and reconcile unfinished jobs |
| Outer stream exception | Emit a chunk with error text; no normal done is guaranteed | Send a structured error and terminal lifecycle event |
| Several function calls returned | Only the first selected call is handled | Deliberately process all calls or reject unsupported batches |

These are source-level observations, not reports of your production incidents. The mock probes confirmed the failed-get/completed mismatch and the queue framing, while the remaining rows follow the branches visible in stream.py and the client. [C01:137-192; C02:44-81; reference/VALIDATION.md]

### A timeout can leave real work running

Breaking out of the BLPOP loop does not revoke the Celery job and does not terminate the watcher. If the worker later completes, the watcher can still write a log and append a terminal event even though the original stream no longer consumes it. For an agent that changes files, “the UI timed out” must never be treated as proof that execution stopped. [C01:160-171; C02:44-74]

### Where the current saved record ends

AILog stores text and a message relation. It is not a durable structured Job model: it has no explicit job status, input schema version, cancellation state, parent agent run, tool result or replay cursor. The stream:<job_id> list is temporary and destructive. Those are the first gaps to address before adding long-running cooperating agents. [C12; C02:64-81; proposed roadmap]

## Walk one request from end to end

Example prompt: “Get weather for Karachi.” This is a source-derived walkthrough, not a live weather query. The model is not guaranteed to choose a tool for every phrasing; the trace assumes it returns get_weather with city=Karachi.

| Step | Execution location | What to look for |
| --- | --- | --- |
| 1. Submit prompt | Browser -> Django | Authenticated POST and session ownership check |
| 2. Discover tools | Django -> Redis -> laptop | tools.list_tools returns get_weather schema |
| 3. Ask Gemini | Backend producer thread | Text chunks or a get_weather function call |
| 4. Submit weather job | Backend -> laptop.tools | Task name tools.get_weather and city argument |
| 5. Fetch providers | Laptop worker | Weather _notify calls around sequential providers |
| 6. Observe progress | Backend watcher thread | Changed PROGRESS messages become AILog and tool_log |
| 7. Stream progress | Producer -> async queue -> HTTP | tool_log JSON reaches the SSE consumer |
| 8. Return result | Watcher -> stream -> Gemini | Completed event, tool_done and function_response |
| 9. Finish answer | Backend -> browser/database | More chunks; save Message.content; emit done |

The important join is the Celery job ID: the watcher publishes to stream:<job_id> and the waiting loop consumes the same key. The model message ID links saved logs to a chat response. The HTTP payload currently exposes log IDs but not the Celery job ID itself. [C02:60-81; C01:151-160]

### What was checked while preparing this package

Twelve isolated checks completed successfully as checks: discovery dispatch, tool dispatch, ignored dependency injection, progress deduplication, failure-labelled-as-completed behavior, Redis event shape, incremental bridge delivery, bridge exception propagation, schema symbol mismatch, active catalogue, missing bundled UI handler and SSE framing. Some successful checks confirm defects rather than correctness. [reference/VALIDATION.md]

> Not executed: the full Django or Celery test suites, Docker startup, a real broker, external model/weather requests, a deployed frontend, GUI automation or Antigravity. Fix and integration-test the source before describing this as a production-verified migration.
