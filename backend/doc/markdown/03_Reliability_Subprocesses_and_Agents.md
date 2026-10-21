# From tool jobs to cooperating agents

A practical hardening plan, subprocess boundary and Antigravity roadmap

Reviewed against the uploaded source on 18 October 2026. Source IDs resolve in ../reference/SOURCES.md.

## Fix the execution contract before adding agents

The architecture is a useful foundation: one control path can submit work, and one event path can show progress. The next milestone should be a trustworthy single-tool lifecycle, not immediately more autonomous agents. The priorities below are proposed engineering work based on this snapshot.

| Priority | Change | Evidence / acceptance gate |
| --- | --- | --- |
| P0: startup | Resolve _schema_to_gemini imports consistently | C03-C04, C14: import path loads cleanly |
| P0: visibility | Handle tool_log in the deployed frontend | C15: every received step is visible and retained |
| P0: truthful terminal state | Separate success, failure, timeout and cancellation | C02:54-58: raised failure never appears as success |
| P1: lifecycle | Persist Job records, deadlines and disconnect policy | C01:160-171, C12: reconnect can identify real job state |
| P1: routing/security | Restrict queue consumers and authorized tool/device mapping | C11:25: laptop worker does not steal backend tasks |
| P1: delivery | Move required progress to an append-only event channel | C02:44-81: replay survives a disconnected browser |
| P2: orchestration | Add bounded multi-call handling and explicit tool-turn budgets | C01:127-186: parallel and repeated calls are controlled |

### Two small code-quality corrections

CeleryToolClient stores self._app but list_tools and call_tool_async use module-global app. Change them to self._app.send_task so tests and alternate app configurations actually take effect. Also normalize outputs without output or {} so valid falsey values survive. Both are localized fixes; neither alone makes execution durable. [C02:18,23,42; C01:175]

Treat the legacy google.generativeai dependency as a separate compatibility workstream. Google’s migration guidance recommends the Google GenAI SDK; a migration may also enable a cleaner native-async path. Do not combine a broad SDK upgrade with progress fixes without regression tests for streaming, function calls and result serialization. [C25; R19; proposed sequencing]

> Definition of success: a user can distinguish queued work, active work, lost connectivity, failed work and completed work, and the system can prove which state a job is actually in.

## Make progress durable and replayable

Proposed lifecycle: queued -> running -> succeeded, failed, cancelled or timed_out. “Disconnected” describes a client connection, not the tool’s execution state. A job can continue while the browser reconnects. Add explicit run records instead of deriving execution truth from whichever SSE frame a client last saw.

```text
# Proposed event envelope, not the current tool_log schema
{
  "schema_version": 1, "event_id": "example-event-0007",
  "job_id": "job-123", "run_id": "run-456",
  "parent_job_id": null, "sequence": 7,
  "tool": "review_pr", "status": "running",
  "type": "job.progress", "message": "Tests finished",
  "timestamp": "2026-10-18T10:00:00Z"
}
```

### Keep work and event delivery separate

Celery can remain the job executor. Publish durable progress at the worker or adapter when a step happens, rather than reconstructing every step from sampled latest state. Redis Streams can append entries with XADD and let readers use IDs as cursors with XREAD. Retention and Redis persistence still require deliberate configuration. [R15-R16; proposed design]

Use a job-scoped event stream and persist a last-seen cursor per client or expose a resume parameter. Separate readers can replay retained events. Do not put every browser in the same consumer group expecting broadcast: work-sharing semantics and fan-out are different requirements. A database event table plus an outbox is another option when job state and event publication must commit together. [Proposed design]

### Three limits, not one timeout

Define a heartbeat interval for connection health, an idle-progress threshold for user messaging, and an absolute job deadline for execution policy. A heartbeat must never invent a tool step or percentage. On cancellation, record the request, notify the owning worker, stop child processes where appropriate and record whether cancellation actually succeeded.

Store authenticated ownership on the Job record; do not trust an arbitrary job_id from a URL. Include tenant, device and capability routing in server-owned metadata. Apply idempotency keys to side-effecting work and retain structured result/error envelopes. Retried or redelivered work must not silently repeat an irreversible action. [Proposed design; R01]

## Operate the current topology deliberately

These are suggested local verification commands after the schema import fix and after configuring your existing .env safely. Run the worker on the Docker host, from the utils directory. No credentials, databases or original archives are included in this package. Commands were not run against your deployment.

```text
# From backend/; uses your existing local configuration
docker compose up -d --build redis postgres django
docker compose exec redis redis-cli -p 6382 PING

# From utils/ on the host; restrictive queue is intentional
uv sync
PYTHONPATH=src uv run celery -A app worker -l info \
  -Q laptop.tools -n laptop-tools@%h
```

The uploaded start.sh subscribes to laptop.tools,celery. That can compete with the backend’s default worker for unrelated default-queue tasks, which the laptop app may not register. Restrict the laptop consumer to laptop.tools unless you intentionally register and support those other tasks. This is a routing risk in the configuration, not proof that a task has already been stolen. [C11:25; C06:68-71; C08:18-23; R12]

```text
# Host terminal, from utils/: inspect live worker routing
PYTHONPATH=src uv run celery -A app inspect active_queues
PYTHONPATH=src uv run celery -A app inspect registered

# Use a token obtained through your normal sign-in flow
curl -N -X POST http://127.0.0.1:8002/api/v1/chat/stream/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"prompt":"Get weather for Karachi"}'
```

### Debug without consuming someone else’s events

Use TYPE, LLEN, LRANGE and TTL on a known stream:<job_id> key for read-only inspection. Do not use BLPOP as a debug viewer while the chat is consuming that list: it removes events. Empty lists can simply mean that the stream consumer already drained them. Compare the worker log, AILog rows and SSE frames together. [C02:60-81; R06]

> The current SSE payload does not expose job_id. Add correlation logging around dispatch or a proposed job_id field before relying on per-job production diagnostics. Keep Redis private and avoid printing secrets from tool arguments.

## Acceptance tests and useful measurements

The included source tests use mocks for dispatch and weather providers. The documentation probes also used mocks and selected definitions; neither proves end-to-end behavior. Use the matrix below as a proposed integration-test plan. [C21-C22; reference/VALIDATION.md]

| Scenario | Expected observable result |
| --- | --- |
| Import/startup | Chat utilities import; routes load; no missing schema symbol |
| One successful tool | Correct device executes; progress appears before final result; one success state |
| Fast consecutive updates | Every required event survives in the proposed durable path |
| Silent long task | Heartbeat continues; silence is not misreported as completed or cancelled |
| Tool/provider failure | Typed error and failed state; no success-like Done label |
| Client disconnect/reconnect | Authorized replay resumes without losing or duplicating retained events |
| Worker loss or Redis restart | Job reaches a reconciled state; retry policy does not repeat unsafe effects |
| Two jobs / two users | No cross-job logs, cross-user access or device misrouting |
| Noisy subprocess / cancellation | Bounded logs; both pipes drained; descendants cleaned up; terminal state stored |

### Measure the whole path, not just one sleep

Record submission, worker start, worker event creation, persistence, HTTP forwarding and browser display timestamps. Measure queue wait, tool duration, progress lag, model request count, token usage, duplicate events, dropped events, cancellation latency and jobs with no terminal state. Use correlation IDs so the same job can be traced across those observations. [Proposed instrumentation]

The source’s 0.1-second sleep means roughly ten loop iterations per second per active watcher before adding work and scheduling overhead. Each iteration can perform several backend state reads, so it is not merely ten Redis operations. More jobs also mean more watcher threads, producer threads, connections and log writes. Load-test rather than multiplying one-job success into a capacity claim. [Calculation/inference from C02:46-52; C01:42,152]

> Production readiness requires failure-path evidence. A screenshot showing a few fast progress lines is helpful, but not evidence of replay, cancellation, durability, isolation or token savings.

## Subprocess tools: a new execution boundary

Subprocesses already exist below your current tool wrappers. ghToolkit uses subprocess.run, and the environment launcher uses Popen to start local applications. What is missing is a general, supervised subprocess adapter that turns process output, errors, exit status and cancellation into the same job/event contract. [C20:44-106; C19:8-38]

### Explain stdin, stdout and stderr simply

stdin carries data into a child process. stdout carries its normal output; stderr carries diagnostics. Popen starts the child and gives the parent handles for supervision. A process launched on the laptop worker stays a laptop process; launching it inside Django’s container would instead create a container process. [R13; proposed adapter placement]

```text
# Illustrative launch shape only; not a complete runner
proc = subprocess.Popen(
    approved_argv, cwd=approved_workspace,
    stdin=subprocess.DEVNULL,
    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    text=True, shell=False,
)
```

The launch line is the easy part. Drain stdout and stderr concurrently using reader threads or async subprocess APIs, apply bounded buffering and truncation, publish sanitized lines or parsed JSON events, supervise a deadline even when no line arrives, and always collect the exit code. On cancellation or timeout, terminate the process group and escalate safely after a grace period. Do not wait for stdout EOF while ignoring a full stderr pipe. [Proposed runner requirements; R13]

### Do not equate local access with unrestricted access

Use a fixed allowlist of executables and validated argument builders, a restricted working directory, least-privilege credentials and explicit approval for risky changes. shell=False avoids shell interpretation but does not neutralize an unsafe argument or powerful executable. Existing shell=True paths should not become a generic model-controlled runner. [C27:59-62; proposed security design]

Replace global sys.stdout = StringIO capture in the disabled wrappers with an explicit event callback or child-process pipe. Global stdout capture is not isolated per concurrent thread and only returns buffered output at the end. Each adapter should return the same typed result, artifact references and terminal status, regardless of how its tool runs. [C16-C18; proposed design]

## Antigravity: connect an agent, not just a window

Your environment code already defines launch_antigravity, which starts the command antigravity and positions a GUI window. It does not submit an agent prompt, receive structured progress or return an agent result. The setup_project task that can call environment functions is also disabled in the active tool registry. [C19:129-136; C08:11-15; C09:21-29]

### Verified external integration surfaces

As checked on 18 October 2026, Google’s Antigravity documentation describes a headless agy CLI with stream-json output, and a Python SDK. The CLI documents init, step_update and result events; stdout is machine-readable while stderr carries diagnostics. Headless use requires prior authentication. These documented interfaces are not integrated or tested in your uploaded code. [R17-R18]

```text
# Documented CLI shape; a proposed future tool invocation
agy -p "Review this workspace without modifying files" \
  --output-format stream-json
```

A prompt saying “do not modify” is not a permission boundary. Configure restricted permissions and an isolated workspace before launching a run. Also verify the result and required artifacts: the documented headless policy can deny a tool action while the process still exits successfully. An exit code of zero alone is not proof that your intended workflow was completed. [R17; proposed integration gate]

### Proposed adapter boundary

```text
Celery agent task on the laptop
  -> authenticated, permission-scoped agent runner
  -> parse provider events and redact sensitive payloads
  -> normalize into Aevora JobEvent records
  -> publish progress, artifacts and final outcome
  -> return a compact result to the coordinator
```

Make the adapter own agent conversation IDs, workspace IDs, process cleanup, retry policy and total budget. Keep the browser contract provider-neutral: an Antigravity step, a Python-tool step and a subprocess log should not require three different chat implementations. Store provider-native details separately for authorized debugging. [Proposed design]

> Read the installed CLI/SDK version’s contract and test authentication, permission denial, malformed output, cancellation and artifact paths before enabling the tool. The verified documentation makes this a concrete integration direction, not a claim that your project already runs Antigravity agents.

## How cooperating “super agents” would work

Treat “super agent” as a coordinated system of bounded workers, not one unlimited process. A coordinator interprets a goal, builds a plan, delegates jobs to suitable devices or services, evaluates their artifacts and asks for approval when the next action exceeds its authority. [Proposed architecture]

```text
User goal -> coordinator -> durable workflow/run
  -> research agent -> evidence artifact
  -> implementation agent -> isolated patch
  -> test agent -> test report
  -> review agent -> findings and recommendation
  -> human approval -> permitted final action
```

### Combine parallel work with explicit dependencies

Independent analysis jobs can run together; implementation should wait for approved requirements; tests should consume the exact produced revision; review should inspect the same patch and test artifacts. Celery Canvas provides chains, groups and chords for workflow composition. These primitives are an option for scheduling, not a substitute for your own approval, budget and artifact model. [R14; proposed design]

| Shared contract | Why agents need it |
| --- | --- |
| Run and parent job IDs | Tie each delegation back to a user goal |
| Versioned inputs and artifacts | Ensure every agent works on the same evidence or revision |
| Capability and device routing | Send laptop-only work only to its authorized device |
| Per-run budgets and limits | Bound model turns, cost, retries and child job count |
| Workspace and permission boundaries | Avoid agents overwriting one another or escaping scope |
| Verification and approval records | Separate producing a result from trusting or applying it |

Queue names alone are not authorization. A shared laptop.tools queue also cannot identify which of several laptops should receive a job. Introduce server-controlled routing and worker identity, with per-workspace locks or isolated branches/worktrees where needed. Do not let one agent grant itself permissions or approve its own destructive action. [Inference from C02:12,42; proposed design]

> MCP can remain useful inside this design: an adapter can call MCP tools while Celery schedules the job and your event layer reports progress. MCP, subprocesses and agent SDKs can be execution backends behind one contract rather than competing all-or-nothing choices. [R08-R09; proposed design]

## A phased plan with concrete exit gates

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 1. Establish the baseline | Fix imports, UI events and terminal statuses | One successful and one failed tool trace are accurate end to end |
| 2. Stabilize the job layer | Job model, ownership, deadlines, heartbeat and cancellation | Disconnect, silent-task and worker-loss tests pass |
| 3. Stabilize the event layer | Durable event IDs, replay and reconciliation | Reconnect recovers retained events without mixing users/jobs |
| 4. Add supervised subprocesses | Allowlisted runner with bounded log delivery and cleanup | Noisy output, failure and process-tree cancellation tests pass |
| 5. Add one Antigravity adapter | Scoped CLI/SDK execution and normalized results | One read-only agent task is repeatable and fully observable |
| 6. Add bounded cooperation | Coordinator, dependencies, artifacts and approval gates | A small multi-agent workflow has auditable outcomes and budgets |

### Suggested first cooperating workflow

Use a read-only pull-request review before autonomous code changes: one job gathers an approved diff, another checks tests or static findings, and an agent produces a structured review artifact. The coordinator compares evidence and presents a draft. Posting comments or applying a patch requires a separate approved action. This reuses the intent of your existing review_pr wrapper without treating it as currently enabled. [C17; proposed rollout]

### The design rule to keep

> One tool contract. One observable job lifecycle. Several execution adapters. Explicit permissions between agents.

That rule lets a Python function, a subprocess, a local MCP server or an Antigravity agent plug into the same platform without making stream.py understand every implementation. Move durable orchestration out of the lifetime of one HTTP response; let HTTP be a view onto work that can be inspected and resumed. [Proposed end state]

Use reference/SOURCES.md for code and official documentation, reference/VALIDATION.md for the precise checks performed, and examples/ for clearly labelled current-shape and proposed event examples. The package explains and plans the migration; it does not contain an applied code patch or a claim of completed multi-agent integration.
