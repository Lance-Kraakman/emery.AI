# SSE Event Format

Streaming events from Python to frontend must match the TypeScript contract.

**Primary event types** (discriminated by `type` field):
- `step_progress` — Execution step updates
- `content` — Text content chunks
- `awaiting_input` — HITL requests (plan approval, questions)
- `error` — Error responses

**Step progress structure:**
```python
{
  "type": "step_progress",
  "step_type": "ACTION",  # PLANNING, ACTION, REASONING, FINAL, INFO
  "step_name": "Tool: database_crud",
  "content": "Creating table 'users'...",
  "metadata": {"tool": "...", "step_id": "..."},
  "step_index": 3  # Sequential ordering
}
```

**Gotchas:**
- The `type` field must exactly match frontend expectations (see `src/lib/chat/types/sse-events.ts`)
- Field names use `snake_case` in Python, converted to `camelCase` in route handler
- `step_index` should be sequential; use 999 for terminal events (FINAL)

See `grpc/response_types.py` and `src/lib/chat/types/sse-events.ts`.
