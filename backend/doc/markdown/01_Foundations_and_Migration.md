# From MCP to observable tool jobs

Redis, background jobs, containers and threads explained from your code

Reviewed against the uploaded source on 18 October 2026. Source IDs resolve in ../reference/SOURCES.md.

## The migration in one picture

Your backend decides what tool is needed; a worker on your laptop executes it; Redis carries the job and its state; Django forwards observed updates to the chat stream. This separates model reasoning, local execution and progress delivery. [C01:106-186; C02:22-81; C08:3-24]

### Before: the architecture you described

```text
Chat backend in Docker
  -> laptop MCP manager over HTTP/SSE
  -> local MCP server over stdin/stdout
  -> laptop application or tool
```

The network-facing MCP manager was the bridge between the container and local processes. A standard-input/output connection belongs to processes on one machine; your manager could start or talk to laptop processes and expose their tools over a network transport. The old topology is reconstructed from your description, not from an old manager implementation in these uploads. [User account; R09]

### Now: the path visible in the uploaded source

```text
Django / Gemini -> named Celery job -> Redis
Laptop Celery worker <- laptop.tools queue
Laptop task -> progress/result -> Redis
Django watcher -> AILog + Redis event list
Django stream -> browser-facing SSE
```

> Scope: “Implemented” means present in source, not proven deployed. This snapshot has a schema import blocker and a bundled frontend event gap. The walkthrough explains the intended path and marks those issues explicitly.

Read this guide first, then Guide 02 for stream.py, then Guide 03 for hardening, subprocesses and cooperating agents. Source IDs such as C01 and R05 resolve in reference/SOURCES.md. No application source was changed while preparing these documents.

## Redis: a shared place for work and updates

Think of a background job as a work ticket. Redis is the shared counter where the backend leaves tickets and workers collect them. Celery supplies the task protocol and execution machinery; Redis does not execute your Python weather function. [R01; R02]

| Role in this project | What it contains | Who uses it |
| --- | --- | --- |
| Celery broker | Queued task messages, including a task name and arguments | Django publishes; laptop worker consumes |
| Celery result backend | Latest task state, progress metadata and final result | Worker writes; watch_job reads |
| Application event list | JSON tool_log events under stream:<job_id> | Watcher RPUSHes; stream loop BLPOPs |
| Persistent chat log | AILog rows in the Django database, not Redis | Watcher writes; message serializer exposes |

The first three roles share the configured Redis instance in this snapshot. They are different uses of the same service, not one interchangeable queue. The database log is another store with a different purpose. [C02:19,60-81; C07:107-113; C08:3-7; C12; C13]

### Three queues that are easy to confuse

laptop.tools is the Celery work queue. stream:<job_id> is your own Redis list for observed progress events. asyncio.Queue() lives only in Django process memory and transfers output from a producer thread to the ASGI event loop. A message in one does not automatically appear in either of the others. [C01:23-51; C02:12,73-81]

### What RPUSH and BLPOP mean here

RPUSH appends an event on the right. BLPOP waits for an item and removes one from the left. This creates a simple FIFO event channel. It is not Redis Pub/Sub and, despite the key prefix “stream:”, it is not the Redis Streams data type. Two consumers of the same list divide the events rather than each receiving a full copy. [C02:73-81; R06]

> Memory hook: broker = work waiting; result backend = latest job state; event list = updates waiting; database = saved chat log.

## Background jobs: request work, do not move code

A normal function call runs in the caller’s process and returns when it finishes. A Celery submission instead asks another process to run a registered task. The immediate return is a job handle, not the weather report. In your code, that handle is called background_job. [C02:26-42; R01]

```text
# Source-equivalent dispatch for an example request
app.send_task(
    "tools.get_weather",
    kwargs={"city": "Karachi"},
    queue="laptop.tools",
)
```

Only a task name and serializable arguments travel through the broker, together with Celery metadata. The Python implementation must already exist and be registered in the laptop worker. The backend does not ship a function, copy its virtual environment or remotely enter a laptop process. [C02:34-42; C08:8-15; C10:92-95; R12]

### Discovery is a job too

Before constructing Gemini’s tools, the backend submits tools.list_tools to the same queue and calls get(timeout=10). The laptop task returns descriptions and input schemas. The advertised model tool is get_weather; execution maps it to tools.get_weather. [C02:22-24,41-42; C03:27-56; C09:4-19]

### What “background” does and does not promise

The actual tool work runs outside the web process. However, the current chat still waits for tool completion before giving the result back to Gemini. Discovery also waits synchronously. A background task is therefore not the same thing as an immediate final chat answer, nor does it automatically provide cancellation, retries or durable user-visible progress. [C01:151-186; C02:22-58]

The current worker actively includes discovery and weather. setup_project, review_pr and report_status wrappers exist, but their includes and catalogue entries are commented out. They should be described as present but disabled, not currently exposed tools. The README is broader than the active code. [C08:8-15; C09:21-48; C16-C18; C26]

> A Celery task, an asyncio task and an operating-system thread are three different things. The word “async” in call_tool_async names a dispatch method; that method itself is a regular def, not an async def.

## How Docker reaches a laptop tool

The active bridge is shared Redis connectivity. Django does not open an HTTP connection to a local tool server in this path. It publishes a job; the laptop worker already has its own broker connection and consumes the job. [C02:19-42; C06:11-16; C08:3-7]

| Process location | Redis address in the snapshot | Reason |
| --- | --- | --- |
| Django container | redis://redis:6382/0 | redis is the Compose service name |
| Laptop worker | redis://127.0.0.1:6382/0 | Uses the host-published Redis port |
| Redis container | redis-server --port 6382 | Service and published port both use 6382 |

Compose publishes Redis as 127.0.0.1:6382:6382. The first address restricts that published port to the Docker host’s loopback interface. The laptop and containers reach the same Redis through different addresses. This only works as written when the worker is on that Docker host. [C06:104-118; R07]

### Why localhost was confusing

Inside a normal bridge-networked container, 127.0.0.1 means that container, not the laptop. Inside the laptop worker, it means the laptop. The Compose file also defines host.docker.internal, but the Celery path shown here does not use it: Django uses the redis service name. [C06:7-16; C08:3; R07]

### Why the worker belongs on the laptop

A local worker can use the laptop’s installed applications, working directories and user permissions. A container does not gain those capabilities merely because it can send a job. GUI access still depends on the worker’s login session, display environment and operating-system permissions; starting the wrong service account can break local app control. [C16:4-5,20-22; C19:8-38]

For a future cloud backend, do not expose this unauthenticated local Redis port publicly. Design an authenticated device connection, private network or outbound local-agent gateway. Route jobs to a specific authorized device rather than assuming every worker shares one laptop. This is a proposed deployment extension, not present source behavior.

> Simple explanation: the container sends a work ticket to Redis; the laptop worker receives it and executes using the laptop’s own environment.

## Why multithreading was used

Concurrency means several activities can make progress without one waiting activity freezing the others. A process has its own execution environment; threads share a process; an async event loop switches among operations that yield control. Threads are useful for blocking I/O. In ordinary GIL-enabled CPython, they are not a general way to speed up CPU-heavy Python calculations. [R03; R04]

| Execution unit | Its job in your code | Why it exists |
| --- | --- | --- |
| ASGI event loop | Awaits the in-memory queue and yields HTTP response chunks | Keeps async streaming responsive |
| Producer thread | Runs synchronous _gemini_stream, including SDK iteration and BLPOP | Moves blocking work off the event loop |
| Watcher thread | Polls one Celery job and writes progress events | Produces updates while the producer waits for them |
| Laptop Celery worker | Runs the actual tool task outside the backend | Provides local execution and task isolation |

The two explicit threading.Thread calls are in stream.py at lines 42 and 152-156. One adapts the whole synchronous stream. The other observes the tool job. They do not run the weather providers themselves. Those provider calls are sequential inside get_weather_task. [C01:17-53,149-179; C10:102-137]

### The dependency that would otherwise stall

The stream loop waits in BLPOP for an event. The watcher must run concurrently to create that event. Running the watcher synchronously to completion before consuming events would delay delivery until after the tool finishes. Running blocking waits directly in the async loop would also interfere with other async work. This explains the chosen bridge, not a requirement that every future implementation use threads. [C01:151-173; C02:44-81]

The worker launch command does not specify a thread pool. Do not infer “Celery uses our two threads” from the backend code. Also, the chat loop handles one selected function call at a time; it is not yet a parallel multi-tool or multi-agent scheduler. [C11:25; C01:137-186]

> Memory hook: Celery moves tool execution to the laptop. Threads keep blocking backend work from stopping progress delivery. asyncio supplies the HTTP-facing streaming bridge.

## What produces the real-time updates

The update begins in the tool, not in a model-generated status sentence. Weather’s _notify function writes PROGRESS with metadata containing msg. watch_job observes that latest state and publishes a user-facing log. These are real tool-stage notifications in the source, although the delivery mechanism is best-effort polling rather than a lossless event stream. [C10:13-18; C02:44-58]

```text
1. Task: update_state(PROGRESS, {"msg": step})
2. Celery result backend stores latest state
3. watch_job sees a changed message
4. _push creates an AILog database row
5. _push RPUSHes JSON to stream:<job_id>
6. pop_event BLPOPs that JSON
7. _gemini_stream yields an SSE data frame
8. Async bridge forwards it toward the browser
```

### The three timings have different meanings

| Setting | Meaning | Not a guarantee of |
| --- | --- | --- |
| 0.1-second sleep | Watcher pauses between polling iterations | 100 ms end-to-end delivery |
| 30-second BLPOP timeout | No next event arrived during this wait | Tool was killed or has stopped |
| 120-second EXPIRE | Expiry of the event-list key after a push | Durable replay or job execution deadline |

Each Celery state update replaces the previous stored state; the watcher remembers only the last message it saw. Several quick changes between polls can disappear. The first “Connecting…” and the final “Synthesizing…” weather messages are particularly brief in this code and may never be observed. Repeated identical messages are deliberately suppressed. [C10:96-104,137-158; C02:45-52; R01]

AILog preserves only events the watcher actually sees, not every worker log line. The disabled wrappers capture stdout into StringIO and return it at the end; that is not live stdout streaming. Also, the bundled chat.js has no tool_log handler, so emitting an SSE event does not by itself prove that this UI displays it. [C12; C16-C18; C15:608-635]

> MCP itself supports optional progress notifications. The improvement is your new explicit progress pipeline, not a rule that MCP cannot stream progress. [R08]

## Token cost: what changed and what did not

The transport is not the token meter. MCP messages and Celery messages do not inherently become model tokens. Tool descriptions, schemas, conversation context and tool results can contribute when your application sends them to the model. Changing the dispatcher alone therefore does not establish a token saving. [R08-R11]

### What your code actually sends

get_gemini_tools builds function declarations, and _gemini_stream supplies those declarations when constructing the model. After a tool completes, the loop sends function_response with result back to Gemini. Ordinary progress events are yielded to the browser instead of being appended to the model input at each step. This is the useful separation: the UI can show progress without asking the model to narrate every step. [C03:40-56; C01:106-128,160-185]

The 60-second gemini_tools_cache is an application cache. It can avoid repeated worker discovery and declaration conversion. It is not evidence of provider-side prompt caching and does not automatically remove tool-schema tokens from model requests. History is limited to the last five messages in Python, but the query currently materializes all messages before slicing; the limit is also by message count, not by token count. [C03:40-56; C01:71-88]

### A fair before/after measurement

Use the same model, prompt set, enabled tools and task results. Record model request count, input and output token usage, tool-schema size, tool-result size, retries and time to first progress update. Compare distributions across repeated runs, not one fast demonstration. Include any downstream agent’s model usage as well. No measured savings or latency benchmark was supplied, so this package claims no percentage improvement. [Measurement proposal; R11]

### Your migration story, in plain language

> “I moved local tool execution from my MCP manager path to named Celery jobs. My Docker backend sends jobs through Redis, and a laptop worker runs the tools. A watcher observes progress, saves logs and feeds SSE updates to the chat. Threads bridge the blocking code into the async response. This gives me an execution and visibility layer that I can extend to subprocesses and agents.”

That explanation describes the design. Guide 02 identifies the snapshot’s blockers and exact implementation limits, so it should not be presented as a claim that the full uploaded stack has passed a live end-to-end test.
