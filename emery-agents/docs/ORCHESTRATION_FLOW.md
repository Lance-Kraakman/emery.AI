# Emery Agent Orchestration Flow

This document describes the complete orchestration flow for the Emery agent system, including state machines, message flow, and event handling.

## Table of Contents
- [1. Execution Coordinator State Machine](#1-execution-coordinator-state-machine)
- [2. Interrupt Handling State Machine](#2-interrupt-handling-state-machine)
- [3. Complete Message Flow](#3-complete-message-flow)
- [4. @agent Mention Routing](#4-agent-mention-routing)
- [5. Event Types](#5-event-types)
- [6. Callback Patterns](#6-callback-patterns)
- [7. Error Recovery Flow](#7-error-recovery-flow)
- [8. Key Files Reference](#8-key-files-reference)
- [9. App and Page Builder HITL Workflow](#9-app-and-page-builder-hitl-workflow)
- [10. Architecture Summary](#10-architecture-summary)

---

## 1. Execution Coordinator State Machine

The orchestration uses two complementary phase systems:

1. **CoordinatorStateMachine** (`coordinator_state_machine.py`) - Persistent phases that survive across message boundaries
2. **ExecutionCoordinator** (`execution_coordinator.py`) - Internal phases during execute() calls

### Persistent State Machine (CoordinatorStateMachine)

These phases are persisted in the session and determine how the next user message is routed:

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> AWAITING_CLARIFICATION: Task classifier needs info
    IDLE --> AWAITING_APPROVAL: Plan ready for approval
    IDLE --> AWAITING_CASCADE_QUESTIONS: Cascade planning needs answers
    IDLE --> AWAITING_QUESTIONS: Managed agent HITL
    IDLE --> EXECUTING: Direct execution started

    AWAITING_CLARIFICATION --> IDLE: User answers

    AWAITING_CASCADE_QUESTIONS --> AWAITING_CASCADE_QUESTIONS: More questions
    AWAITING_CASCADE_QUESTIONS --> AWAITING_APPROVAL: All answered
    AWAITING_CASCADE_QUESTIONS --> IDLE: Cancelled

    AWAITING_APPROVAL --> IDLE: Rejected
    AWAITING_APPROVAL --> EXECUTING: Approved

    AWAITING_QUESTIONS --> IDLE: User responds to managed agent

    EXECUTING --> IDLE: Completed or failed
    EXECUTING --> AWAITING_QUESTIONS: Managed agent HITL during execution
```

### Internal Execution Phases (ExecutionCoordinator)

These phases are internal to a single execute() call and not persisted:

```mermaid
stateDiagram-v2
    [*] --> CLASSIFYING

    CLASSIFYING --> DIRECT: Simple task
    CLASSIFYING --> PLANNING: Complex task

    DIRECT --> COMPLETED: Execute directly

    PLANNING --> AWAITING_APPROVAL: Plan ready

    AWAITING_APPROVAL --> EXECUTING: Approved
    AWAITING_APPROVAL --> PLANNING: Feedback (replan)

    EXECUTING --> EXECUTING: Step completed
    EXECUTING --> COMPLETED: All steps done
    EXECUTING --> FAILED: Blocking error

    COMPLETED --> [*]
    FAILED --> [*]
```

### Phase Details

| Phase | Persistence | Description | Tools Available |
|-------|-------------|-------------|-----------------|
| IDLE | Persistent | Waiting for user input | N/A |
| CLASSIFYING | Internal | LLM determines task complexity | N/A |
| PLANNING | Internal | Generating execution plan | Read-only |
| AWAITING_CLARIFICATION | Persistent | Task classifier needs more info | N/A |
| AWAITING_CASCADE_QUESTIONS | Persistent | Cascade planning needs answers | N/A |
| AWAITING_APPROVAL | Persistent | Waiting for user to approve plan | N/A |
| AWAITING_QUESTIONS | Persistent | Managed agent HITL (e.g., skill_builder) | N/A |
| EXECUTING | Persistent | Running plan steps | All tools |
| COMPLETED | Internal | Task finished successfully | N/A |
| FAILED | Internal | Task failed with error | N/A |

---

## 2. Interrupt Handling State Machine

How user interrupts during active phases are processed.

```mermaid
stateDiagram-v2
    state "Active Phase" as active {
        [*] --> PLANNING
        [*] --> EXECUTING
    }

    state "Interrupt Processing" as interrupt {
        QUEUE_INTERRUPT --> CLASSIFY_INTERRUPT: Phase completes / Before next step

        CLASSIFY_INTERRUPT --> CONTEXT_ADD: Additional info
        CLASSIFY_INTERRUPT --> SCOPE_CHANGE: Direction change
        CLASSIFY_INTERRUPT --> CANCEL: Stop request
    }

    state "Resolution" as resolution {
        CONTEXT_ADD --> CONTINUE: Inject context
        SCOPE_CHANGE --> REPLAN: New plan with context
        CANCEL --> IDLE: Reset state
    }

    active --> QUEUE_INTERRUPT: User sends message

    CONTINUE --> EXECUTING
    REPLAN --> PLANNING
    IDLE --> [*]
```

### Interrupt Classification

```mermaid
flowchart TD
    A[User Interrupt Message] --> B{LLM Classifier}

    B -->|"Additional info, clarification"| C[CONTEXT_ADD]
    B -->|"Change direction, new goal"| D[SCOPE_CHANGE]
    B -->|"Stop, cancel, nevermind"| E[CANCEL]

    C --> F[Inject into TaskLedger]
    F --> G[Continue Execution]

    D --> H[Trigger Replan]
    H --> I[New Plan with Context]

    E --> J[Reset State]
    J --> K[Return to IDLE]
```

---

## 3. Complete Message Flow

End-to-end flow from frontend to backend and back.

```mermaid
flowchart TB
    subgraph Frontend["Frontend (Next.js)"]
        UI[User Interface]
    end

    subgraph gRPC["gRPC Layer"]
        PM[ProcessMessage RPC]
    end

    subgraph CPS["Chat Processing Service"]
        REG[Register Stream]
        EXT[Extract Tools/Skills/Attachments]
        BUILD[Build Conversation Context]
    end

    subgraph SM["Session Manager"]
        HOT[HOT PATH<br/>Reuse Agent]
        COLD[COLD PATH<br/>Create Agent]
    end

    subgraph EC["Execution Coordinator"]
        CLASS[Task Classification]
        PLAN[Planning Phase]
        APPROVE[Approval Phase]
        EXEC[Execution Phase]
    end

    subgraph CONV["Event Converter"]
        CONVERT[Convert Events to gRPC]
    end

    UI -->|"gRPC Request"| PM
    PM --> REG --> EXT --> BUILD
    BUILD --> SM

    SM --> HOT
    SM --> COLD
    HOT --> EC
    COLD --> EC

    EC --> CLASS
    CLASS -->|"Simple"| EXEC
    CLASS -->|"Complex"| PLAN
    PLAN --> APPROVE
    APPROVE -->|"Approved"| EXEC

    EXEC --> CONVERT
    CONVERT -->|"gRPC Stream"| UI
```

### Detailed Execution Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant G as gRPC
    participant C as ChatProcessingService
    participant S as SessionManager
    participant E as ExecutionCoordinator
    participant P as PlanService
    participant A as Agent

    U->>F: Send message
    F->>G: ProcessMessage(request)
    G->>C: Stream handler

    C->>S: Get/Create session
    alt HOT PATH
        S-->>C: Existing agent
    else COLD PATH
        S->>A: Create new agent
        S->>A: Restore memory
        S-->>C: New agent
    end

    C->>E: execute(task, tools)
    E->>E: Classify task

    alt DIRECT
        E->>A: Execute directly
        A-->>E: Result
    else PLAN_AND_APPROVE
        E->>P: Generate plan
        P-->>E: Plan
        E-->>C: PlanCreatedEvent
        C-->>F: awaiting_input
        F-->>U: Show plan approval
        U->>F: Approve
        F->>G: ProcessMessage(approval)
        G->>C: Resume
        C->>E: handle_message(approval)

        loop Each Step
            E->>A: Execute step
            A-->>E: Step result
            E-->>C: StepCompletedEvent
            C-->>F: step_progress
        end
    end

    E-->>C: ExecutionCompletedEvent
    C-->>F: complete
    F-->>U: Show result
```

---

## 4. @agent Mention Routing

User-defined agents can be invoked directly via `@agent:name` mentions, bypassing normal orchestration.

### Overview

```mermaid
flowchart TB
    subgraph Detection["Mention Detection"]
        MSG[User Message] --> PARSE[parse_agent_mention]
        PARSE -->|"@agent:name found"| ROUTE[Direct Routing]
        PARSE -->|"No mention"| NORMAL[Normal Orchestration]
    end

    subgraph Routing["Agent Routing"]
        ROUTE --> FETCH[Fetch Agent by Name]
        FETCH --> SKILLS[Load Agent Skills]
        SKILLS --> CREATE[Create AgentExecutor]
        CREATE --> RUN[Execute Task]
    end

    subgraph Execution["AgentExecutor"]
        RUN --> PERSONA[Apply Persona]
        PERSONA --> TOOLS[SkillInvokerTools]
        TOOLS --> RESULT[Stream Result]
    end

    RESULT --> UI[Frontend]
    NORMAL --> EC[ExecutionCoordinator]
```

### Mention Detection Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CPS as ChatProcessingService
    participant MP as mention_parser
    participant MR as mention_routing
    participant API as Next.js API
    participant AE as AgentExecutor

    U->>CPS: "@agent:sales-bot send email to John"
    CPS->>MP: parse_agent_mention(text)
    MP-->>CPS: ("send email to John", "sales-bot")

    CPS->>MR: handle_agent_mention_routing()
    MR->>API: GET /api/agents?name=sales-bot
    API-->>MR: Agent config (id, persona, skills)
    MR->>API: GET /api/skills?agent_id=42
    API-->>MR: Skills list

    MR->>AE: create_agent_executor(config, skills)
    AE->>AE: Build SkillInvokerTools
    AE->>AE: Apply persona instructions

    MR->>AE: run(task="send email to John")
    AE-->>MR: Result
    MR-->>CPS: Stream content_chunk events
    CPS-->>U: Display response
```

### AgentExecutor Architecture

The AgentExecutor creates a dynamic `ToolCallingAgent` at runtime:

```mermaid
flowchart TB
    subgraph UserAgent["User-Defined Agent (DB)"]
        UA_ID[Agent ID]
        UA_NAME[Name]
        UA_PERSONA[Persona]
        UA_DESC[Description]
        UA_DB[Database ID]
    end

    subgraph AgentExecutor["AgentExecutor Factory"]
        LOAD[Load Agent Config]
        BUILD_TOOLS[Build SkillInvokerTools]
        BUILD_PROMPT[Build Instructions from Persona]
        CREATE_TCA[Create ToolCallingAgent]
    end

    subgraph DynamicAgent["Dynamic Agent Instance"]
        INSTRUCTIONS[Persona + Skill Instructions]
        SKILL_TOOLS[SkillInvokerTool × N]
        ROW_CRUD[Scoped row_crud Tool]
    end

    UserAgent --> AgentExecutor
    AgentExecutor --> DynamicAgent

    SKILL_TOOLS --> HITL[HITL Input Gathering]
    SKILL_TOOLS --> EXEC[Skill Execution]
```

### SkillInvokerTool Pattern

Each agent skill becomes a callable tool:

```mermaid
sequenceDiagram
    participant A as AgentExecutor
    participant SIT as SkillInvokerTool
    participant SE as SkillExecutorService

    A->>SIT: skill_send_email(inputs={...})

    alt Missing Required Inputs
        SIT-->>A: {status: "missing_inputs", questions: [...]}
        A-->>A: Ask user for missing inputs
    else All Inputs Present
        SIT->>SE: execute(skill_id, inputs)
        SE-->>SIT: Result
        SIT-->>A: {success: true, result: ...}
    end
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `mention_parser.py` | Parse @agent:name from message text |
| `mention_routing.py` | Handle routing to user-defined agents |
| `agent_executor_agent.py` | Create dynamic ToolCallingAgent |
| `skill_invoker_tool.py` | Wrap skills as callable tools |
| `agent_executor.j2` | Persona-based prompt template |

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/agents?name=X` | Look up agent by name |
| `GET /api/agents?format=llm` | List agents in TOON format |
| `GET /api/skills?agent_id=X` | Get skills for agent |
| `GET /api/skills?format=llm` | List skills in TOON format |

---

## 5. Event Types

### Event Hierarchy

```mermaid
flowchart TB
    subgraph Planning["Planning Events"]
        PC[PlanCreatedEvent]
        AC[AwaitingClarificationEvent]
        DE[DirectExecutionStartedEvent]
        SP[SubPlanCreatedEvent]
    end

    subgraph Approval["Approval Events"]
        PA[PlanApprovedEvent]
        PR[PlanRejectedEvent]
        PF[PlanFeedbackEvent]
        QC[QuestionsCollectedEvent]
    end

    subgraph Execution["Execution Events"]
        SS[StepStartedEvent]
        SC[StepCompletedEvent]
        SF[StepFailedEvent]
        EC2[EvaluationCompletedEvent]
        RT[ReplanTriggeredEvent]
        PU[PlanUpdatedEvent]
        GA[GoalAchievedEvent]
        EB[ExecutionBlockedEvent]
        EComp[ExecutionCompletedEvent]
    end

    subgraph Recovery["Recovery Events"]
        RA[RecoveryAnalysisEvent]
        AFS[AutoFixStartedEvent]
        AFC[AutoFixCompletedEvent]
        RPP[RecoveryPlanProposedEvent]
    end

    subgraph Interrupt["Interrupt Events"]
        IQ[InterruptQueuedEvent]
        IR[InterruptReceivedEvent]
        IP[InterruptProcessingEvent]
        PCan[PlanCancelledEvent]
        CI[ContextInjectedEvent]
    end
```

### Event to gRPC Response Mapping

```mermaid
flowchart LR
    subgraph Events["Coordinator Events"]
        E1[StepStartedEvent]
        E2[StepCompletedEvent]
        E3[StepFailedEvent]
        E4[EvaluationCompletedEvent]
        E5[RecoveryAnalysisEvent]
        E6[QuestionsCollectedEvent]
        E7[RecoveryPlanProposedEvent]
        E8[ExecutionCompletedEvent]
    end

    subgraph Responses["gRPC Responses"]
        R1[step_progress ACTION]
        R2[step_progress REASONING]
        R3[awaiting_input]
        R4[complete]
        R5[error]
    end

    E1 --> R1
    E2 --> R1
    E3 --> R1
    E3 --> R5
    E4 --> R2
    E5 --> R2
    E6 --> R3
    E7 --> R3
    E8 --> R4
```

---

## 6. Callback Patterns

### Step Callbacks (smolagents)

```mermaid
sequenceDiagram
    participant A as Agent
    participant S as step_callbacks
    participant P as PlanningCallback

    A->>A: agent.run(task)

    loop Each Planning Step
        A->>S: PlanningStep emitted
        S->>P: planning_callback(step)
        P->>P: Capture for cascade planning
    end

    A-->>A: Execution continues
```

### Progress Callbacks (Nested Skills)

```mermaid
sequenceDiagram
    participant E as ExecutionCoordinator
    participant C as ExecutionContext
    participant S as Skill
    participant CB as ProgressCallback

    E->>C: Create context with callback
    E->>S: skill.forward()

    loop During Execution
        S->>CB: progress_callback(step_dict)
        CB->>CB: Collect nested steps
    end

    S-->>E: Skill completes
    E->>E: Yield collected steps
```

### Evaluation Tool Pattern

```mermaid
sequenceDiagram
    participant E as ExecutionCoordinator
    participant EA as EvaluatorAgent
    participant ET as EvaluationTool

    E->>EA: evaluator.run(prompt)
    EA->>EA: LLM reasoning
    EA->>ET: forward(goal_achieved, ...)
    ET->>ET: Capture result
    EA-->>E: Run completes
    E->>ET: get_result()
    ET-->>E: Structured evaluation
```

### HITL Interrupt Flow

```mermaid
sequenceDiagram
    participant MA as ManagedAgent
    participant IA as InterruptAwareAgent
    participant CPS as ChatProcessingService
    participant F as Frontend
    participant U as User

    MA->>MA: Destructive action detected
    MA->>IA: raise AgentError("interrupted")
    IA->>IA: Propagate interrupt
    IA->>CPS: Yield awaiting_input
    CPS->>F: Stream response
    F->>U: Show approval dialog
    U->>F: Approve/Reject
    F->>CPS: User response
    CPS->>IA: Resume with response
    IA->>MA: Continue execution
```

---

## 7. Error Recovery Flow

```mermaid
flowchart TB
    FAIL[Step Failed] --> ANALYZE[LLM Analyzes Failure]
    ANALYZE --> CONF{Confidence Score}

    CONF -->|"≥ 80%"| AUTO[Auto-Fix]
    CONF -->|"50-80%"| PROPOSE[Propose Fix]
    CONF -->|"< 50%"| ASK[Ask User]

    AUTO --> AFS[AutoFixStartedEvent]
    AFS --> RETRY[Retry Step]
    RETRY --> SUCCESS{Success?}
    SUCCESS -->|Yes| AFC[AutoFixCompletedEvent]
    SUCCESS -->|No| PROPOSE

    PROPOSE --> RPP[RecoveryPlanProposedEvent]
    RPP --> AWAIT[Await User Approval]
    AWAIT -->|Approved| RETRY
    AWAIT -->|Rejected| ASK

    ASK --> AC[AwaitingClarificationEvent]
    AC --> USER[User Provides Guidance]
    USER --> REPLAN[Replan with Guidance]

    AFC --> CONTINUE[Continue Execution]
    REPLAN --> CONTINUE
```

### Error Classification

```mermaid
flowchart TD
    ERROR[Error Detected] --> CLASSIFY{Error Type}

    CLASSIFY -->|"Network, Rate Limit"| TRANSIENT[TRANSIENT]
    CLASSIFY -->|"Agent State Corrupted"| RECOVERABLE[RECOVERABLE]
    CLASSIFY -->|"Unrecoverable"| FATAL[FATAL]

    TRANSIENT --> PRESERVE[Preserve Session]
    PRESERVE --> MANUAL[Allow Manual Retry]

    RECOVERABLE --> CLEAR[Clear Agent Memory]
    CLEAR --> TRACK[Track Error Count]
    TRACK --> CHECK{Count ≥ 3?}
    CHECK -->|No| KEEP[Keep Session]
    CHECK -->|Yes| REMOVE[Remove Session]

    FATAL --> REMOVE
    REMOVE --> RESET[Reset All State]
```

---

## 8. Key Files Reference

### Core Orchestration

| File | Purpose |
|------|---------|
| `execution_coordinator.py` | Main state machine, phases, event emission |
| `coordinator_state_machine.py` | Persistent phase transitions, context storage |
| `chat_processing_service.py` | gRPC entry point, streaming, session routing |
| `session_manager.py` | Agent lifecycle, memory persistence |
| `coordinator_event_converter.py` | Event → gRPC response conversion |
| `response_types.py` | TypedDict definitions for responses, factory functions |
| `interrupt_classifier.py` | LLM-based interrupt classification |
| `task_classifier.py` | Task complexity classification |
| `plan_service.py` | Plan generation and recovery analysis |
| `step_executor.py` | Individual step execution |
| `task_ledger.py` | Execution state tracking |

### User-Defined Agent Execution

| File | Purpose |
|------|---------|
| `mention_parser.py` | Parse @agent:name mentions from messages |
| `mention_routing.py` | Route to user-defined agents via async API calls |
| `agent_executor_agent.py` | Dynamic ToolCallingAgent factory for user agents |
| `skill_invoker_tool.py` | Wrap skills as callable tools with HITL input gathering |
| `agent_executor.j2` | Persona-based prompt template for user agents |

### Built-in Agents

| File | Purpose |
|------|---------|
| `evaluator_agent.py` | Goal/progress evaluation agent |
| `skill_builder_agent.py` | HITL agent for skill modifications |
| `document_builder_agent.py` | HITL agent for document operations |
| `table_builder_agent.py` | Autonomous agent for single table operations |
| `schema_builder_agent.py` | HITL agent for complex schema design |
| `app_builder_agent.py` | HITL agent for Puck app management (has page_builder as managed agent) |
| `page_builder_agent.py` | HITL agent for Puck page creation with full block schema |
| `agent_builder_agent.py` | HITL agent for configuring agents (persona, automations, skills) |
| `research_agent.py` | Web search and research agent |
| `research_emery_agent.py` | System introspection agent |
| `planning_utils.py` | Shared count-based planning callback for HITL workflows |

### Cascade Planning

| File | Purpose |
|------|---------|
| `sub_agent_planner.py` | Orchestrates cascade planning with gap analysis and recursive nesting |
| `task_classifier.py` | Task classification and step → agent classification for cascade detection |
| `plan_step_executor.py` | Executes plan steps including recursive nested sub-plans |
| `managed_agents_factory.py` | Central factory for creating all agents with consistent configuration |

---

## 9. App and Page Builder HITL Workflow

### Overview

The `app_builder` and `page_builder` agents use a count-based planning callback pattern that ensures context gathering before presenting plans to users for approval.

### Count-Based Planning Callback

Both agents use `create_planning_callback()` from `planning_utils.py`:

- **First PlanningStep (count=1)**: Skip interrupt, allow agent to continue gathering context
- **Second PlanningStep (count=2)**: Interrupt and request user approval
- **planning_interval=3**: Generate plans after every 3 action steps

This pattern ensures agents gather sufficient context (e.g., reading existing apps/pages, analyzing requirements) before creating detailed plans.

```mermaid
flowchart TB
    START[Agent Starts Task] --> PLAN1[PlanningStep 1<br/>Generic Plan]
    PLAN1 --> CHECK1{Callback Count Check}
    CHECK1 -->|count=1| CONTINUE[No Interrupt<br/>Continue Context Gathering]
    CONTINUE --> ACTION1[ActionStep 2<br/>List Apps/Pages]
    ACTION1 --> ACTION2[ActionStep 3<br/>Read Existing Data]
    ACTION2 --> PLAN2[PlanningStep 2<br/>Detailed Plan with Context]
    PLAN2 --> CHECK2{Callback Count Check}
    CHECK2 -->|count=2| INTERRUPT[Interrupt for Approval]
    INTERRUPT --> HITL[User Approval Required]
    HITL -->|Approved| EXECUTE[Execute Plan]
    HITL -->|Rejected| IDLE[Return to IDLE]
    HITL -->|Feedback| REPLAN[Replan with Feedback]
```

### App Builder Agent

```mermaid
flowchart TB
    subgraph AppBuilder["App Builder Agent"]
        AB_TOOLS[Tools: tool_executor]
        AB_MANAGED[Managed Agent: page_builder]
        AB_PLANNING[planning_interval=3]
        AB_CALLBACK[Count-based Callback]
    end

    subgraph PageBuilder["Page Builder (Managed)"]
        PB_TOOLS[Tools: page_crud directly]
        PB_RESEARCH[Managed Agent: research_agent]
        PB_PLANNING[planning_interval=3]
        PB_CALLBACK[Count-based Callback]
    end

    AppBuilder -->|Delegates Complex Page Tasks| PageBuilder
    AppBuilder -->|App CRUD Operations| APP_API[App API Endpoints]
    AppBuilder -->|Page CRUD Operations| PAGE_API[Page API Endpoints]
    PageBuilder -->|Analyzes Reference URLs| PB_RESEARCH
    PageBuilder -->|Direct Page Operations| PAGE_API
```

**Key Features:**
- Uses `tool_executor` wrapper for app_crud and page_crud
- Has `page_builder` as managed agent for complex page creation
- Can delegate internally or be part of cascade planning
- planning_interval=3 with count-based callback for HITL

**Tools Available via tool_executor:**
- `app_crud`: list, read, create, update, delete
- `page_crud`: list, read, create, update, delete, update_content, publish, unpublish, update_state, add_dialog

### Page Builder Agent

**Key Features:**
- Receives `page_crud` DIRECTLY (not wrapped) to get full Puck block schema in instructions
- Has optional `research_agent` as managed agent for analyzing reference websites
- Full knowledge of all 38 Puck block types (prevents hallucination)
- planning_interval=3 with count-based callback for HITL
- max_steps=15 to accommodate research + planning + execution

**Workflow:**
1. Optionally research reference URL via research_agent
2. List/read existing pages (ActionStep)
3. Create detailed plan with Puck blocks (PlanningStep with count=2 → interrupt)
4. User approves plan
5. Build templateData with correct Puck block structure
6. Execute page_crud operations

### Page CRUD Tool - New Methods

The `page_crud` tool now includes additional methods for advanced page configuration:

#### update_state

Updates page state configuration (variables and persistence).

```python
page_crud(
    method="update_state",
    page_id=5,
    data={
        "variables": [
            {
                "name": "showLogin",
                "type": "boolean",
                "defaultValue": False
            },
            {
                "name": "userName",
                "type": "string",
                "defaultValue": ""
            }
        ],
        "persistence": "localStorage"  # Options: 'none' | 'session' | 'localStorage'
    }
)
```

**API Endpoint:** `PUT /api/pages/[id]/state`

**Use Cases:**
- Create dynamic pages with reactive state
- Store user preferences across sessions
- Build interactive applications with client-side state

#### add_dialog

Adds a dialog (modal) to the page.

```python
page_crud(
    method="add_dialog",
    page_id=5,
    data={
        "name": "Login Dialog",
        "stateKey": "showLogin",  # Boolean state variable controlling open/close
        "title": "Sign In",
        "description": "Enter your credentials",
        "size": "md",  # Options: 'sm' | 'md' | 'lg' | 'xl' | 'full'
        "closeOnOutsideClick": True,
        "closeOnEscape": True,
        "content": {
            "root": {"props": {}},
            "content": [
                # Puck blocks for dialog content
            ],
            "zones": {}
        }
    }
)
```

**API Endpoint:** `POST /api/pages/[id]/dialogs`

**Use Cases:**
- Add login/signup modals
- Create product detail popups
- Build confirmation dialogs
- Implement help/tutorial overlays

### API Endpoints

| Endpoint | Method | Purpose | TOON Support |
|----------|--------|---------|--------------|
| `/api/apps?format=llm` | GET | List all apps | Yes |
| `/api/apps?format=llm` | POST | Create app | Yes |
| `/api/apps/[id]?format=llm` | GET | Get app details | Yes |
| `/api/apps/[id]?format=llm` | PUT | Update app | Yes |
| `/api/apps/[id]?format=llm` | DELETE | Delete app | Yes |
| `/api/apps/[id]/pages?format=llm` | GET | List pages in app | Yes |
| `/api/apps/[id]/pages?format=llm` | POST | Create page | Yes |
| `/api/pages/[id]?format=llm` | GET | Get page details | Yes |
| `/api/pages/[id]?format=llm` | PUT | Update page metadata | Yes |
| `/api/pages/[id]?format=llm` | DELETE | Delete page | Yes |
| `/api/pages/[id]/content?format=llm` | PUT | Update page content | Yes |
| `/api/pages/[id]/publish?format=llm` | POST | Publish/unpublish page | Yes |
| `/api/pages/[id]/state?format=llm` | PUT | Update page state | Yes |
| `/api/pages/[id]/dialogs?format=llm` | POST | Add dialog to page | Yes |

All endpoints support `?format=llm` query parameter for TOON (LLM-optimized) responses.

### Agent Delegation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CP as ChatPlanner
    participant AB as AppBuilder
    participant PB as PageBuilder (Managed)
    participant RA as ResearchAgent
    participant API as Next.js API

    U->>CP: "Create an app with a landing page like flaxx.ai"
    CP->>AB: Route to app_builder

    Note over AB: PlanningStep 1 (count=1)
    AB->>AB: Create generic plan
    Note over AB: No interrupt - continue

    AB->>API: List existing apps
    AB->>API: Read app structure
    Note over AB: Context gathered

    Note over AB: PlanningStep 2 (count=2)
    AB->>AB: Create detailed plan
    Note over AB: INTERRUPT for approval

    AB-->>U: Show plan for approval
    U->>AB: Approve

    AB->>API: Create app
    AB->>PB: Delegate page creation to page_builder

    Note over PB: PlanningStep 1 (count=1)
    PB->>PB: Create generic page plan
    Note over PB: No interrupt - continue

    PB->>RA: Research flaxx.ai
    RA-->>PB: Design analysis
    PB->>API: List existing pages

    Note over PB: PlanningStep 2 (count=2)
    PB->>PB: Create detailed page plan with Puck blocks
    Note over PB: INTERRUPT for approval

    PB-->>U: Show page plan for approval
    U->>PB: Approve

    PB->>API: Create page with templateData
    PB->>API: Update page state (if needed)
    PB->>API: Add dialogs (if needed)
    PB-->>AB: Page created
    AB-->>U: App with page created successfully
```

---

## 10. Architecture Summary

```mermaid
flowchart TB
    subgraph External["External"]
        FE[Frontend]
    end

    subgraph Entry["Entry Layer"]
        GRPC[gRPC Server]
        CPS[ChatProcessingService]
        MP[MentionParser]
    end

    subgraph Session["Session Layer"]
        SM[SessionManager]
        AGENTS[Agent Pool]
    end

    subgraph Orchestration["Orchestration Layer"]
        EC[ExecutionCoordinator]
        TC[TaskClassifier]
        PS[PlanService]
        SE[StepExecutor]
        EV[Evaluator]
        IC[InterruptClassifier]
        MR[MentionRouting]
    end

    subgraph Agents["Built-in Agent Layer"]
        CA[ChatPlannerAgent]
        SB[SkillBuilderAgent]
        DB[DocumentBuilderAgent]
        TB[TableBuilderAgent]
        AB[AppBuilderAgent]
        PB[PageBuilderAgent<br/>managed by AppBuilder]
        RA[ResearchAgent]
    end

    subgraph UserAgents["User-Defined Agent Layer"]
        AE[AgentExecutor]
        SIT[SkillInvokerTools]
        UA[Dynamic Agent Instance]
    end

    subgraph Events["Event Layer"]
        CONV[EventConverter]
        RESP[ResponseTypes]
    end

    FE <-->|gRPC Stream| GRPC
    GRPC --> CPS
    CPS --> MP
    MP -->|"@agent mention"| MR
    MP -->|"No mention"| EC
    MR --> AE
    AE --> SIT
    SIT --> UA
    CPS --> SM
    SM --> AGENTS
    CPS --> EC
    EC --> TC
    EC --> PS
    EC --> SE
    EC --> EV
    EC --> IC
    SE --> CA
    SE --> SB
    SE --> DB
    SE --> TB
    SE --> AB
    SE --> PB
    SE --> RA
    AB --> PB
    PB --> RA
    EC --> CONV
    MR --> CONV
    CONV --> RESP
    RESP --> CPS
```

### Routing Decision Flow

```mermaid
flowchart LR
    MSG[User Message] --> CHECK{Has @agent:name?}
    CHECK -->|Yes| MR[MentionRouting]
    CHECK -->|No| EC[ExecutionCoordinator]

    MR --> AE[AgentExecutor]
    AE --> STREAM[Stream Response]

    EC --> TC{Task Complexity}
    TC -->|Direct| EXEC[Direct Execution]
    TC -->|Complex| PLAN[Plan & Approve]
    EXEC --> STREAM
    PLAN --> STREAM
```

---

## 11. Recursive Cascade Planning

The SubAgentPlanner enables nested planning where a parent agent's plan can reference managed agents, triggering recursive planning to create detailed sub-plans at each level.

### Overview

```mermaid
flowchart TB
    subgraph TopLevel["Top-Level Planning"]
        TASK[User Task] --> CLASSIFY[Task Classification]
        CLASSIFY --> PLAN[Generate High-Level Plan]
        PLAN --> STEPS[Plan Steps]
    end

    subgraph CascadePlanning["Cascade Planning (SubAgentPlanner)"]
        STEPS --> CHECK{Step targets agent?}
        CHECK -->|No| KEEP[Keep as-is]
        CHECK -->|Yes| SUBPLAN[Run Sub-Agent Planning]
        SUBPLAN --> NESTED{Sub-plan step targets agent?}
        NESTED -->|Yes, depth < 3| RECURSE[Recursive Planning]
        NESTED -->|No or depth >= 3| ATTACH[Attach Sub-Plan]
        RECURSE --> NESTED
        ATTACH --> ENHANCED[Enhanced Plan with Nested Sub-Plans]
    end

    KEEP --> FINAL[Final Plan]
    ENHANCED --> FINAL
```

### Cascade Planning Flow

```mermaid
sequenceDiagram
    participant EC as ExecutionCoordinator
    participant SAP as SubAgentPlanner
    participant TC as TaskClassifier
    participant AB as app_builder
    participant PB as page_builder

    EC->>SAP: run_planning(step, "app_builder", depth=0)

    SAP->>AB: Create agent, run planning
    AB-->>SAP: Sub-plan with steps

    loop For each step in sub-plan
        SAP->>TC: classify_step(step.description)
        TC-->>SAP: StepClassification(agent="page_builder", confidence=0.85)

        alt confidence > 0.7 and depth < max_depth
            SAP->>SAP: run_planning(step, "page_builder", depth=1)
            SAP->>PB: Create agent, run planning
            PB-->>SAP: Nested sub-plan
            SAP->>SAP: Attach nested sub-plan to step
        end
    end

    SAP-->>EC: Enhanced SubAgentPlanningResult
```

### Managed Agent Detection

Two methods are used to detect when a step should trigger nested agent planning:

**1. LLM Classification (Primary)**
```python
classification = task_classifier.classify_step(
    step_description="page_builder creates Home page with Hero section",
    available_agents=["page_builder", "table_builder", "research_agent"],
)
# Returns: StepClassification(target_agent="page_builder", confidence=0.85)
```

**2. Pattern Matching (Fallback)**
- Checks for agent name in step description (e.g., "page_builder creates...")
- Looks for delegation phrases: "delegate to X", "X builds", "using X"

### Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| `max_depth` | 3 | Maximum recursion depth (prevents infinite loops) |
| `confidence_threshold` | 0.7 | Minimum LLM classification confidence |
| `max_planning_rounds` | 3 | Maximum question rounds per agent |

### Example: app_builder → page_builder Recursion

**User Request:** "Create a CRM app with a customer portal"

```
1. Top-Level Plan:
   - Step 1: app_builder creates CRM app
   - Step 2: app_builder creates database schema

2. SubAgentPlanner processes Step 1 (app_builder):
   app_builder plans:
   ├─ Step 1: Create app container
   ├─ Step 2: page_builder creates Dashboard page  ← DETECTED
   ├─ Step 3: page_builder creates Customer list   ← DETECTED
   └─ Step 4: Publish app

3. RECURSIVE: Plan page_builder for Step 2 (depth=1):
   page_builder plans:
   ├─ Step 2a: Add Hero section
   ├─ Step 2b: Add Stats grid
   └─ Step 2c: Add DataBlock with recent customers

4. RECURSIVE: Plan page_builder for Step 3 (depth=1):
   page_builder plans:
   ├─ Step 3a: Add TableBlock with customer data
   └─ Step 3b: Add filters and pagination

5. Final Enhanced Plan:
   app_builder sub-plan:
   ├─ Step 1: Create app container
   ├─ Step 2: page_builder creates Dashboard
   │          └─ sub_plan: [Hero, Stats, DataBlock]
   ├─ Step 3: page_builder creates Customer list
   │          └─ sub_plan: [TableBlock, filters]
   └─ Step 4: Publish app
```

### Question Collection

Questions from all planning levels are collected and batched together:

```mermaid
flowchart LR
    subgraph Level0["Depth 0: app_builder"]
        Q1[Theme color?]
        Q2[App name?]
    end

    subgraph Level1["Depth 1: page_builder"]
        Q3[Hero style?]
        Q4[Show customer photos?]
    end

    Q1 --> BATCH[Batched Questions]
    Q2 --> BATCH
    Q3 --> BATCH
    Q4 --> BATCH

    BATCH --> USER[User answers all at once]
    USER --> RESUME[Planning resumes]
```

### Context Passing

Parent agent's planning observations are passed to nested agents:

```python
def run_planning(step, agent_name, depth, parent_context):
    # Merge parent context with gathered context
    full_context = f"{gathered_context}\n\n## Parent Agent Context\n{parent_context}"

    # Nested agents inherit parent's observations
    nested_result = self.run_planning(
        step=step,
        agent_name=nested_agent,
        depth=depth + 1,
        parent_context=result.sub_plan.planning_observations,
    )
```

### Execution of Nested Plans

```mermaid
sequenceDiagram
    participant PSE as PlanStepExecutor
    participant AB as app_builder
    participant PB as page_builder

    PSE->>PSE: _execute_sub_plan(app_builder sub-plan, depth=0)

    loop For each step
        alt Step has nested sub_plan
            PSE->>PSE: _execute_sub_plan(page_builder sub-plan, depth=1)
            PSE->>PB: Execute page creation steps
            PB-->>PSE: Page created
        else Regular step
            PSE->>AB: Execute step
            AB-->>PSE: Step result
        end
    end

    PSE-->>PSE: Combined results
```

### Key Files

| File | Purpose |
|------|---------|
| `sub_agent_planner.py` | Orchestrates cascade planning with recursion |
| `task_classifier.py` | LLM-based step → agent classification |
| `plan_step_executor.py` | Recursive execution of nested sub-plans |
| `execution_coordinator.py` | Configures SubAgentPlanner with max_depth |

### Architecture Diagram

```mermaid
flowchart TB
    subgraph SubAgentPlanner
        RUN[run_planning]
        GAP[Gap Analysis]
        PLAN[Agent Planning]
        ENHANCE[_enhance_with_nested_plans]
        DETECT[_detect_managed_agent]
    end

    subgraph TaskClassifier
        CLASSIFY[classify_step]
        LLM[LLM Classification]
        PATTERN[Pattern Matching]
    end

    RUN --> GAP
    GAP -->|No gaps| PLAN
    PLAN --> ENHANCE
    ENHANCE --> DETECT
    DETECT --> CLASSIFY
    CLASSIFY --> LLM
    LLM -->|Low confidence| PATTERN

    DETECT -->|Agent found| RUN
```
