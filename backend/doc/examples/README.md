# Event examples

All files in this directory are illustrative documentation data, not captured executions. They contain no real weather measurements, credentials or user records.

`current_events.sse` uses the current backend's JSON field shapes and framing. It assumes the watcher happened to observe three weather steps. It is not a guarantee that polling delivers every step. `Connecting...` and `Synthesizing...` can be too brief to observe. IDs and output are obvious placeholders. The final weather result is a string, as in the source.

`current_failure_behavior.sse` demonstrates the existing defect: an exception becomes `output.error`, but the watcher emits `status: completed` and the stream emits `tool_done`. It is not the recommended failure contract, nor a recording of a production incident. The model's later answer is omitted.

`proposed_job_event.json` illustrates a future versioned, correlated event envelope. `_example_note` is explanatory metadata for this documentation sample, not a proposed wire field. Sequence values are illustrative; an event sequence is not automatically a Redis stream ID. Progress counts must be reported by the executing tool and never invented from elapsed time.

`proposed_tool_contract.json` sketches a server-owned adapter contract. Its deadline, queue and identifiers are examples, not deployed configuration. Allowlisting and permissions must be enforced, not merely represented in JSON or a prompt.

The current backend uses a destructive Redis LIST and has no durable Job/Event model. None of the proposed fields, device routing or agent permissions has been integrated. See Guide 03 and `../reference/SOURCES.md`.
