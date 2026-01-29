# Agentic Chat System Architecture

**Last Updated:** 2025-01-27

## Overview

The agentic chat system enables AI-powered conversations with planning, tool execution, and human-in-the-loop approval workflows. Messages flow from the Next.js frontend through gRPC to a Python agent worker.

## System Components

### TypeScript Layer (Frontend + API)

| Component | File | Purpose |
|-----------|------|---------|
| Chat Stream API | `src/app/api/chat/stream-grpc/route.ts` | Entry point, auth, session management |
| Chat Application Service | `src/ddd/application/services/chat/` | Business logic for chat sessions |
| gRPC Client | `src/ddd/infrastructure/grpc/chat-processing-client.ts` | gRPC connection wrapper |

### Python Layer (Agent Worker)

| Component | File | Purpose |
|-----------|------|---------|
| ChatProcessingService | `emery_agents/grpc/chat_processing_service.py` | gRPC service entry point |
| AgentStreamingHandler | `emery_agents/grpc/agent_streaming.py` | Standard agent execution |
| CoordinatorStreamingHandler | `emery_agents/grpc/coordinator_streaming.py` | Planning workflow execution |
| ExecutionCoordinator | `emery_agents/services/execution_coordinator.py` | Core orchestration logic |
| PlannerModule | `emery_agents/reasoning/modules/planner.py` | DSPy-based plan generation |
| StepExecutor | `emery_agents/services/execution/step_executor.py` | Individual step execution |

## Message Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                            │
│   CustomChatInput → Submit Message → useChat hook                   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ POST /api/chat/stream-grpc
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Route Handler                               │
│  1. Authenticate user (NextAuth)                                    │
│  2. Get/create chat session                                         │
│  3. Save user message to database                                   │
│  4. Fetch conversation history                                      │
│  5. Call gRPC service                                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ gRPC: ProcessMessage()
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ChatProcessingService (Python)                    │
│  1. Parse protobuf request                                          │
│  2. Build tool registry from config                                 │
│  3. Route to appropriate handler:                                   │
│     - AgentStreamingHandler (simple chat)                           │
│     - CoordinatorStreamingHandler (planning workflow)               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌───────────────────────────┐         ┌───────────────────────────────┐
│   AgentStreamingHandler   │         │   CoordinatorStreamingHandler │
│   (Standard Chat)         │         │   (Planning Workflow)         │
│                           │         │                               │
│   • Direct tool calling   │         │   • Plan generation           │
│   • Session memory        │         │   • User approval             │
│   • Immediate response    │         │   • Step-by-step execution    │
└───────────────────────────┘         └───────────────────────────────┘
              │                                     │
              └──────────────────┬──────────────────┘
                                 │ Streaming Response
                                 ▼
                    ┌─────────────────────────────┐
                    │     Response Stream         │
                    │   (tokens, events, errors)  │
                    └─────────────────────────────┘
```

## Two Execution Paths

### Path A: Standard Agent Execution

Used for simple chat interactions with agents.

**Trigger:** User chats with an agent without complex planning needs.

**Flow:**
1. Message arrives at `AgentStreamingHandler.stream_response()`
2. Check for existing agent session (HOT vs COLD path)
3. Create `ToolCallingAgent` with configured tools
4. Execute agent steps directly using smolagents
5. Stream responses with token usage

**Session Management:**
- **HOT PATH:** Agent exists in session memory, preserves conversation context
- **COLD PATH:** Recreate agent from conversation history

### Path B: Coordinator Planning Workflow

Used for complex tasks requiring structured planning and approval.

**Trigger:** Complex task, unclear scope, or skill-based execution.

**Flow:**
1. Message arrives at `CoordinatorStreamingHandler.stream_response()`
2. Create `ExecutionCoordinator` instance
3. **Phase 1 - Planning:** Generate step-by-step plan (read-only tools only)
4. Emit `PlanCreatedEvent`, wait for user approval
5. **Phase 2 - Execution:** Execute approved plan with full tool access
6. Run evaluator after each step to detect goal achievement

## Execution Coordinator

The `ExecutionCoordinator` is the core orchestration component (~2,200 lines).

### Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **INTERACTIVE** | Plan → Approve → Execute | User-driven complex tasks |
| **AUTONOMOUS** | Skip planning, execute directly | Pre-approved skill execution |
| **DIRECT** | Simple task, no planning needed | Quick operations |

### State Machine

```
    ┌──────────┐
    │   IDLE   │ ← Initial state
    └────┬─────┘
         │ User message
         ▼
    ┌──────────────────────────────────────────┐
    │              WORKING                      │
    │  ┌──────────────┐  ┌───────────────────┐ │
    │  │ PLANNING     │  │ EXECUTING         │ │
    │  │ (read-only)  │  │ (full tools)      │ │
    │  └──────────────┘  └───────────────────┘ │
    └────┬────────────────────────────────┬────┘
         │                                │
         │ Need input                     │ Complete
         ▼                                ▼
    ┌──────────────────┐            ┌──────────┐
    │  AWAITING_INPUT  │            │ COMPLETE │
    │  ┌────────────┐  │            └──────────┘
    │  │ APPROVAL   │  │
    │  │ CLARIFY    │  │
    │  │ RECOVERY   │  │
    │  └────────────┘  │
    └────┬─────────────┘
         │ User responds
         ▼
    [Back to WORKING]
```

### Key Methods

| Method | Purpose |
|--------|---------|
| `execute()` | Main entry point |
| `create_plan()` | Phase 1 - Generate plan using DSPy |
| `approve_plan()` | Handle plan approval |
| `execute_plan()` | Phase 2 - Execute steps sequentially |
| `handle_message()` | Process all incoming messages |

## Context Management

### Session Config (Immutable)

```python
@dataclass(frozen=True)
class SessionConfig:
    org_id: str
    org_model: Optional[str] = None
    api_key: Optional[str] = None
```

### Workspace Context

Provides planner awareness of existing resources to avoid duplicates:

```python
@dataclass
class WorkspaceContext:
    existing_databases: List[DatabaseInfo]
    existing_tables: List[TableInfo]
    existing_apps: List[AppInfo]
    existing_agents: List[AgentInfo]
    existing_skills: List[SkillInfo]
    existing_views: List[ViewInfo]
```

Fetched via unified `/api/workspace` endpoint - single API call.

## Streaming Events

The coordinator emits typed events for UI consumption:

| Event | Phase | Description |
|-------|-------|-------------|
| `PlanningStartedEvent` | Planning | Plan generation begins |
| `AwaitingClarificationEvent` | Planning | Planner needs more info |
| `PlanCreatedEvent` | Planning | Plan ready for approval |
| `PlanApprovedEvent` | Transition | User approved plan |
| `StepStartedEvent` | Execution | Step begins |
| `StepCompletedEvent` | Execution | Step finished |
| `StepFailedEvent` | Execution | Step failed |
| `EvaluationCompletedEvent` | Execution | Evaluator ran |
| `ReplanTriggeredEvent` | Execution | Dynamic replanning |
| `FinalSynthesisEvent` | Completion | Final answer synthesis |
| `ExecutionCompletedEvent` | Completion | All done |

## Tool Management

### Tool Filtering by Phase

| Phase | Tool Access | Reason |
|-------|-------------|--------|
| Planning | Read-only tools | Prevent destructive operations before approval |
| Execution | Full tool access | User approved the plan |

### Tool Categories

- **Database Tools:** Query, insert, update data
- **App Tools:** Create/modify pages
- **File Tools:** Read/write documents
- **Integration Tools:** External service calls

## Error Handling

### Recovery Confidence Levels

| Confidence | Action |
|------------|--------|
| HIGH (>=0.8) | Auto-fix without approval |
| MEDIUM (0.5-0.8) | Propose fix for approval |
| LOW (<0.5) | Ask clarifying questions |

### Interrupt Handling

Users can interrupt planning/execution:
1. Interrupt queued by `InterruptHandler`
2. Classified (CONTEXT_ADD, SCOPE_CHANGE, CANCEL)
3. Processed at next safe point
4. Context injected or execution paused

## gRPC Protocol

### Service Definition (proto)

```protobuf
service ChatProcessingService {
  rpc ProcessMessage(ProcessMessageRequest) returns (stream ProcessMessageResponse);
  rpc GeneratePlan(GeneratePlanRequest) returns (stream GeneratePlanResponse);
  rpc CancelMessage(CancelMessageRequest) returns (CancelMessageResponse);
}
```

### Message Types

- `ProcessMessageRequest` - User message + context
- `ProcessMessageResponse` - Streaming response chunks
- `AgentConfig` - Tools and skills configuration
- `ToolConfig` - Individual tool definition

## Related Documentation

- [System Overview](./SYSTEM_OVERVIEW.md) - High-level architecture
- [Orchestration Flow](./ORCHESTRATION_FLOW.md) - Detailed planning vs execution
- [Tools Registry Redesign](../tools-registry-redesign.md) - Tool binding architecture
