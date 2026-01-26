# Orchestration Flow: Planning vs Execution

**Last Updated:** 2025-01-27

## Overview

This document details the two primary execution flows in the agentic chat system:
1. **Planning Flow** - For complex tasks requiring structured plans and approval
2. **Standard Chat Flow** - For simple agent interactions

## Flow Comparison

| Aspect | Planning Flow | Standard Chat |
|--------|---------------|---------------|
| **Entry Point** | `CoordinatorStreamingHandler` | `AgentStreamingHandler` |
| **Phase 1** | Planning with read-only tools | Direct agent execution |
| **User Input** | Requires approval | Optional |
| **Tool Access** | Limited during planning | Full access |
| **Evaluation** | After each step | None |
| **Replanning** | Dynamic if needed | N/A |

---

## Planning Flow (Coordinator)

### Phase 1: Plan Generation

```
User Request: "Build me an expense tracker app"
                    │
                    ▼
    ┌───────────────────────────────────┐
    │      PlannerModule (DSPy)         │
    │                                   │
    │  1. Intent Classification         │
    │     ├─ Greeting → Ask what next   │
    │     ├─ Question → Informational   │
    │     └─ Actionable → Continue      │
    │                                   │
    │  2. Delegation Detection          │
    │     "whatever you think" → Use    │
    │     defaults, don't ask           │
    │                                   │
    │  3. Task Analysis                 │
    │     Understand complexity,        │
    │     requirements, dependencies    │
    │                                   │
    │  4. Plan Generation               │
    │     Create structured steps OR    │
    │     Return clarifying questions   │
    └───────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    ┌─────────────┐      ┌─────────────────────────┐
    │ Need Info?  │      │ Plan Generated          │
    │             │      │                         │
    │ Questions:  │      │ Steps:                  │
    │ - Budget?   │      │ 1. Create database      │
    │ - Features? │      │ 2. Create expenses tbl  │
    │             │      │ 3. Create app           │
    └──────┬──────┘      │ 4. Create input page    │
           │             │ 5. Create summary page  │
           ▼             └───────────┬─────────────┘
    AwaitingClarification             │
           │                          ▼
           │                 PlanCreatedEvent
           │                          │
           └──────────────┬───────────┘
                          ▼
                 AWAITING_INPUT (APPROVAL)
                          │
              User approves/rejects/modifies
                          │
                          ▼
                 PlanApprovedEvent
```

**Key File:** `emery_agents/reasoning/modules/planner.py`

### DSPy Signatures

```python
class AnalyzeTask(dspy.Signature):
    """Analyze user request to understand requirements."""
    request: str = dspy.InputField()
    context: str = dspy.InputField()
    analysis: TaskAnalysis = dspy.OutputField()

class CreatePlan(dspy.Signature):
    """Create structured plan or return questions."""
    analysis: TaskAnalysis = dspy.InputField()
    workspace: WorkspaceContext = dspy.InputField()
    output: Union[Plan, ClarifyingQuestions] = dspy.OutputField()
```

### Tool Filtering During Planning

Only read-only tools are available during planning to prevent destructive operations:

```python
# Tool modes: READ_ONLY during planning, FULL during execution
class ToolMode(Enum):
    READ_ONLY = "read_only"
    FULL = "full"
```

**Key File:** `emery_agents/tools/tool_modes.py`

---

### Phase 2: Plan Execution

```
Plan Approved
      │
      ▼
┌─────────────────────────────────────────────────────┐
│              ExecutionCoordinator                    │
│                                                      │
│  for step in plan.pending_steps:                    │
│      ├─ Mark step in_progress                       │
│      ├─ StepExecutor.execute_step(step)             │
│      ├─ Collect result                              │
│      ├─ Mark step completed/failed                  │
│      │                                               │
│      └─ Run Evaluator (configurable frequency)      │
│          ├─ Goal achieved? → Stop early             │
│          ├─ Blocking issue? → Block execution       │
│          └─ Need replan? → Trigger replanning       │
└─────────────────────────────────────────────────────┘
      │
      ├─ All steps complete
      │       │
      │       ▼
      │  FinalSynthesisEvent
      │  (DSPy synthesizes answer)
      │       │
      │       ▼
      │  ExecutionCompletedEvent
      │
      └─ Step failed
              │
              ▼
      ┌───────────────────────────┐
      │    Recovery Analysis      │
      │                           │
      │  Confidence >= 0.8        │
      │    → Auto-fix             │
      │                           │
      │  Confidence 0.5-0.8       │
      │    → Propose fix          │
      │                           │
      │  Confidence < 0.5         │
      │    → Ask questions        │
      └───────────────────────────┘
```

**Key File:** `emery_agents/services/execution_coordinator.py` (Lines 1051-1568)

### Step Executor

Executes individual plan steps with tool calling:

```python
class StepExecutor:
    def execute_step(self, step: PlanStep, tools: List[Tool]) -> StepResult:
        # Create tool-calling agent for this step
        agent = ToolCallingAgent(tools=tools)

        # Execute with step context
        result = agent.run(step.description)

        return StepResult(
            success=result.success,
            output=result.output,
            tool_calls=result.tool_calls
        )
```

**Key File:** `emery_agents/services/execution/step_executor.py`

---

### Dynamic Replanning

Replanning can be triggered during execution:

**Triggers:**
1. Evaluator detects blocking issues
2. User provides feedback on plan
3. Phase completes with `replan_after=True`
4. Goal not achieved after all steps

**Process:**
```
Replan Triggered
      │
      ▼
┌────────────────────────────┐
│    ReplanHandler           │
│                            │
│  1. Create plan diff       │
│  2. Identify remaining     │
│     work needed            │
│  3. Generate new steps     │
│  4. Update plan in-place   │
│  5. Continue execution     │
└────────────────────────────┘
```

**Key File:** `emery_agents/services/execution/replan_handler.py`

---

## Standard Chat Flow (Agent)

### Direct Agent Execution

```
User Message: "What's the weather?"
              │
              ▼
┌─────────────────────────────────────────┐
│        AgentStreamingHandler            │
│                                         │
│  1. Check session for existing agent    │
│     ├─ HOT: Reuse agent (memory intact) │
│     └─ COLD: Recreate from history      │
│                                         │
│  2. Create ToolCallingAgent             │
│     - Load configured tools             │
│     - Set up LLM (org model or default) │
│                                         │
│  3. Execute agent steps                 │
│     - Agent decides tool calls          │
│     - Tools execute                     │
│     - Results streamed back             │
│                                         │
│  4. Stream final response               │
└─────────────────────────────────────────┘
              │
              ▼
      Response streamed to user
```

**Key File:** `emery_agents/grpc/agent_streaming.py` (Lines 108-350)

### Session Memory

```python
# HOT PATH - Agent exists in session
if session.agent:
    agent = session.agent  # Memory preserved

# COLD PATH - Recreate agent
else:
    agent = create_agent(conversation_history)
    session.agent = agent  # Cache for next message
```

---

## Interrupt Handling

Users can interrupt ongoing planning/execution:

```
User Interrupt: "Actually, add a budget field too"
                    │
                    ▼
┌─────────────────────────────────────────┐
│          InterruptHandler               │
│                                         │
│  1. Queue interrupt                     │
│     (don't block current operation)     │
│                                         │
│  2. Classify interrupt                  │
│     ├─ CONTEXT_ADD: Extra info          │
│     ├─ SCOPE_CHANGE: Modify task        │
│     └─ CANCEL: Stop everything          │
│                                         │
│  3. Process at safe point               │
│     - Inject context to ledger          │
│     - Trigger replan if needed          │
│     - Or cancel gracefully              │
└─────────────────────────────────────────┘
```

**Key File:** `emery_agents/services/execution/interrupt_handler.py`

---

## Event Timeline Example

### Planning Flow Timeline

```
T0:  User sends "Build expense tracker app"
     └─ PlanningStartedEvent

T1:  Planner analyzes task
     └─ (internal processing)

T2:  Planner needs clarification
     └─ AwaitingClarificationEvent
        Questions: ["Category tracking?", "Multi-user?"]

T3:  User responds "Single user, with categories"
     └─ (clarification processed)

T4:  Plan generated
     └─ PlanCreatedEvent
        Steps: [database, table, app, pages...]

T5:  User approves plan
     └─ PlanApprovedEvent

T6:  Step 1 begins
     └─ StepStartedEvent: "Create expenses database"

T7:  Step 1 completes
     └─ StepCompletedEvent
        Result: { database_id: 123 }

T8:  Evaluation runs
     └─ EvaluationCompletedEvent
        { goal_achieved: false, continue: true }

T9-T20: Remaining steps execute...

T21: All steps complete
     └─ FinalSynthesisEvent
        "I've created your expense tracker..."

T22: Execution finished
     └─ ExecutionCompletedEvent
```

### Standard Chat Timeline

```
T0:  User sends "Show me my expenses"
     └─ (message received)

T1:  Agent executes query tool
     └─ (tool call: table_query)

T2:  Response streamed
     └─ "Here are your expenses: ..."
```

---

## Phase Management

### Multi-Phase Execution

Plans can have multiple phases for complex tasks:

```python
class PlanPhase(Enum):
    DISCOVERY = "discovery"     # Understand current state
    ANALYSIS = "analysis"       # Analyze requirements
    EXECUTION = "execution"     # Make changes
    VALIDATION = "validation"   # Verify results
```

Each phase:
1. Emits `PhaseStartedEvent`
2. Executes its steps
3. Emits `PhaseCompletedEvent`
4. May trigger replanning before next phase

---

## Key Implementation References

### TypeScript

| File | Key Functions |
|------|---------------|
| `src/app/api/chat/stream-grpc/route.ts:96-119` | Authentication |
| `src/app/api/chat/stream-grpc/route.ts:243-259` | gRPC call |
| `src/app/api/chat/stream-grpc/route.ts:59-89` | Debounced message updates |

### Python

| File | Key Functions |
|------|---------------|
| `chat_processing_service.py:135-348` | `ProcessMessage()` RPC |
| `execution_coordinator.py:576-678` | `execute()` entry |
| `execution_coordinator.py:852-1018` | `create_plan()` |
| `execution_coordinator.py:1051-1568` | `execute_plan()` |
| `planner.py:110-132` | DSPy planning |
| `agent_streaming.py:108-350` | Standard agent execution |

---

## Related Documentation

- [System Overview](./SYSTEM_OVERVIEW.md) - High-level architecture
- [Agentic Chat System](./AGENTIC_CHAT_SYSTEM.md) - Component overview
