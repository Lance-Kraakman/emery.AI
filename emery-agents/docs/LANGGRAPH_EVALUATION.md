# LangGraph Evaluation for ExecutionCoordinator

## Current State Machine Analysis

### State Variables (execution_coordinator.py:154-163)
```python
self._phase: Phase           # IDLE, WORKING, AWAITING_INPUT, COMPLETE, FAILED
self._work_mode: WorkMode    # PLANNING, EXECUTING
self._awaiting_type: InputType  # APPROVAL, CLARIFICATION, QUESTIONS, RECOVERY
self._execution_mode: ExecutionMode  # INTERACTIVE, AUTONOMOUS
```

### State Transition Helpers (~25 lines)
```python
_set_idle()      # → IDLE
_set_working()   # → WORKING + work_mode
_set_awaiting()  # → AWAITING_INPUT + input_type
_set_complete()  # → COMPLETE or FAILED
```

### Message Routing (handle_message: ~150 lines)
```
WORKING + PLANNING    → queue_interrupt()
WORKING + EXECUTING   → pause + queue_interrupt()
AWAITING_INPUT + CLARIFICATION → _handle_clarification_response()
AWAITING_INPUT + APPROVAL      → _handle_approval_response()
IDLE                           → execute()
```

---

## LangGraph Equivalent Architecture

### State Schema
```python
from langgraph.graph import StateGraph
from typing import TypedDict, Annotated

class CoordinatorState(TypedDict):
    # Task context
    task: str
    tools: List[Any]
    managed_agents: List[Any]

    # Plan state
    plan: Optional[Plan]
    current_step_index: int
    step_results: Dict[str, StepResult]

    # Execution tracking
    replan_count: int
    evaluation_count: int

    # Messages for human-in-the-loop
    messages: Annotated[List[str], operator.add]
```

### Graph Definition
```python
graph = StateGraph(CoordinatorState)

# Nodes
graph.add_node("plan", plan_node)              # create_plan() logic
graph.add_node("await_approval", human_node)    # Built-in interrupt
graph.add_node("execute_step", execute_node)    # execute_plan() step logic
graph.add_node("evaluate", evaluate_node)       # _evaluate_progress()
graph.add_node("replan", replan_node)          # _trigger_replan()
graph.add_node("synthesize", synthesize_node)  # _synthesize_final_answer()

# Edges
graph.set_entry_point("plan")
graph.add_edge("plan", "await_approval")
graph.add_conditional_edges("await_approval", route_approval, {
    "approved": "execute_step",
    "rejected": END,
    "feedback": "plan",  # Loop back
})
graph.add_edge("execute_step", "evaluate")
graph.add_conditional_edges("evaluate", should_continue, {
    "continue": "execute_step",
    "replan": "replan",
    "done": "synthesize",
})
graph.add_edge("replan", "execute_step")
graph.add_edge("synthesize", END)
```

---

## What LangGraph Replaces

| Current Code | Lines | LangGraph Equivalent |
|-------------|-------|---------------------|
| Phase enum + helpers | ~40 | State schema + graph nodes |
| handle_message() routing | ~150 | Conditional edges |
| Interrupt handling | ~100 | Built-in checkpoints |
| Approval flow | ~80 | Human-in-the-loop primitive |
| Execution loop | ~200 | Graph edges + conditions |
| **Total** | **~570** | **~100 lines of graph definition** |

## What You Keep

| Component | Lines | Reason |
|-----------|-------|--------|
| 30+ Event dataclasses | ~270 | UI feedback - LangGraph doesn't prescribe event types |
| plan_node logic | ~150 | Your PlanService + DSPy integration |
| execute_node logic | ~200 | Your PlanStepExecutor + DSPy ReAct |
| evaluate_node logic | ~80 | Your EvaluatorModule |
| ACE tracking | ~100 | Domain-specific context curation |
| Recovery handling | ~150 | Confidence-based decision logic |
| **Total** | **~950** | Domain logic stays |

---

## Concrete Benefits

### 1. Built-in Human-in-the-Loop
```python
# Current: Manual approval parsing
if response_lower in ("approve", "yes", "y", "ok", "proceed", "approved"):
    ...
elif response_lower in ("reject", "no", "n", "cancel", "rejected"):
    ...
else:
    # feedback

# LangGraph: Declarative interrupt
from langgraph.prebuilt import create_interrupt

def await_approval_node(state):
    return create_interrupt(
        message="Plan created. Approve?",
        resume_keys=["approved", "rejected", "feedback"]
    )
```

### 2. Built-in Checkpointing
```python
# Current: Manual PendingContext
self._pending_context = PendingContext(
    original_task=message,
    tools=effective_tools,
    managed_agents=effective_agents,
)

# LangGraph: Automatic persistence
checkpointer = PostgresSaver(connection_string)
graph = graph.compile(checkpointer=checkpointer)
# State automatically persists at each node
```

### 3. Visualization
```python
# LangGraph: Built-in graph visualization
graph.get_graph().draw_mermaid()
```

---

## Migration Complexity Assessment

### Easy Migrations (Low Risk)
- State transitions → Graph edges
- Interrupt queue → Built-in checkpoints
- Approval flow → Human-in-the-loop primitive

### Medium Complexity (Some Refactoring)
- Event emission: Need to emit events within nodes
- ACE integration: Wire into node callbacks

### Hard Parts (Significant Work)
- Streaming events during execution
- Current AsyncIterator pattern → LangGraph streaming API
- Recovery confidence routing → Custom conditional edges

---

## Recommendation

### Do NOT migrate if:
1. Your current state machine works fine
2. Team isn't familiar with LangGraph
3. You need fine-grained streaming control
4. You want to avoid another dependency

### Consider migrating if:
1. You need persistence/resumption across restarts
2. You want to visualize the execution flow
3. You're building more agents that need similar patterns
4. You want LangSmith observability integration

### My Assessment for Emery

**Don't migrate now.** Your refactored code is clean and working. LangGraph would:
- Save ~470 lines of state management code
- Add dependency + learning curve
- Require adapting your streaming pattern

The ROI isn't there for a single coordinator. If you build 3+ agent orchestrators with similar patterns, then consider extracting a shared LangGraph-based framework.

---

## If You Do Migrate Later

### Incremental Path
1. Keep ExecutionCoordinator, add LangGraph beside it
2. Extract node functions from your existing methods
3. Wire nodes into LangGraph
4. Test parity with existing behavior
5. Swap out gradually per feature

### Estimated Effort
- Initial LangGraph setup: 2-4 hours
- Node extraction: 4-8 hours
- Event/streaming adaptation: 8-16 hours
- Testing + debugging: 8-16 hours
- **Total: 22-44 hours**
