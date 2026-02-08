# Event Streaming Architecture

Nodes emit dataclass events for real-time UI feedback. Events flow through the `events` accumulator in state.

**Pattern:**
```python
from ...services.execution.events import StepStartedEvent, StepCompletedEvent

async def my_node(state, runtime) -> Dict[str, Any]:
    events: List[Any] = []

    events.append(StepStartedEvent(
        plan_id=plan.id,
        step_id=step.step_id,
        step_description=step.description,
    ))

    # ... do work ...

    events.append(StepCompletedEvent(
        plan_id=plan.id,
        step_id=step.step_id,
        result=outcome.summary,
    ))

    return {"events": events, ...}  # events accumulates via operator.add
```

**Core event types** (see `services/execution/events.py`):
- `PlanCreatedEvent`, `PlanApprovedEvent` — plan lifecycle
- `StepStartedEvent`, `StepCompletedEvent`, `StepFailedEvent` — step execution
- `FinalSynthesisEvent`, `ExecutionCompletedEvent` — completion
- `AwaitingClarificationEvent` — human-in-the-loop

All event fields must be serializable (primitives, strings, dicts).
