# Reflexion Integration Plan

Future implementation: Reflexion-style self-reflection integrated into the LangGraph plan-execute flow.

## Design Decision
Enhance the existing `replan` node rather than adding a new graph node. This keeps the graph topology stable, avoids extra checkpoints, and naturally fits the existing flow.

## Enhanced Replan Flow
```
BEFORE: execute_step -> replan (evaluate, recover, continue)
AFTER:  execute_step -> replan (REFLECT on step -> evaluate, recover, continue with insights)
```

## Changes Required

### 1. New DSPy Signature: `ReflectOnExecution`
**File**: `reasoning/signatures/evaluation.py`

- `StepReflection` model: quality_score (0-1), was_suboptimal, what_went_well, what_could_improve, refined_instructions, pattern_learned
- `ReflectOnExecution` signature: inputs = step_description, step_result, tool_evidence, plan_goal, previous_reflections
- Evaluates BEYOND success/failure (suboptimal but successful steps)

### 2. Enhanced EvaluatorModule
**File**: `reasoning/modules/evaluator.py`

- Add `self.reflector = dspy.ChainOfThought(ReflectOnExecution)`
- Add `reflect_on_step()` method

### 3. State Changes
**File**: `orchestrators/state.py`

- `step_reflections: Dict[str, Dict[str, Any]]` (step_id -> StepReflection.model_dump())
- `reflection_summary: str` (rolling summary, max ~1500 chars)

### 4. New Event
**File**: `services/execution/events.py`

- `ReflectionCompletedEvent(step_id, quality_score, was_suboptimal, pattern_learned)`

### 5. Enhanced Replan Node (core integration)
**File**: `orchestrators/nodes/replan.py`

In `replan_node()`:
- After error handling but before pending-step check, call `_reflect_on_step()`
- Before returning to execute_step, call `_enrich_next_step_with_reflections()`
- In `_do_replan()`, include `reflection_summary` in replan reason

New helpers:
- `_get_last_completed_step(plan)` - finds most recently completed step
- `_reflect_on_step(...)` - calls EvaluatorModule.reflect_on_step(), stores result, updates rolling summary
- `_update_reflection_summary(...)` - appends new insights, truncates oldest to stay under 1500 chars
- `_enrich_next_step_with_reflections(...)` - appends reflection insights to next step's description

## HITL Integration
- Reflection runs AFTER step execution, WITHIN the replan node
- Does NOT trigger re-execution automatically (respects HITL flow)
- Insights improve remaining step instructions, not re-execute completed steps

## Token Budget
- Rolling summary capped at 1500 chars (~375 tokens)
- Step results truncated to 500 chars for reflection input
- Only runs on successful steps (failed -> recovery)
- Deduplication prevents re-reflecting on LangGraph resume

## Files Changed (no graph topology changes)
1. `reasoning/signatures/evaluation.py` - Add StepReflection + ReflectOnExecution
2. `reasoning/modules/evaluator.py` - Add reflect_on_step()
3. `orchestrators/state.py` - Add step_reflections + reflection_summary
4. `services/execution/events.py` - Add ReflectionCompletedEvent
5. `orchestrators/nodes/replan.py` - Core integration
