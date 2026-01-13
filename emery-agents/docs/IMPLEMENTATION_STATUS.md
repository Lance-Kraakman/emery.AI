# Implementation Status: Current State vs Target

> Mapping of current emery-agents implementation to the roadmap phases, plus future work on autonomous plan generation.

---

## Phase Implementation Status

### Legend
- ✅ **IMPLEMENTED** - Fully exists
- ⚠️ **PARTIAL** - Some components exist
- ❌ **MISSING** - Needs to be built

---

## Phase 0: Foundation Layer

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Workspace Abstraction** | ⚠️ PARTIAL | `SessionManager` manages agent memory per session | No file-based workspace, no plan directory structure |
| **FileStorage Service** | ❌ MISSING | File attachments via proto (`FileAttachment`) | No persistent file storage abstraction |
| **ExecutionContext** | ✅ IMPLEMENTED | `ExecutionContext` dataclass in `agent_executor.py` | Complete |
| **Context Infrastructure** | ✅ IMPLEMENTED | `ContextMapping`, `ContextResolver`, `ContextSyncService` | Complete |

### What Exists
```python
# services/agent_executor.py (lines 17-81)
@dataclass
class ExecutionContext:
    mode: ExecutionMode  # SKILL / INSTRUCTION / CAPABILITY
    task: str
    available_tools: List[str]
    agent_id: int
    organization_id: int
    skill_name: Optional[str]
    skill: Optional[SkillConfig]
    available_skills: Dict[int, SkillConfig]
    images: List[Image.Image]
    attachments: List[FileAttachment]
    skill_inputs: Dict[str, Any]

# models/context_mapping.py - Context table infrastructure
class ContextMapping:
    target_type: ContextMappingTargetType  # agent, skill, skill_step
    access_mode: ContextMappingAccessMode  # read, write, readwrite
    sync_mode: ContextMappingSyncMode      # on_access, on_save, realtime

# services/context_resolver.py - Hierarchy resolution
class ContextResolver:
    async def resolve_context(org_id, agent_id, skill_id, step_id) -> ResolvedContext
    # Merges mappings: agent → skill → step (later overrides earlier)
```

### What's Missing
```python
# NEED: Workspace abstraction
class Workspace:
    base_dir: Path           # ~/.emery/ or project-level
    plans_dir: Path          # For plan persistence
    results_dir: Path        # For context offloading
    session_id: str

# NEED: FileStorage service
class FileStorage:
    def write(path, content, metadata) -> Path
    def read(path) -> str
    def list_versions(prefix) -> List[Path]
```

---

## Phase 1: Plan Persistence ✅ COMPLETE

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Plan Data Structure** | ✅ IMPLEMENTED | `Plan`, `PlanStep` in `models/plan.py` | Complete |
| **Plan Persistence** | ✅ IMPLEMENTED | `agents.plan` JSONB field + `PlanService` | Complete |
| **Plan Versioning** | ⚠️ PARTIAL | `version` field in Plan, no file-based | DB-level versioning only |
| **Session Resume** | ⚠️ PARTIAL | `SessionManager.restore_agent_from_history()` | Restores chat memory, not plans |

### What Exists (NEW)
```python
# models/plan.py - Plan data structures
@dataclass
class PlanStep:
    step_id: str
    description: str
    tool_call: Optional[str]
    parameters: Optional[Dict[str, Any]]
    context_tables: List[str]
    status: str  # pending, in_progress, completed, failed
    result: Optional[str]
    error: Optional[str]

@dataclass
class Plan:
    id: str
    goal: str
    basic_instructions: str
    steps: List[PlanStep]
    status: str  # draft, approved, executing, completed, failed
    version: int
    generated_at: Optional[datetime]
    approved_at: Optional[datetime]

    def to_dict(self) -> Dict[str, Any]: ...
    @classmethod
    def from_dict(cls, data) -> "Plan": ...

# services/plan_service.py - Plan CRUD operations
class PlanService:
    async def generate_plan(instructions, context_tables, tools, goal) -> Plan
    async def approve_plan(plan: Plan) -> Plan
    async def update_step_status(plan, step_id, status, result?, error?) -> Plan

# Schema: agents.plan JSONB field for storage
# src/ddd/infrastructure/db/schema.ts
plan: jsonb("plan").$type<AgentPlan>()
planGeneratedAt: timestamp("plan_generated_at")
planApprovedAt: timestamp("plan_approved_at")
```

---

## Phase 2A: Two-Phase Execution ✅ COMPLETE

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Execution Modes** | ✅ IMPLEMENTED | 6 modes: agentic, agent, operation, tool, write, read | Complete |
| **Mode-Based Routing** | ✅ IMPLEMENTED | `SkillExecutorService` routes by `execution_type` | Complete |
| **Planning vs Execution Tools** | ✅ IMPLEMENTED | `ToolMode`, `filter_tools_for_mode()` | Complete |
| **Mode Transitions** | ✅ IMPLEMENTED | `ExecutionCoordinator` with approval gate | Complete |

### What Exists (NEW)
```python
# tools/tool_modes.py - Tool classification
class ToolMode(Enum):
    PLANNING = "planning"      # Read-only tools
    EXECUTION = "execution"    # All tools

READ_ONLY_TOOLS = {"row_crud:list", "row_crud:read", "web_search", ...}
MUTATION_ONLY_TOOLS = {"row_crud:create", "row_crud:update", "tool_executor", ...}

def filter_tools_for_mode(tools: List[Tool], mode: ToolMode) -> List[Tool]: ...
def is_read_only_tool(tool: Tool) -> bool: ...

# services/execution_coordinator.py - Phase orchestration
class ExecutionCoordinator:
    async def create_plan(goal, instructions, tools, context_tables) -> AsyncIterator[Event]
        # Phase 1: Planning (read-only tools)
        # Yields: PlanCreatedEvent

    async def approve_plan(plan_id: str) -> Plan
        # Phase 2: Approval gate

    async def execute_plan(plan_id: str, tools: List) -> AsyncIterator[Event]
        # Phase 3: Execution (full tools)
        # Yields: StepStartedEvent, StepCompletedEvent, ExecutionCompletedEvent

# prompts/base/mode_planning.j2 - Planning mode instructions
# prompts/base/mode_execution.j2 - Execution mode instructions
```

---

## Phase 2B: Context Offloading ✅ COMPLETE

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Result Storage** | ✅ IMPLEMENTED | `ResultStorageService` in-memory cache | Complete |
| **Result Summarization** | ✅ IMPLEMENTED | `_generate_summary()` for large results | Complete |
| **Context Threshold** | ✅ IMPLEMENTED | CHAR_THRESHOLD=2000, RECORD_THRESHOLD=50 | Complete |
| **File References** | ⚠️ PARTIAL | In-memory IDs, no file paths | Future: /tmp fallback |

### What Exists (NEW)
```python
# services/result_storage.py - Context offloading
class ResultStorageService:
    CHAR_THRESHOLD = 2000      # Offload if > 2000 chars
    RECORD_THRESHOLD = 50      # Offload if > 50 list items

    def should_offload(result: str) -> bool
    async def store(result: str, metadata?) -> StoredResult
    async def retrieve(result_id: str) -> str
    def cleanup() -> None

@dataclass
class StoredResult:
    id: str
    summary: str
    record_count: Optional[int]
    char_count: int
```

---

## Phase 3: Task Ledger ✅ COMPLETE (Runtime)

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Task Entity** | ✅ IMPLEMENTED | `Task` in `entities/task.py` | Complete |
| **Task Lifecycle** | ✅ IMPLEMENTED | start(), complete(), fail(), cancel() | Complete |
| **Step Tracking** | ✅ IMPLEMENTED | `TaskLedger`, `StepState` in `models/task_ledger.py` | Complete |
| **Dependency Tracking** | ✅ IMPLEMENTED | `step_outputs` routing, parallel_group | Complete |
| **Ledger Persistence** | ⚠️ PARTIAL | In-memory runtime, optional JSON export | No DB persistence (by design) |

### What Exists (NEW)
```python
# models/task_ledger.py - Runtime execution tracking
@dataclass
class StepState:
    step_id: str
    step_name: str
    status: str  # pending, in_progress, completed, failed, skipped
    result: Optional[str]
    error: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

@dataclass
class TaskLedger:
    task_id: str
    goal: str
    steps: Dict[str, StepState]
    events: List[LedgerEvent]

    # Step lifecycle
    def add_step(step_id, step_name): ...
    def start_step(step_id): ...
    def complete_step(step_id, result?): ...
    def fail_step(step_id, error): ...

    # Query methods for evaluator
    @property
    def completed_steps -> int
    @property
    def is_complete -> bool
    @property
    def has_failures -> bool
    def get_step_results() -> Dict[str, str]

    # Serialization for evaluator
    def to_dict() -> Dict[str, Any]
    def to_json_summary() -> str

# Wired into ExecutionCoordinator
# - Ledger created when plan created
# - Updated on step start/complete/fail
# - Passed to evaluator for assessment
```

---

## Phase 4A: Magentic Orchestration ✅ COMPLETE

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Manager Agent** | ✅ IMPLEMENTED | `chat_planner_agent.py` | Complete |
| **Specialist Agents** | ✅ IMPLEMENTED | skill_builder, schema_builder, document_builder, table_builder | Complete |
| **Agent Delegation** | ✅ IMPLEMENTED | `StatefulManagedAgent`, `InterruptAwareAgent` | Complete |
| **HITL Interrupts** | ✅ IMPLEMENTED | `HITLMixin` with approval detection | Complete |
| **Evaluation Loop** | ✅ IMPLEMENTED | `_evaluate_progress()` in ExecutionCoordinator | Complete |
| **Dynamic Replanning** | ⚠️ PARTIAL | `ReplanTriggeredEvent` emitted, actual replan TODO | Event only |

### What Exists (NEW)
```python
# agents/evaluator_agent.py - Progress evaluation
def create_evaluator_agent(model: str) -> ToolCallingAgent:
    """Creates agent for evaluating task progress."""
    # No tools - evaluation only
    # Returns JSON: goal_achieved, blocking_issues, should_continue, needs_replan

def create_evaluator_factory(model: str) -> Callable:
    """Factory for ExecutionCoordinator."""

# services/execution_coordinator.py - Evaluation integration
@dataclass
class EvaluationResult:
    goal_achieved: bool
    blocking_issues: bool
    should_continue: bool
    needs_replan: bool
    reason: str

class ExecutionCoordinator:
    def __init__(
        evaluator_factory: Optional[Callable] = None,
        evaluate_after_steps: int = 1,
        max_replans: int = 3,
    ): ...

    async def execute_plan(plan_id, tools) -> AsyncIterator[Event]:
        for step in plan.steps:
            # Execute step...

            # Evaluate periodically
            if steps_since_eval >= evaluate_after_steps:
                evaluation = await self._evaluate_progress()

                if evaluation.goal_achieved:
                    yield GoalAchievedEvent(...)
                    break

                if evaluation.needs_replan:
                    yield ReplanTriggeredEvent(...)

    async def _evaluate_progress() -> EvaluationResult: ...

# New events
- EvaluationCompletedEvent
- GoalAchievedEvent
- ReplanTriggeredEvent
- ExecutionBlockedEvent

# prompts/base/mode_evaluation.j2 - Evaluation prompt template
```

---

## Phase 4B: Progressive Disclosure

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Template Composition** | ✅ IMPLEMENTED | `build_agent_instructions()` in prompts/__init__.py | Complete |
| **Context-Aware Loading** | ✅ IMPLEMENTED | `context_type` param (autonomous vs interactive) | Complete |
| **Managed Agent Discovery** | ✅ IMPLEMENTED | `managed_agents` list passed to templates | Complete |
| **Meta/Full Split** | ❌ MISSING | All templates fully loaded | Need lightweight metadata layer |
| **Lazy Loading** | ❌ MISSING | None | Need on-demand template loading |

### What's Missing
```python
# NEED: Template split
# prompts/agents/skill_builder.meta.j2  (~100 tokens)
# prompts/agents/skill_builder.full.j2  (full instructions)

# NEED: SkillRegistry with lazy loading
class SkillRegistry:
    def load_metadata() -> List[SkillMetadata]  # Lightweight
    def load_full(skill_name) -> Skill  # On-demand
    def match_skill(task) -> Optional[str]  # Best match
```

---

## Phase 5: Parallel Execution

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Parallel Step Execution** | ✅ IMPLEMENTED | `parallel_group` in StepExecutor | Complete |
| **Async Gather** | ✅ IMPLEMENTED | `asyncio.gather()` for parallel steps | Complete |
| **DAG Scheduler** | ⚠️ PARTIAL | Step routing via `step_outputs` | Need dependency-based scheduling |
| **Result Aggregation** | ❌ MISSING | None | Need synthesis of parallel results |

---

## Summary Matrix

| Phase | Component | Status | Priority |
|-------|-----------|--------|----------|
| **0** | Workspace | ⚠️ PARTIAL | P2 |
| **0** | FileStorage | ❌ MISSING | P2 |
| **0** | ExecutionContext | ✅ COMPLETE | - |
| **0** | Context Infrastructure | ✅ COMPLETE | - |
| **1** | Plan Structure | ✅ COMPLETE | - |
| **1** | Plan Persistence | ✅ COMPLETE | - |
| **1** | Session Resume | ⚠️ PARTIAL | P2 |
| **2A** | Execution Modes | ✅ COMPLETE | - |
| **2A** | Tool Filtering | ✅ COMPLETE | - |
| **2A** | Mode Transitions | ✅ COMPLETE | - |
| **2B** | Result Storage | ✅ COMPLETE | - |
| **2B** | Summarization | ✅ COMPLETE | - |
| **3** | Task Entity | ✅ COMPLETE | - |
| **3** | Step Tracking | ✅ COMPLETE | - |
| **3** | Ledger (Runtime) | ✅ COMPLETE | - |
| **4A** | Manager/Specialist | ✅ COMPLETE | - |
| **4A** | HITL Interrupts | ✅ COMPLETE | - |
| **4A** | Evaluation Loop | ✅ COMPLETE | - |
| **4A** | Dynamic Replanning | ⚠️ PARTIAL | P1 |
| **4B** | Template Composition | ✅ COMPLETE | - |
| **4B** | Meta/Full Split | ❌ MISSING | P3 |
| **5** | Parallel Execution | ✅ COMPLETE | - |
| **5** | Result Aggregation | ❌ MISSING | P3 |

---

## Key Files Reference

| File | Phase | Purpose |
|------|-------|---------|
| `services/session_manager.py` | 0, 1 | Session state, memory restoration |
| `services/agent_executor.py` | 0, 2A | ExecutionContext, task routing |
| `services/skill_executor.py` | 2A | Execution type routing (6 modes) |
| `services/step_executor.py` | 3, 5 | DAG execution, parallel steps |
| `services/execution_coordinator.py` | 1, 2A, 3, 4A | **NEW** Plan → approval → execute flow |
| `services/plan_service.py` | 1 | **NEW** Plan CRUD operations |
| `services/result_storage.py` | 2B | **NEW** Context offloading |
| `models/plan.py` | 1 | **NEW** Plan, PlanStep dataclasses |
| `models/task_ledger.py` | 3 | **NEW** TaskLedger runtime tracking |
| `models/context_mapping.py` | 0 | Context table infrastructure |
| `tools/tool_modes.py` | 2A | **NEW** Tool classification |
| `agents/evaluator_agent.py` | 4A | **NEW** Progress evaluation |
| `agents/_hitl_mixin.py` | 4A | HITL interrupts and approval |
| `agents/chat_planner_agent.py` | 4A | Manager/specialist pattern |
| `prompts/__init__.py` | 4B | Template composition |
| `prompts/base/mode_planning.j2` | 2A | **NEW** Planning mode prompt |
| `prompts/base/mode_execution.j2` | 2A | **NEW** Execution mode prompt |
| `prompts/base/mode_evaluation.j2` | 4A | **NEW** Evaluation prompt |

---

## Remaining Work

### High Priority (P1)
1. **Dynamic Replanning** - Implement actual plan modification when `needs_replan=true`
2. **Wire ExecutionCoordinator into AgentExecutor** - Currently standalone

### Medium Priority (P2)
1. **Workspace Abstraction** - File-based workspace for plan persistence
2. **Session Resume with Plans** - Restore plans alongside chat memory
3. **Context Mapping Wiring** - Pass resolved context to agents during execution

### Low Priority (P3)
1. **Meta/Full Template Split** - Reduce baseline token usage
2. **Result Aggregation** - Synthesize parallel execution results
3. **Lazy Loading** - On-demand template loading

---

## Recommended Next Steps

```
1. Wire ExecutionCoordinator into AgentExecutor
   - Add as execution path option
   - Test with real agent tasks

2. Implement Dynamic Replanning
   - Create recovery plan on failure
   - Re-route remaining steps

3. Integrate Context Mappings
   - Pass resolved tables to agents
   - Respect read/write permissions
```
