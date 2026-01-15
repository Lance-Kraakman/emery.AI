# Emery System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      EMERY PLATFORM                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              NEXT.JS APPLICATION (TypeScript)                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │    │
│  │  │   /chat     │  │  /agents    │  │   /tables   │  │   /rows     │  │   /tasks    │   │    │
│  │  │  stream-grpc│  │  /execute   │  │   CRUD      │  │ Automations │  │  Management │   │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │    │
│  │         │                │                │                │                │          │    │
│  │         └────────────────┼────────────────┼────────────────┼────────────────┘          │    │
│  │                          │                │                │                           │    │
│  │  ┌───────────────────────┴────────────────┴────────────────┴────────────────────────┐  │    │
│  │  │                        INFRASTRUCTURE LAYER                                       │  │    │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                   │  │    │
│  │  │  │  gRPC Client    │  │   Supabase DB   │  │   Auth (Clerk)  │                   │  │    │
│  │  │  │  (Node.js)      │  │   PostgreSQL    │  │   Session Mgmt  │                   │  │    │
│  │  │  └────────┬────────┘  └─────────────────┘  └─────────────────┘                   │  │    │
│  │  └───────────┼──────────────────────────────────────────────────────────────────────┘  │    │
│  └──────────────┼─────────────────────────────────────────────────────────────────────────┘    │
│                 │                                                                              │
│                 │ gRPC (Protobuf)                                                              │
│                 ▼                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              PYTHON gRPC SERVICES                                        │  │
│  │                                                                                          │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │  │
│  │  │                         ChatProcessingService                                    │    │  │
│  │  │                    (Interactive Chat + HITL Workflows)                           │    │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │  │
│  │                                                                                          │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐    │  │
│  │  │                              AgentWorker                                         │    │  │
│  │  │                      (Autonomous Task Execution)                                 │    │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘    │  │
│  │                                                                                          │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Execution Modes: Interactive vs Autonomous

```
┌─────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│         INTERACTIVE MODE                 │    │         AUTONOMOUS MODE                  │
│         (Chat / HITL)                    │    │         (Scheduled / Triggered)          │
├─────────────────────────────────────────┤    ├─────────────────────────────────────────┤
│                                          │    │                                          │
│  Entry: /api/chat/stream-grpc            │    │  Entry: /api/agents/{id}/execute         │
│                                          │    │         /api/rows (automations)          │
│  ┌─────────────────────────────────┐     │    │                                          │
│  │     ProcessMessageRequest       │     │    │  ┌─────────────────────────────────┐     │
│  │  - message (user input)         │     │    │  │        TaskRequest              │     │
│  │  - conversation_history         │     │    │  │  - skill_name                   │     │
│  │  - agent_config (tools/skills)  │     │    │  │  - instruction_config           │     │
│  │  - file_attachments             │     │    │  │  - skill_inputs (runtime values)│     │
│  │  - session_id                   │     │    │  │  - resolved_context (tables)    │     │
│  └───────────────┬─────────────────┘     │    │  └───────────────┬─────────────────┘     │
│                  │                        │    │                  │                        │
│                  ▼                        │    │                  ▼                        │
│  ┌─────────────────────────────────┐     │    │  ┌─────────────────────────────────┐     │
│  │   ChatProcessingService         │     │    │  │      AgentWorker.ExecuteTask    │     │
│  │   .ProcessMessage()             │     │    │  │                                 │     │
│  └───────────────┬─────────────────┘     │    │  └───────────────┬─────────────────┘     │
│                  │                        │    │                  │                        │
│                  ▼                        │    │                  ▼                        │
│  ┌─────────────────────────────────┐     │    │  ┌─────────────────────────────────┐     │
│  │  InterruptAwareToolCallingAgent │     │    │  │     AgentExecutor               │     │
│  │  - Stateful (session memory)    │     │    │  │  - Stateless                    │     │
│  │  - Can pause for approval       │     │    │  │  - Routes by execution_type     │     │
│  │  - Streams step progress        │     │    │  │  - Returns final result         │     │
│  └───────────────┬─────────────────┘     │    │  └───────────────┬─────────────────┘     │
│                  │                        │    │                  │                        │
│  Features:                                │    │  Features:                                │
│  ✓ Conversation memory                   │    │  ✓ Scheduled execution                   │
│  ✓ HITL approval gates                   │    │  ✓ Automation triggers                   │
│  ✓ Managed agents (skill_builder, etc)   │    │  ✓ Skill chaining (DAG)                  │
│  ✓ Real-time streaming                   │    │  ✓ Output mappings (table writes)        │
│  ✓ File uploads (multimodal)             │    │  ✓ Context isolation                     │
│                                          │    │                                          │
└─────────────────────────────────────────┘    └─────────────────────────────────────────┘
```

---

## Core Service Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CHAT PROCESSING SERVICE                                       │
│                          (emery-agents/src/emery_agents/grpc/chat_processing_service.py)       │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SessionManager                                              │   │
│  │                         (Agent State Persistence)                                        │   │
│  │  - Caches agents by session_id                                                          │   │
│  │  - Restores memory from conversation_history                                            │   │
│  │  - Handles idle timeout                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                                      │
│                                          ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     InterruptAwareToolCallingAgent                                       │   │
│  │                  (Parent Agent - Routes to Managed Agents)                               │   │
│  │                                                                                          │   │
│  │  Built-in Tools:                      Managed Agents:                                    │   │
│  │  - Standard tools from config         ┌──────────────────────────────────────────────┐  │   │
│  │  - SkillTools (skill-as-tool)         │  ┌─────────────┐  ┌─────────────┐            │  │   │
│  │                                        │  │skill_builder│  │schema_builder│            │  │   │
│  │                                        │  │   (HITL)    │  │    (HITL)   │            │  │   │
│  │                                        │  └─────────────┘  └─────────────┘            │  │   │
│  │                                        │  ┌─────────────┐  ┌─────────────┐            │  │   │
│  │                                        │  │document_    │  │table_builder│            │  │   │
│  │                                        │  │  builder    │  │ (Autonomous)│            │  │   │
│  │                                        │  │   (HITL)    │  └─────────────┘            │  │   │
│  │                                        │  └─────────────┘                             │  │   │
│  │                                        └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                                      │
│                                          ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            Stream Response Types                                         │   │
│  │  - StepProgressDict (step_progress)     - Real-time execution visibility               │   │
│  │  - ContentChunkDict (content_chunk)     - Streamed LLM output                          │   │
│  │  - AwaitingInputDict (awaiting_input)   - HITL approval request                        │   │
│  │  - ErrorResponseDict (error)            - Classified errors                            │   │
│  │  - ProcessingComplete (complete)        - Final metadata + token usage                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘


┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SKILL EXECUTOR SERVICE                                       │
│                           (emery-agents/src/emery_agents/services/skill_executor.py)           │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                          execute_skill() - Routing Logic                                 │   │
│  │                                                                                          │   │
│  │   skill.execution_type                                                                   │   │
│  │          │                                                                               │   │
│  │          ├─── "agentic"  ──────▶  _execute_agent()  [LLM Orchestration]                 │   │
│  │          │                         Creates sub-agent with tools                          │   │
│  │          │                         Streams step progress                                 │   │
│  │          │                                                                               │   │
│  │          ├─── "operation" ─────▶  _execute_operation()  [Direct Inference]              │   │
│  │          │                         Text-to-image, speech-to-text, etc.                  │   │
│  │          │                         No LLM reasoning                                      │   │
│  │          │                                                                               │   │
│  │          ├─── "tool" ──────────▶  Direct Pipedream tool call                            │   │
│  │          │                         Single API call                                       │   │
│  │          │                                                                               │   │
│  │          ├─── "read" ──────────▶  Direct table read                                     │   │
│  │          │                         No LLM, returns data directly                        │   │
│  │          │                                                                               │   │
│  │          ├─── "write" ─────────▶  Direct table write                                    │   │
│  │          │                         No LLM, writes data directly                         │   │
│  │          │                                                                               │   │
│  │          └─── "agent" ─────────▶  _execute_steps()  [DAG Workflow]                      │   │
│  │                                    Multi-step orchestration                              │   │
│  │                                    Step-by-step execution                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Entities & Data Models

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       CORE ENTITIES                                             │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐                    │
│  │       ExecutionContext          │    │           Plan                  │                    │
│  │  (execution_context.py)         │    │       (plan.py)                 │                    │
│  ├─────────────────────────────────┤    ├─────────────────────────────────┤                    │
│  │  mode: INTERACTIVE | AUTONOMOUS │    │  id: str                        │                    │
│  │  task: str                      │    │  goal: str                      │                    │
│  │  available_tools: List[str]     │    │  status: PlanStatus             │                    │
│  │  images: List[Image]            │    │    - DRAFT                      │                    │
│  │  attachments: List[File]        │    │    - AWAITING_APPROVAL          │                    │
│  │  session_attachments: List      │    │    - APPROVED                   │                    │
│  │  skill_inputs: Dict[str, Any]   │    │    - EXECUTING                  │                    │
│  │  agent_model: str               │    │    - COMPLETED                  │                    │
│  │  org_model: str                 │    │    - FAILED                     │                    │
│  │  api_key: str                   │    │  steps: List[PlanStep]          │                    │
│  │  progress_callback: Callable    │    │  created_at: datetime           │                    │
│  └─────────────────────────────────┘    │  updated_at: datetime           │                    │
│                                          └─────────────────────────────────┘                    │
│                                                                                                 │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐                    │
│  │       SkillConfig (Proto)       │    │        AgentConfig (Proto)      │                    │
│  │    (agent_worker.proto)         │    │     (agent_worker.proto)        │                    │
│  ├─────────────────────────────────┤    ├─────────────────────────────────┤                    │
│  │  id: str                        │    │  id: str                        │                    │
│  │  name: str                      │    │  name: str                      │                    │
│  │  description: str               │    │  tools: List[ToolProto]         │                    │
│  │  instructions: str              │    │  skills: List[SkillProto]       │                    │
│  │  inputs: List[InputDef]         │    │  system_prompt: str             │                    │
│  │  outputs: List[OutputDef]       │    │  model: str                     │                    │
│  │  tools: List[ToolProto]         │    └─────────────────────────────────┘                    │
│  │  execution_type: str            │                                                           │
│  │  model: str                     │    ┌─────────────────────────────────┐                    │
│  │  steps: List[StepConfig]        │    │     ContextMapping (Proto)      │                    │
│  │  output_mappings: Mappings      │    │    (agent_worker.proto)         │                    │
│  └─────────────────────────────────┘    ├─────────────────────────────────┤                    │
│                                          │  table_id: str                  │                    │
│  ┌─────────────────────────────────┐    │  table_name: str                │                    │
│  │      OutputMapping              │    │  database_id: str               │                    │
│  │   (output_mapping.py)           │    │  access_level: READ | WRITE     │                    │
│  ├─────────────────────────────────┤    │  row_id: str (optional)         │                    │
│  │  output_id: str                 │    └─────────────────────────────────┘                    │
│  │  target_table_id: str           │                                                           │
│  │  target_field_id: str           │                                                           │
│  │  mode: single_row | multi_row   │                                                           │
│  └─────────────────────────────────┘                                                           │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tool Execution Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     TOOL ECOSYSTEM                                              │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              UnifiedToolLoader                                            │  │
│  │                          (services/tool_loader.py)                                        │  │
│  │                                                                                           │  │
│  │   load_tools_from_configs()                                                               │  │
│  │          │                                                                                │  │
│  │          ├─── Standard Tools ────────▶  smolagents.Tool instances                        │  │
│  │          │     (from ToolProto)         - forward() method                               │  │
│  │          │                              - name, description, inputs                       │  │
│  │          │                                                                                │  │
│  │          ├─── SkillTool ─────────────▶  Wraps skill as callable tool                     │  │
│  │          │     (skill_tool.py)          - Delegates to SkillExecutorService              │  │
│  │          │                              - Injects file attachments                        │  │
│  │          │                              - Captures outputs                                │  │
│  │          │                                                                                │  │
│  │          └─── OutputTool ────────────▶  Captures skill outputs                           │  │
│  │                (output_tool.py)         - Called by agent to return results              │  │
│  │                                         - Maps to target tables                           │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
│                                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              CRUD Tools (Managed Agents)                                  │  │
│  │                          (tools/crud_tools.py)                                            │  │
│  │                                                                                           │  │
│  │   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │   │  skill_crud    │  │ document_crud  │  │  table_crud    │  │  field_crud    │         │  │
│  │   │  - list        │  │  - list        │  │  - list        │  │  - create      │         │  │
│  │   │  - read        │  │  - read        │  │  - read        │  │  - update      │         │  │
│  │   │  - create      │  │  - create      │  │  - create      │  │  - delete      │         │  │
│  │   │  - update      │  │  - update      │  │  - update      │  │                │         │  │
│  │   │  - delete      │  │  - delete      │  │  - delete      │  │                │         │  │
│  │   └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘         │  │
│  │                                                                                           │  │
│  │   ┌────────────────┐                                                                      │  │
│  │   │ database_crud  │                                                                      │  │
│  │   │  - list        │                                                                      │  │
│  │   │  - read        │                                                                      │  │
│  │   └────────────────┘                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Managed Agents (HITL Workflows)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    MANAGED AGENTS                                               │
│                    (StatefulManagedAgent - Preserves memory for HITL)                          │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            skill_builder_agent.py                                        │   │
│  │                                                                                          │   │
│  │  Purpose: Create/modify skills interactively                                            │   │
│  │  Tools: skill_crud (list, read, create, update, delete)                                 │   │
│  │  HITL: Plan approval before executing CRUD operations                                   │   │
│  │  Flow: List skills → Read skill → Create plan → INTERRUPT → User approves → Execute    │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           schema_builder_agent.py                                        │   │
│  │                                                                                          │   │
│  │  Purpose: Design complex database schemas from requirements                             │   │
│  │  Tools: database_crud, table_crud, field_crud                                           │   │
│  │  HITL: Plan approval before batch field creation                                        │   │
│  │  Flow: List DBs → Analyze requirements → Create detailed plan → INTERRUPT → Execute    │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                          document_builder_agent.py                                       │   │
│  │                                                                                          │   │
│  │  Purpose: Create/manage documents                                                        │   │
│  │  Tools: document_crud (list, read, create, update, delete)                              │   │
│  │  HITL: Plan approval before executing document operations                               │   │
│  │  Flow: List docs → Read doc → Create plan → INTERRUPT → User approves → Execute        │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           table_builder_agent.py                                         │   │
│  │                                                                                          │   │
│  │  Purpose: Single table operations (add column, rename field)                            │   │
│  │  Tools: field_crud, table_crud                                                          │   │
│  │  HITL: NONE (low-risk, autonomous execution)                                            │   │
│  │  Flow: Analyze request → Execute directly                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           HITL Interrupt Flow                                            │   │
│  │                                                                                          │   │
│  │   Agent creates plan (PlanningStep)                                                      │   │
│  │          │                                                                               │   │
│  │          ▼                                                                               │   │
│  │   step_callbacks[PlanningStep] triggers                                                  │   │
│  │          │                                                                               │   │
│  │          ▼                                                                               │   │
│  │   Raises AgentInterrupt("Plan requires approval")                                        │   │
│  │          │                                                                               │   │
│  │          ▼                                                                               │   │
│  │   UI shows AwaitingInputCard (Approve/Reject/Modify)                                     │   │
│  │          │                                                                               │   │
│  │          ▼                                                                               │   │
│  │   User responds → Agent resumes with reset=False (memory preserved)                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Interactive Chat

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              INTERACTIVE CHAT DATA FLOW                                         │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│   ┌─────────────┐                                                                              │
│   │   Browser   │                                                                              │
│   │  (React)    │                                                                              │
│   └──────┬──────┘                                                                              │
│          │ useChatGRPC hook                                                                    │
│          ▼                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────────┐     │
│   │  POST /api/chat/stream-grpc                                                          │     │
│   │  ┌─────────────────────────────────────────────────────────────────────────────┐    │     │
│   │  │  1. Authenticate user (Clerk)                                                │    │     │
│   │  │  2. Validate session                                                         │    │     │
│   │  │  3. Build ProcessMessageRequest                                              │    │     │
│   │  │  4. Call gRPC ChatProcessingService.ProcessMessage()                         │    │     │
│   │  │  5. Stream responses as Server-Sent Events (SSE)                             │    │     │
│   │  │  6. Save messages to Supabase                                                │    │     │
│   │  └─────────────────────────────────────────────────────────────────────────────┘    │     │
│   └──────────────────────────────────────────────────────────────────────────────────────┘     │
│          │                                                                                     │
│          │ gRPC Stream                                                                         │
│          ▼                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────────┐     │
│   │  ChatProcessingService.ProcessMessage()                                              │     │
│   │  ┌─────────────────────────────────────────────────────────────────────────────┐    │     │
│   │  │  1. Build conversation messages (HuggingFace format)                         │    │     │
│   │  │  2. Get/create agent from SessionManager                                     │    │     │
│   │  │  3. Set ExecutionContext with progress_callback                              │    │     │
│   │  │  4. Run agent: agent.run(task, images, stream=True, reset=False)             │    │     │
│   │  │  5. For each step:                                                           │    │     │
│   │  │     - PlanningStep → yield StepProgressDict                                  │    │     │
│   │  │     - ActionStep   → yield StepProgressDict + nested steps                   │    │     │
│   │  │     - FinalAnswer  → yield ContentChunkDict                                  │    │     │
│   │  │  6. yield ProcessingComplete (metadata, token usage)                         │    │     │
│   │  └─────────────────────────────────────────────────────────────────────────────┘    │     │
│   └──────────────────────────────────────────────────────────────────────────────────────┘     │
│          │                                                                                     │
│          │ SSE Events                                                                          │
│          ▼                                                                                     │
│   ┌─────────────┐                                                                              │
│   │   Browser   │  Updates: StepProgressIndicator, ChatMessage, AwaitingInputCard             │
│   └─────────────┘                                                                              │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Autonomous Execution

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            AUTONOMOUS EXECUTION DATA FLOW                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────┐     │
│   │                             TRIGGER SOURCES                                          │     │
│   │                                                                                      │     │
│   │   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐    │     │
│   │   │  Manual Run   │   │  Scheduled    │   │  Row Created  │   │  Webhook      │    │     │
│   │   │  (UI Button)  │   │  (Cron)       │   │  (Automation) │   │  (External)   │    │     │
│   │   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘    │     │
│   │           │                   │                   │                   │             │     │
│   │           └───────────────────┼───────────────────┼───────────────────┘             │     │
│   │                               ▼                   ▼                                 │     │
│   └───────────────────────────────────────────────────────────────────────────────────────┘     │
│                                   │                                                            │
│                                   ▼                                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────────────┐     │
│   │  POST /api/agents/{id}/execute                                                       │     │
│   │  ┌─────────────────────────────────────────────────────────────────────────────┐    │     │
│   │  │  1. Authenticate                                                             │    │     │
│   │  │  2. Load skill/agent config from DB                                          │    │     │
│   │  │  3. Resolve context mappings (which tables agent can access)                 │    │     │
│   │  │  4. Build TaskRequest with skill_inputs                                      │    │     │
│   │  │  5. Call gRPC AgentWorker.ExecuteTask()                                      │    │     │
│   │  │  6. Stream TaskProgress updates                                              │    │     │
│   │  │  7. Record execution result                                                  │    │     │
│   │  └─────────────────────────────────────────────────────────────────────────────┘    │     │
│   └──────────────────────────────────────────────────────────────────────────────────────┘     │
│                                   │                                                            │
│                                   │ gRPC Stream                                                │
│                                   ▼                                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────────────┐     │
│   │  AgentWorker.ExecuteTask()                                                           │     │
│   │  ┌─────────────────────────────────────────────────────────────────────────────┐    │     │
│   │  │  AgentExecutor.execute_task()                                                │    │     │
│   │  │     │                                                                        │    │     │
│   │  │     ├── skill_name provided ─────▶ SkillExecutorService.execute_skill()     │    │     │
│   │  │     │                                    │                                   │    │     │
│   │  │     │                                    ├── agentic: Create agent, run     │    │     │
│   │  │     │                                    ├── operation: Direct inference    │    │     │
│   │  │     │                                    ├── tool: Direct API call          │    │     │
│   │  │     │                                    ├── read/write: Direct DB          │    │     │
│   │  │     │                                    └── agent: DAG step execution      │    │     │
│   │  │     │                                                                        │    │     │
│   │  │     └── instruction_config ──────▶ Create agent with tools, execute        │    │     │
│   │  │                                                                              │    │     │
│   │  │  For each step: yield TaskProgress                                           │    │     │
│   │  │  On complete: Apply output_mappings (write to tables)                        │    │     │
│   │  └─────────────────────────────────────────────────────────────────────────────┘    │     │
│   └──────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Progress Streaming Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              PROGRESS STREAMING FLOW                                            │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────┐     │
│   │                    chat_processing_service.py                                        │     │
│   │                                                                                      │     │
│   │   progress_callback = lambda step_dict: collected_nested_steps.append(step_dict)    │     │
│   │                              │                                                       │     │
│   │                              │ Set in ExecutionContext                               │     │
│   │                              ▼                                                       │     │
│   │   ┌────────────────────────────────────────────────────────────────────────────┐    │     │
│   │   │                        ExecutionContext                                     │    │     │
│   │   │   progress_callback: Callable[[Dict], None]                                │    │     │
│   │   └──────────────────────────────┬─────────────────────────────────────────────┘    │     │
│   │                                  │                                                   │     │
│   │   ┌──────────────────────────────┼──────────────────────────────────────────────┐   │     │
│   │   │                              ▼                                               │   │     │
│   │   │   StatefulManagedAgent.__call__()                                           │   │     │
│   │   │     │                                                                        │   │     │
│   │   │     │ Gets callback from context_manager.get_current_context()              │   │     │
│   │   │     │                                                                        │   │     │
│   │   │     ▼                                                                        │   │     │
│   │   │   for step in self.run(task, stream=True):                                  │   │     │
│   │   │       step_dict = step_to_progress_dict(step, index, self.name)             │   │     │
│   │   │       if active_callback:                                                    │   │     │
│   │   │           active_callback(step_dict)  ─────────────────────────────────┐    │   │     │
│   │   │                                                                        │    │   │     │
│   │   └────────────────────────────────────────────────────────────────────────│────┘   │     │
│   │                                                                            │        │     │
│   │   ◀────────────────────────────────────────────────────────────────────────┘        │     │
│   │   collected_nested_steps receives progress                                          │     │
│   │                              │                                                       │     │
│   │                              ▼                                                       │     │
│   │   After ActionStep completes: yield nested steps as StepProgressDict                │     │
│   │                                                                                      │     │
│   └──────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                                 │
│                              ┌─────────────────────────────────────────┐                       │
│                              │        step_utils.py                    │                       │
│                              │                                         │                       │
│                              │  step_to_progress_dict()                │                       │
│                              │    → RawProgressDict                    │                       │
│                              │       type: 'planning'|'action'|'final' │                       │
│                              │       step_name: str                    │                       │
│                              │       content: str                      │                       │
│                              │       metadata: ProgressMetadata        │                       │
│                              │       step_index: int                   │                       │
│                              └─────────────────────────────────────────┘                       │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key File Reference

| Layer | File | Purpose |
|-------|------|---------|
| **API** | `src/app/api/chat/stream-grpc/route.ts` | Chat entry point |
| **API** | `src/app/api/agents/[id]/execute/route.ts` | Task execution entry |
| **gRPC Client** | `src/ddd/infrastructure/grpc/chat-processing-client.ts` | Node.js gRPC client |
| **Proto** | `proto/agent_worker.proto` | Service definitions |
| **Chat Service** | `emery-agents/.../grpc/chat_processing_service.py` | Interactive processing |
| **Agent Executor** | `emery-agents/.../services/agent_executor.py` | Autonomous routing |
| **Skill Executor** | `emery-agents/.../services/skill_executor.py` | Skill execution types |
| **Context Manager** | `emery-agents/.../services/context_manager.py` | Async-safe context vars |
| **Session Manager** | `emery-agents/.../services/session_manager.py` | State persistence |
| **Execution Context** | `emery-agents/.../entities/execution_context.py` | Runtime state |
| **Plan** | `emery-agents/.../models/plan.py` | Plan tracking |
| **Tool Loader** | `emery-agents/.../services/tool_loader.py` | Tool instantiation |
| **Skill Tool** | `emery-agents/.../tools/skill_tool.py` | Skill-as-tool wrapper |
| **Step Utils** | `emery-agents/.../utils/step_utils.py` | Progress dict conversion |
| **Managed Agents** | `emery-agents/.../agents/skill_builder_agent.py` | Skill builder |
| **Managed Agents** | `emery-agents/.../agents/schema_builder_agent.py` | Schema builder |
| **Managed Agents** | `emery-agents/.../agents/document_builder_agent.py` | Document builder |
| **Managed Agents** | `emery-agents/.../agents/table_builder_agent.py` | Table builder |
| **Managed Agent Base** | `emery-agents/.../agents/stateful_managed_agent.py` | HITL state preservation |
| **Frontend** | `src/components/chat/useChatGRPC.tsx` | React chat hook |
| **Frontend** | `src/components/chat/AwaitingInputCard.tsx` | HITL approval UI |
