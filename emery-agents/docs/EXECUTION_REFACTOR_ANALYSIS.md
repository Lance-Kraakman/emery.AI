# Execution Module Refactoring Analysis

## Current State Assessment

### Folder Structure Issues

The current `services/execution/` folder has grown organically with mixed concerns:

```
services/
├── execution/                    # Phase 2 refactored files mixed with old files
│   ├── agentic_executor.py      # NEW Phase 2 - skill LLM orchestration
│   ├── config.py                # OLD - unclear purpose
│   ├── coordinator_executor.py  # NEW Phase 2 - two-phase plan-execute
│   ├── events.py                # SHARED - execution events
│   ├── human_skill_handler.py   # NEW Phase 1 - unified human skill handling
│   ├── interactive_executor.py  # NEW Phase 2 - chat direct commands
│   ├── interrupt_handler.py     # OLD - interrupt classification
│   ├── output_pipeline.py       # NEW Phase 1 - output extraction/coercion
│   ├── plan_step_executor.py    # OLD - single plan step execution
│   ├── prompt_template_resolver.py  # NEW Phase 1 - template resolution
│   ├── replan_handler.py        # OLD - replanning logic
│   ├── router.py                # NEW Phase 3 - execution routing
│   ├── state.py                 # OLD - execution state
│   ├── state_machine.py         # OLD - state transitions
│   ├── step_executor.py         # OLD wrapper - imports from skills/
│   └── workflow/                # NEW Phase 2 - DAG workflow
│       ├── handlers/
│       │   └── router.py        # Step type handlers
│       ├── orchestrator.py      # DAG traversal
│       └── types.py             # Internal types
├── agents/
│   └── executor.py              # OLD - AgentExecutor (1313 lines)
└── skills/
    ├── executor.py              # OLD - SkillExecutorService (997 lines)
    └── step_executor.py         # OLD - StepExecutorService (1725 lines)
```

**Problems:**
1. OLD and NEW files mixed together
2. No clear module boundaries
3. Duplicate step_executor.py (wrapper + real implementation)
4. Unclear what files belong together

---

## Data Flow Analysis

### Original Data Flows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORIGINAL ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────┘

AgentExecutor.execute_task(ExecutionContext)
    │
    ├─── use_coordinator=True ────────► _execute_with_coordinator()
    │                                        │
    │                                        └── LangGraph plan-execute cycle
    │
    ├─── is_interactive=True ─────────► _create_direct_execution_agent()
    │                                        │
    │                                        └── DSPy ReAct module
    │
    └─── else (skill execution) ──────► skill_executor_service.execute_skill()
                                              │
                                              ├── is_human_skill ──► _handle_human_skill()
                                              │
                                              ├── is_workflow ─────► _execute_steps()
                                              │                           │
                                              │                           └── StepExecutorService
                                              │                                   │
                                              │                                   ├── _execute_inline_step
                                              │                                   ├── _execute_skill_step
                                              │                                   ├── _execute_read_step
                                              │                                   ├── _execute_write_step
                                              │                                   ├── _execute_tool_step
                                              │                                   └── _execute_agentic_step
                                              │
                                              ├── has_stored_plan ──► _execute_agentic()
                                              │                           │
                                              │                           └── Wrapper DAG + PlanStepExecutor
                                              │
                                              └── else ───────────► _execute_agent()
                                                                        │
                                                                        └── DSPy ReAct module
```

### New Data Flows (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REFACTORED ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────┘

ExecutionRouter.execute_*(Request)
    │
    ├─── InteractiveRequest ──────────► InteractiveExecutor.execute()
    │                                        │
    │                                        └── DSPy ReAct module
    │
    ├─── CoordinatorRequest ──────────► CoordinatorExecutor.execute()
    │                                        │
    │                                        └── LangGraph plan-execute cycle
    │
    └─── SkillRequest ────────────────► Router decision:
                                              │
                                              ├── is_human_skill ──► HumanSkillHandler.emit_sync()
                                              │
                                              ├── is_workflow ─────► WorkflowOrchestrator.execute()
                                              │                           │
                                              │                           └── StepHandlerRouter.handle_step()
                                              │                                   │
                                              │                                   ├── _handle_inline_step
                                              │                                   ├── _handle_skill_step
                                              │                                   ├── _handle_read_step
                                              │                                   ├── _handle_write_step
                                              │                                   ├── _handle_tool_step
                                              │                                   └── _handle_agentic_step
                                              │
                                              └── else ───────────► AgenticExecutor.execute()
                                                                        │
                                                                        └── DSPy ReAct module
```

---

## Missing Functionality Analysis

### 1. AgenticExecutor vs SkillExecutorService._execute_agent()

| Feature | Original | AgenticExecutor | Status |
|---------|----------|-----------------|--------|
| Tool loading | ✅ | ✅ | Complete |
| Template variable resolution | ✅ | ✅ (simpler) | Partial |
| DSPy ReAct execution | ✅ | ✅ | Complete |
| Output extraction via OutputPipeline | ✅ | ✅ | Complete |
| Progress callbacks | ✅ | ✅ | Complete |
| **Skill attachments processing** | ✅ `_process_skill_attachments()` | ❌ Missing | **MISSING** |
| **Image handling (has_images flag)** | ✅ | ❌ Missing | **MISSING** |
| **skill_config.model override** | ✅ | ❌ Uses request.skill_model | **PARTIAL** |
| **skill_config.agent_type (code_agent)** | ✅ | ❌ Missing | **MISSING** |
| **return_message_parts mode** | ✅ | ❌ Missing | **MISSING** |
| **Stored plan extraction** | ✅ `_extract_plan_from_skill()` | ❌ Not handled | **MISSING** |
| **Wrapper DAG execution** | ✅ `_execute_agentic()` | ❌ Missing | **MISSING** |

**Critical Missing:**
- `_process_skill_attachments()` - extracts images/text from skill_config.content
- `_extract_plan_from_skill()` - checks for stored plan in agentic step
- Wrapper DAG path for skills with stored plans

### 2. InteractiveExecutor vs AgentExecutor (interactive path)

| Feature | Original | InteractiveExecutor | Status |
|---------|----------|---------------------|--------|
| Tool loading | ✅ | ✅ | Complete |
| DSPy ReAct execution | ✅ | ✅ | Complete |
| Image download | ✅ | ✅ | Complete |
| Progress events | ✅ | ✅ | Complete |
| **Workspace tools (bash/fs)** | ✅ | ❌ Missing | **MISSING** |
| **Session attachments** | ✅ | ❌ Not processed | **PARTIAL** |

### 3. CoordinatorExecutor vs AgentExecutor._execute_with_coordinator()

| Feature | Original | CoordinatorExecutor | Status |
|---------|----------|---------------------|--------|
| Plan generation | ✅ | ✅ | Complete |
| Plan approval | ✅ | ✅ | Complete |
| LangGraph execution | ✅ | ✅ | Complete |
| Event streaming | ✅ | ✅ | Complete |
| TokenAccumulator | ✅ | ✅ (fixed) | Complete |
| **Knowledge base injection** | ✅ | ✅ | Complete |

### 4. WorkflowOrchestrator vs StepExecutorService.execute_steps()

| Feature | Original | WorkflowOrchestrator | Status |
|---------|----------|----------------------|--------|
| DAG traversal | ✅ | ✅ | Complete |
| Condition evaluation (simpleeval) | ✅ | ✅ | Complete |
| Retry with backoff (tenacity) | ✅ | ✅ | Complete |
| Parallel execution | ✅ | ✅ | Complete |
| Step output routing | ✅ | ✅ | Complete |
| Error config (continue_on_error) | ✅ | ✅ | Complete |
| **Loop execution (for_each/while/until)** | ✅ (180 lines) | ❌ Missing | **MISSING** |
| Disabled step skipping | ✅ | ✅ | Complete |

**Critical Missing:**
- Loop execution (`_execute_step_with_loop()`) - 180 lines of logic for:
  - `for_each` loops over items
  - `while` loops with condition
  - `until` loops with condition
  - Loop variable injection (`__loop_index__`, `__loop_iteration__`)

### 5. StepHandlerRouter vs StepExecutorService step handlers

| Step Type | Original | StepHandlerRouter | Status |
|-----------|----------|-------------------|--------|
| inline | ✅ | ✅ | Complete |
| skill | ✅ | ✅ | Complete |
| read | ✅ | ✅ | Complete |
| write | ✅ | ✅ | Complete |
| tool | ✅ | ✅ | Complete |
| agentic | ✅ | ✅ | Complete |

---

## Proposed Clean Module Structure

```
services/execution/
├── __init__.py                 # Public exports
├── router.py                   # ExecutionRouter - single entry point
│
├── executors/                  # Mode-specific executors
│   ├── __init__.py
│   ├── interactive.py          # InteractiveExecutor
│   ├── agentic.py              # AgenticExecutor
│   └── coordinator.py          # CoordinatorExecutor
│
├── workflow/                   # DAG workflow execution
│   ├── __init__.py
│   ├── orchestrator.py         # WorkflowOrchestrator (DAG traversal)
│   ├── loop.py                 # LoopExecutor (for_each/while/until)
│   ├── condition.py            # ConditionEvaluator (simpleeval)
│   ├── retry.py                # RetryHandler (tenacity)
│   ├── types.py                # WorkflowStep, StepProgress, StepError
│   └── handlers/               # Step type handlers
│       ├── __init__.py
│       ├── router.py           # StepHandlerRouter
│       ├── inline.py           # InlineStepHandler (optional split)
│       ├── skill.py            # SkillStepHandler (optional split)
│       ├── read.py             # ReadStepHandler (optional split)
│       ├── write.py            # WriteStepHandler (optional split)
│       ├── tool.py             # ToolStepHandler (optional split)
│       └── agentic.py          # AgenticStepHandler (optional split)
│
├── shared/                     # Shared utilities (Phase 1)
│   ├── __init__.py
│   ├── output_pipeline.py      # OutputPipeline (extraction + coercion + write)
│   ├── human_skill_handler.py  # HumanSkillHandler
│   ├── template_resolver.py    # PromptTemplateResolver
│   └── attachment_processor.py # NEW: AttachmentProcessor (images, files)
│
├── events.py                   # Execution events (keep at top level)
│
└── legacy/                     # Files to deprecate (Phase 3)
    ├── config.py
    ├── interrupt_handler.py
    ├── plan_step_executor.py   # Move to workflow/handlers/
    ├── replan_handler.py
    ├── state.py
    └── state_machine.py
```

**Benefits:**
1. Clear separation: executors/ vs workflow/ vs shared/
2. Single entry point via router.py
3. Legacy files isolated for deprecation
4. Each module is self-contained
5. Easy to test in isolation

---

## Phase 3 Integration Plan

### Step 3.1: Add Missing Functionality

1. **Add loop execution to WorkflowOrchestrator**
   - Create `workflow/loop.py` with `LoopExecutor` class
   - Support for_each, while, until loops
   - Loop variable injection

2. **Add attachment processing to AgenticExecutor**
   - Create `shared/attachment_processor.py`
   - Extract images/text from skill_config.content
   - Pass has_images flag to AgentConfig

3. **Add stored plan handling to AgenticExecutor**
   - Check for stored plan in agentic_config
   - Delegate to WorkflowOrchestrator for wrapper DAG

4. **Add workspace tools to InteractiveExecutor**
   - Create bash/filesystem tools when workspace_path provided

### Step 3.2: Wire Up ExecutionRouter

Update ExecutionRouter to properly convert legacy contexts:

```python
# router.py
class ExecutionRouter:
    @classmethod
    def from_execution_context(cls, ctx: ExecutionContext) -> ExecutionRequest:
        """Convert legacy ExecutionContext to typed request."""
        if ctx.use_coordinator:
            return CoordinatorRequest(...)
        elif ctx.is_interactive:
            return InteractiveRequest(...)
        elif ctx.skill:
            return SkillRequest(...)
        raise ValueError("Unknown execution mode")
```

### Step 3.3: Create Thin Wrappers

Make AgentExecutor and SkillExecutorService delegate to ExecutionRouter:

```python
# agents/executor.py
class AgentExecutor:
    def __init__(self, ...):
        self._router = ExecutionRouter(...)

    async def execute_task(self, context: ExecutionContext):
        request = ExecutionRouter.from_execution_context(context)
        if isinstance(request, InteractiveRequest):
            async for progress in self._router.execute_interactive(request):
                yield progress
        elif isinstance(request, CoordinatorRequest):
            async for progress in self._router.execute_coordinator(request):
                yield progress
        # ... etc
```

### Step 3.4: Migration Path

1. **Phase 3.4a**: Add `use_new_router=False` flag to AgentExecutor
2. **Phase 3.4b**: Test with `use_new_router=True` in staging
3. **Phase 3.4c**: Default to `use_new_router=True`
4. **Phase 3.4d**: Remove old code paths, deprecate AgentExecutor

### Step 3.5: File Movement

```bash
# Move files to new structure
mkdir -p services/execution/executors
mkdir -p services/execution/shared
mkdir -p services/execution/legacy

# Move executors
mv services/execution/interactive_executor.py services/execution/executors/interactive.py
mv services/execution/agentic_executor.py services/execution/executors/agentic.py
mv services/execution/coordinator_executor.py services/execution/executors/coordinator.py

# Move shared
mv services/execution/output_pipeline.py services/execution/shared/
mv services/execution/human_skill_handler.py services/execution/shared/
mv services/execution/prompt_template_resolver.py services/execution/shared/template_resolver.py

# Move legacy
mv services/execution/config.py services/execution/legacy/
mv services/execution/interrupt_handler.py services/execution/legacy/
mv services/execution/plan_step_executor.py services/execution/legacy/
mv services/execution/replan_handler.py services/execution/legacy/
mv services/execution/state.py services/execution/legacy/
mv services/execution/state_machine.py services/execution/legacy/
```

---

## Priority Order

1. **HIGH: Add loop execution** - Missing core functionality
2. **HIGH: Add attachment processing** - Missing for skill execution
3. **MEDIUM: Add stored plan handling** - Less common path
4. **MEDIUM: Reorganize folder structure** - Cleaner but not blocking
5. **LOW: Add workspace tools** - Interactive-only feature
6. **LOW: Thin wrapper migration** - Can wait for stability

---

## Verification Checklist

After each change:
- [ ] Run `npx pyright services/execution/`
- [ ] Run `pytest emery-agents/tests/services/execution/`
- [ ] Manual test: Chat direct command (interactive)
- [ ] Manual test: Skill execution (agentic)
- [ ] Manual test: Workflow execution with loops
- [ ] Manual test: Coordinator mode
- [ ] Manual test: Human skill pause/resume
