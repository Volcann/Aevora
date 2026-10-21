# Editable diagrams

The `.mmd` files are Mermaid definitions. Open them in a trusted Mermaid-capable editor to render, or read the plain-text diagrams already embedded in the guides.

01 is the previous architecture reconstructed from the user's account, not an inspected historical implementation. 02 and 03 trace the intended current source path and must be read with the import, progress-delivery and frontend caveats in Guide 02. Diagram 03 condenses repeated Redis polling and delivery for readability: updates are sampled, not transactionally paired with every worker state change. Diagram 04 is entirely proposed.

The current `stream:<job_id>` structure is a Redis LIST, not Redis Streams. Antigravity and the durable agent/event layer are future integrations. No image or diagram implies that a deployment or agent workflow was executed.
