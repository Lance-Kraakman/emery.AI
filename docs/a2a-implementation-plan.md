# A2A Protocol Implementation Plan

## Overview

Add A2A (Agent-to-Agent) protocol support to the published agents system. HTTP JSON-RPC binding in Next.js first, with architecture designed so a gRPC A2A binding can be added to the Python workers later.

**Key architectural principle:** The A2A application service is transport-agnostic. The JSON-RPC route (Next.js) and a future gRPC A2A servicer (Python) are both thin transport layers calling the same backend logic.

**A2A types are NOT used internally.** A2A is a wire protocol for interop — translation happens at the boundary. Internal domain types (PublishedAgent, Task, ExecutionResult, etc.) remain unchanged. Reasons:
- Our domain is richer than A2A (security grades, billing modes, publication workflows, rate limits)
- A2A is intentionally generic/opaque — designed for cross-system interop, not internal modeling
- Protocol versioning — A2A is at v0.3 and evolving; changes should only affect the transport layer
- We already have multiple external surfaces (REST, OpenAPI, ChatGPT plugins) — A2A is just another one

---

## Phase 1: Domain Layer (A2A types + interfaces)

### 1.1 Create `src/ddd/domain/a2a/types.ts`
Pure A2A protocol types — no transport or infrastructure dependencies:
- `A2ATaskState` enum (SUBMITTED, WORKING, COMPLETED, FAILED, CANCELED, INPUT_REQUIRED, REJECTED, AUTH_REQUIRED)
- `A2APart` union: `TextPart`, `FilePart`, `DataPart`
- `A2AMessage`: messageId, contextId, taskId, role (USER/AGENT), parts[], metadata
- `A2AArtifact`: artifactId, name, description, parts[], metadata
- `A2ATask`: id, contextId, status, artifacts[], history[], metadata
- `A2AAgentCard`: protocolVersions, name, description, provider, capabilities, securitySchemes, skills[]
- `A2ATaskStatus`: state, message, timestamp
- `PushNotificationConfig`: url, token, authentication
- `A2A_ERROR_CODES` const object (task not found, not cancelable, etc.)
- Method param types: `SendMessageParams`, `TaskGetParams`, `TaskListParams`, `TaskCancelParams`, etc.

### 1.2 Create `src/ddd/domain/a2a/interfaces/a2a-task-repository.ts`
- `A2ATaskMapping` entity: a2aTaskId (UUID), a2aContextId, internalTaskId, publishedAgentId, metadata, timestamps
- `A2APushNotificationConfig` entity: id, a2aTaskId, url, tokenHash, authSchemes, isActive, timestamps
- `IA2ATaskMappingRepository`: createMapping, findByA2ATaskId, findByInternalTaskId, findByContextId, listByPublishedAgent (cursor pagination)
- `IA2APushNotificationRepository`: upsert, findByTaskId, listByTaskId, delete

### 1.3 Update `src/ddd/domain/published-agents/types.ts`
- Add `a2a?: { enabled: boolean }` to `PublishedAgentIntegrations`
- Add `'a2a'` to `IntegrationType`
- Extend usage log `requestType` to include `'a2a'`

### 1.4 Create `src/ddd/domain/a2a/index.ts` — barrel export

---

## Phase 2: Database Schema

### 2.1 Add tables to `src/ddd/infrastructure/db/schema.ts`

**`a2a_task_mappings`** — bridges A2A task IDs to internal task IDs:
- id (serial PK)
- a2a_task_id (uuid, unique, default random)
- a2a_context_id (uuid) — groups related tasks in a conversation
- internal_task_id (uuid, FK → tasks.id, cascade delete)
- published_agent_id (integer, FK → publishedAgents.id, cascade delete)
- metadata (jsonb)
- created_at (timestamp)
- Indexes on: a2a_task_id, a2a_context_id, internal_task_id, published_agent_id

**`a2a_push_notification_configs`** — webhook configs per task:
- id (serial PK)
- a2a_task_id (uuid, FK → a2a_task_mappings.a2a_task_id, cascade delete)
- url (text)
- token_hash (text, nullable) — SHA-256 of bearer token
- auth_schemes (jsonb, string array)
- is_active (boolean, default true)
- created_at, updated_at (timestamps)
- Index on: a2a_task_id

### 2.2 Update `PublishedAgentIntegrations` type in schema.ts
Add `a2a?: { enabled: boolean }` alongside existing chatgptPlugin, mcpServer, openaiAssistants.

### 2.3 Generate and run Drizzle migration

---

## Phase 3: Infrastructure — Repositories

### 3.1 Create `src/ddd/infrastructure/db/repositories/a2a/drizzle-a2a-task-mapping-repository.ts`
Implements `IA2ATaskMappingRepository`. Follows existing Drizzle repository patterns.
- Cursor-based pagination for `listByPublishedAgent` (id > cursor, ORDER BY id ASC, LIMIT n+1)
- Joins with tasks table for status filtering

### 3.2 Create `src/ddd/infrastructure/db/repositories/a2a/drizzle-a2a-push-notification-repository.ts`
Implements `IA2APushNotificationRepository`. Simple CRUD.

### 3.3 Create `src/ddd/infrastructure/db/repositories/a2a/index.ts` — barrel export

---

## Phase 4: Application Services (transport-agnostic)

### 4.1 Create `src/ddd/application/services/a2a/state-mapper.ts`
Pure functions mapping between internal task states and A2A states:
- `internalStatusToA2A(status: string): A2ATaskState`
- `a2aStatusToInternal(status: A2ATaskState): string`

Mapping: pending→SUBMITTED, in_progress→WORKING, completed→COMPLETED, failed→FAILED, cancelled→CANCELED

### 4.2 Create `src/ddd/application/services/a2a/message-translator.ts`
Pure functions translating between A2A message/part format and internal types:
- `a2aMessageToTaskInstructions(message: A2AMessage)` — extracts text from TextParts as task string, DataParts as context metadata, FileParts as attachments
- `taskResultToA2AArtifacts(result: unknown): A2AArtifact[]` — wraps string results as TextPart, objects as DataPart
- `buildA2ATask(...)` — assembles full A2ATask from internal task + mapping
- `buildA2AStatusUpdate(...)` — builds a status update event object
- `buildA2AArtifactUpdate(...)` — builds an artifact update event object

### 4.3 Create `src/ddd/application/services/a2a/agent-card-builder.ts`
Pure function that builds an `A2AAgentCard` from PublishedAgent + skills:
- Maps displayName → name, description → description
- Maps skills (name, description, input types) → A2A skill entries
- Sets capabilities: { streaming: true, pushNotifications: true }
- Sets security scheme: apiKey in header (X-API-Key)
- Takes `baseUrl` param so it's not coupled to request context

### 4.4 Create `src/ddd/application/services/a2a/a2a-application-service.ts`
Core orchestration service — **no HTTP/transport awareness**. Constructor takes repositories + existing services.

Methods (all return `Result<T>`):

**`sendMessage(publishedAgentId, organizationId, params)`:**
1. Validate published agent exists and has A2A enabled
2. Extract task instructions via `a2aMessageToTaskInstructions()`
3. Use contextId from message or generate new UUID
4. Call `agentTaskService.createAndExecuteTask()` (blocking — waits for result)
5. Create a2a_task_mappings row linking A2A task ID → internal task ID
6. Translate result to A2ATask via `buildA2ATask()`
7. Fire push notification if configured
8. Return A2ATask

**`sendMessageAsync(publishedAgentId, organizationId, params)`:**
Same as above but non-blocking — creates task, starts execution in background, returns immediately with SUBMITTED status. Used by streaming and push flows.

**`getTask(publishedAgentId, params)`:**
1. Look up a2a_task_mappings by a2aTaskId
2. Verify it belongs to this publishedAgentId
3. Load internal task from taskRepository
4. Build and return A2ATask with optional history (respecting historyLength)

**`listTasks(publishedAgentId, params)`:**
1. Query a2a_task_mappings with filters (contextId, status via join)
2. Load internal tasks for each mapping
3. Return paginated list of A2ATasks

**`cancelTask(publishedAgentId, params)`:**
1. Look up mapping, verify ownership
2. Call `agentTaskService.cancelTask(internalTaskId)`
3. Return updated A2ATask

**`pollTaskStatus(a2aTaskId)`:**
Helper for streaming — returns current A2ATask state. Called repeatedly by transport layer.

**Push notification config CRUD** — delegates to push notification repository.

### 4.5 Create `src/ddd/application/services/a2a/push-notification-dispatcher.ts`
Called after task state changes. Fire-and-forget HTTP POST to configured webhook URLs.
- `dispatchIfConfigured(internalTaskId, a2aTask)` — looks up push configs, sends to each active webhook
- Includes A2A-Version header and auth credentials from config
- Errors logged but don't fail the main flow

### 4.6 Create `src/ddd/application/services/a2a/index.ts` — barrel export

---

## Phase 5: Transport Layer — HTTP JSON-RPC (Next.js)

### 5.1 Create `src/lib/a2a/json-rpc-helpers.ts`
Utility functions for JSON-RPC envelope formatting:
- `jsonRpcSuccess(id, result)` → NextResponse
- `jsonRpcError(id, code, message, data?)` → NextResponse with appropriate HTTP status
- `parseJsonRpcRequest(body)` → validated JsonRpcRequest or error
- `sseEvent(eventType, data)` → formatted SSE string (`data: {...}\n\n`)
- All responses include `A2A-Version: 0.2.1` header

### 5.2 Create `src/app/api/v1/published/[slug]/a2a/agent.json/route.ts`
**GET** — public, no auth required:
1. Find published agent by slug
2. Check `integrations.a2a?.enabled === true`, return 404 if not
3. Load skills via skillRepository
4. Call `buildAgentCard()` with agent, skills, and base URL from request
5. Return JSON response

### 5.3 Create `src/app/api/v1/published/[slug]/a2a/route.ts`
**POST** — single JSON-RPC dispatch endpoint:
1. Authenticate via `authenticatePublishedAgentRequest()` (reuses existing API key auth)
2. Parse and validate JSON-RPC envelope
3. Rate limit check (reuse existing rate limiter pattern from ExternalExecutionService)
4. Check A2A integration is enabled on this agent
5. Dispatch by method name:

| Method | Handler |
|--------|---------|
| `message/send` | Calls `a2aService.sendMessage()`, returns JSON-RPC result |
| `message/stream` | Calls `a2aService.sendMessageAsync()`, returns SSE stream that polls via `a2aService.pollTaskStatus()` |
| `tasks/get` | Calls `a2aService.getTask()` |
| `tasks/list` | Calls `a2aService.listTasks()` |
| `tasks/cancel` | Calls `a2aService.cancelTask()` |
| `tasks/subscribe` | Returns SSE stream polling existing task |
| `tasks/pushNotificationConfig/*` | CRUD on push configs |

6. Log usage via existing `usageLogRepository.create()` with `requestType: 'a2a'`

**SSE streaming pattern** (for `message/stream` and `tasks/subscribe`):
- Uses `ReadableStream` with `TextEncoder` (same pattern as existing `/api/tasks/[id]/stream/route.ts`)
- Polls DB every 1s for task status changes
- Emits SSE events: `statusUpdate`, `artifactUpdate`, `task` (final)
- 30s heartbeat to keep connection alive
- Closes stream on terminal state (COMPLETED, FAILED, CANCELED)

**Service instantiation:** follows existing pattern from task/route.ts — repos and services instantiated at module level, not via DI container.

---

## Phase 6: Future gRPC A2A Binding (not implemented now, but designed for)

The architecture supports adding a gRPC A2A binding in the Python worker later:
- Add A2A service definition to `proto/agent_worker.proto` (or new `proto/a2a.proto`)
- Python servicer calls the same task execution pipeline
- Could either: (a) call internal gRPC `ExecuteTask` directly, or (b) call the Next.js A2A service via internal HTTP
- The `A2AApplicationService` logic can be ported to Python or accessed via internal API
- Agent Card would be served from either Next.js (HTTP) or Python (gRPC `GetExtendedAgentCard`)

No code changes needed now — the separation between `A2AApplicationService` (business logic) and the route handler (transport) makes this straightforward.

---

## Files Summary

### New files (15):
| File | Purpose |
|------|---------|
| `src/ddd/domain/a2a/types.ts` | A2A protocol type definitions |
| `src/ddd/domain/a2a/interfaces/a2a-task-repository.ts` | Repository interfaces |
| `src/ddd/domain/a2a/index.ts` | Barrel export |
| `src/ddd/infrastructure/db/repositories/a2a/drizzle-a2a-task-mapping-repository.ts` | Task mapping persistence |
| `src/ddd/infrastructure/db/repositories/a2a/drizzle-a2a-push-notification-repository.ts` | Push notification config persistence |
| `src/ddd/infrastructure/db/repositories/a2a/index.ts` | Barrel export |
| `src/ddd/application/services/a2a/state-mapper.ts` | Internal ↔ A2A status translation |
| `src/ddd/application/services/a2a/message-translator.ts` | Message/Part format translation |
| `src/ddd/application/services/a2a/agent-card-builder.ts` | Agent Card generation |
| `src/ddd/application/services/a2a/a2a-application-service.ts` | Core A2A orchestration (transport-agnostic) |
| `src/ddd/application/services/a2a/push-notification-dispatcher.ts` | Webhook delivery |
| `src/ddd/application/services/a2a/index.ts` | Barrel export |
| `src/lib/a2a/json-rpc-helpers.ts` | JSON-RPC response utilities |
| `src/app/api/v1/published/[slug]/a2a/route.ts` | JSON-RPC dispatch endpoint |
| `src/app/api/v1/published/[slug]/a2a/agent.json/route.ts` | Agent Card endpoint |

### Modified files (2):
| File | Change |
|------|--------|
| `src/ddd/infrastructure/db/schema.ts` | Add `a2a_task_mappings` + `a2a_push_notification_configs` tables, update `PublishedAgentIntegrations` |
| `src/ddd/domain/published-agents/types.ts` | Add `a2a` to integrations, `IntegrationType`, extend usage log requestType |

---

## Implementation Order

Execute in this sequence to keep the codebase compiling at each step:

1. Domain types (Phase 1) — no deps
2. Schema changes + migration (Phase 2) — no deps on new code
3. Published agent type updates (Phase 1.3) — standalone
4. Repositories (Phase 3) — depends on schema
5. State mapper + message translator (Phase 4.1, 4.2) — pure functions
6. Agent card builder (Phase 4.3) — pure function
7. A2A application service (Phase 4.4) — depends on repos + existing services
8. Push notification dispatcher (Phase 4.5) — depends on repos
9. JSON-RPC helpers (Phase 5.1) — standalone utilities
10. Agent card route (Phase 5.2) — depends on card builder
11. JSON-RPC dispatch route (Phase 5.3) — depends on everything above

---

## Verification

1. **Typecheck**: `npx tsc --noEmit` passes after each phase
2. **Agent Card**: `GET /api/v1/published/{slug}/a2a/agent.json` returns valid A2A Agent Card for a published agent with A2A enabled
3. **Blocking send**: `POST /api/v1/published/{slug}/a2a` with `message/send` method returns completed A2ATask with artifacts
4. **Task get**: `tasks/get` retrieves a previously created A2A task
5. **Task list**: `tasks/list` returns paginated A2A tasks for an agent
6. **Task cancel**: `tasks/cancel` cancels a running task
7. **SSE streaming**: `message/stream` returns `text/event-stream` with statusUpdate and artifactUpdate events
8. **Push notifications**: Configure a webhook, verify POST is sent on task completion
9. **Auth**: Requests without valid API key return JSON-RPC error
10. **A2A disabled**: Requests to agents without `integrations.a2a.enabled` return 404/error

---

## References

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [A2A GitHub Repository](https://github.com/a2aproject/A2A)
- [Google A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
