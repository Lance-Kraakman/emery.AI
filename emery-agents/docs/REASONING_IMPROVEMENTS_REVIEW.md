# Reasoning Improvements Review

## What was implemented and why

4 improvements, no graph topology changes:

### 1. ClassifyTask prompt fix (research task routing)

Research tasks like "research claude skills" were being routed to PLAN_AND_APPROVE (multi-step planning mode) instead of DIRECT (execute immediately). The `ClassifyTask` signature docstring didn't mention research/conversational tasks. Fixed by adding explicit rules and examples to the docstring. No code changes, just better prompt engineering for the classifier LLM.

**File:** `reasoning/signatures/planning.py` (ClassifyTask docstring)

### 2. dspy.Refine on DIRECT execution

DIRECT mode had zero quality gating. ReAct ran once and returned whatever it got. Now wrapped in `dspy.Refine(N=3, threshold=0.8)` with an LLM-as-judge reward function. On each attempt, a small `ChainOfThought(JudgeDirectExecution)` scores the result 0-1. If >= 0.8, returns immediately (most tasks pass first try). If below, Refine generates feedback and retries with hints. Fast-paths skip the LLM call for obvious failures (empty result, all tools errored).

**Files:**
- `reasoning/signatures/evaluation.py` — `DirectExecutionJudgement` model + `JudgeDirectExecution` signature
- `reasoning/modules/executor.py` — `DirectExecutorModule` (returns Prediction for Refine compat) + `direct_execution_reward` (LLM judge)
- `grpc/coordinator_streaming.py` — Refine wrapping in `_handle_direct_execution`

### 3. Reflexion on step execution

Steps in a plan execute sequentially but didn't learn from each other. A step that was suboptimal-but-successful couldn't inform the next step. Now after each step completes, the replan node reflects on it via `ReflectOnExecution`, extracts a pattern/insight, appends it to a rolling summary (capped at 1500 chars), and injects that summary into the next pending step's description as `[INSIGHTS FROM PREVIOUS STEPS]`.

**Files:**
- `reasoning/signatures/evaluation.py` — `StepReflection` model + `ReflectOnExecution` signature
- `reasoning/modules/evaluator.py` — `reflect_on_step()` method
- `orchestrators/state.py` — `step_reflections` + `reflection_summary` state fields
- `services/execution/events.py` — `ReflectionCompletedEvent`
- `grpc/coordinator_event_converter.py` — Reflection event conversion for UI
- `orchestrators/nodes/replan.py` — 4 helpers + integration into `replan_node()`

### 4. Self-Discover for plan generation

Plans were generated in one shot. Now before `CreatePlan` runs, a `SelectReasoningApproach` call picks the best reasoning mode (analytical, creative, systems-thinking, step-by-step) based on the task analysis. The chosen approach + key considerations are prepended to the guidance the planner sees.

**Files:**
- `reasoning/signatures/planning.py` — `ReasoningApproach` model + `SelectReasoningApproach` signature
- `reasoning/modules/planner.py` — `approach_selector` in `__init__` + integration in `forward()`

---

## Issues found

### 1. `ReasoningApproach.primary_approach` should be an enum, not a free string

The field description says it should be one of 4 values (`analytical`, `creative`, `systems-thinking`, `step-by-step`), but the type is `str`. The LLM could return anything. Not a blocker since DSPy's structured output will try to match the description, but it's less constrained than the rest of the codebase's pattern (e.g., `TaskDomain`, `TaskComplexity` are all enums).

### 2. `_finish` and `_do_replan` don't propagate reflection state

The reflection state (`step_reflections`, `reflection_summary`) is only returned in Case 2 (more pending steps). When Case 3 flows to `_finish()` or `_do_replan()`, neither passes these fields. The last step's reflection is performed (events are emitted) but the state fields won't be persisted in the LangGraph checkpoint after the final step. Doesn't affect functionality (reflections already did their job enriching prior steps), but if you ever wanted to inspect reflection history in the final state, the last step's data would be missing.

### 3. `SelectReasoningApproach` runs for every plan, including trivial ones

`SkillTemplatePlannerModule` extends `PlannerModule`, so it inherits `approach_selector` in `__init__`. But its `forward()` override never calls it — dead attribute. The main `PlannerModule` always runs the approach selector even for simple 1-step plans (1 extra LLM call).

---

## Data flows

### DIRECT mode flow
```
User message → ClassifyTask → DIRECT
  → DirectExecutorModule.forward() [ReAct]
  → dspy.Refine wraps this:
    → Run ReAct → direct_execution_reward judges result
    → If score >= 0.8: return immediately
    → If score < 0.8: Refine generates feedback, retries (up to 3x)
  → extract_dspy_result(prediction) → result string
  → Stream to user
```

### PLAN_AND_APPROVE planning flow
```
User message → ClassifyTask → PLAN_AND_APPROVE
  → PlannerModule.forward():
    1. AnalyzeTask → task_analysis
    2. SelectReasoningApproach(request, task_analysis, workspace_context) → approach  [NEW]
    3. Build effective_guidance = approach_guidance + think_first + capability_guidance
    4. CreatePlan(ReAct with discovery tools) → plan
  → Plan shown to user for approval
```

### PLAN_AND_APPROVE execution flow (per step)
```
execute_step node → step runs → replan node:
  1. If error → _handle_step_failure (unchanged)
  2. If no error:
     a. _get_last_completed_step(plan)
     b. _reflect_on_step(step, plan, state, events)  [NEW]
        → EvaluatorModule.reflect_on_step() → StepReflection
        → Store in step_reflections dict
        → Emit ReflectionCompletedEvent
     c. _update_reflection_summary(summary, step_id, reflection)  [NEW]
        → Append pattern_learned to rolling summary
        → Truncate if > 1500 chars
     d. If more pending steps:
        → _enrich_next_step_with_reflections(plan, summary)  [NEW]
        → Append [INSIGHTS FROM PREVIOUS STEPS] to next step description
        → Return updated plan + reflections
     e. If all done → _evaluate_progress → _finish/_do_replan (unchanged)
```

### Flows NOT touched (verified still work)
- Skill template planning (`SkillTemplatePlannerModule`) — overrides `forward()`, never calls approach selector
- `SimplePlannerModule` — doesn't use approach selector
- `ExecutorModule` (plan step execution) — still returns `str`, used by plan step execution
- `DelegatingExecutorModule` — unchanged, delegates to agents
- Recovery flow (`_handle_step_failure`) — returns before reflection code runs
- Human-in-the-loop interrupt flow — separate from replan node internals
