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

## Phase 1: Plan Persistence

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Plan Data Structure** | ⚠️ PARTIAL | `Step` in `step_executor.py` for DAG steps | No `Plan` object for multi-step planning |
| **Plan Persistence** | ❌ MISSING | Plans live in memory only | No file-based persistence |
| **Plan Versioning** | ❌ MISSING | None | Need v1, v2, ... versioning |
| **Session Resume** | ⚠️ PARTIAL | `SessionManager.restore_agent_from_history()` | Restores chat memory, not plans |

### What Exists
```python
# services/step_executor.py - Step structure (for DAG execution)
@dataclass
class Step:
    id: str
    name: str
    instruction: str
    skill_id: Optional[int]
    tools: List[str]
    inputs: Dict[str, InputDefinition]
    outputs: Dict[str, OutputDefinition]
    condition: Optional[str]
    error_config: Optional[ErrorConfig]
    retry_config: Optional[RetryConfig]
    loop_config: Optional[LoopConfig]
    step_outputs: List[StepOutput]  # Routing rules
    parallel_group: Optional[str]

# services/session_manager.py - Session restoration
def restore_agent_from_history(agent, conversation_history):
    # Converts DB messages → smolagents memory steps
    # TaskStep for user messages, ActionStep for assistant
```

### What's Missing
```python
# NEED: Plan object (distinct from Step)
@dataclass
class Plan:
    id: str
    goal: str
    steps: List[PlanStep]
    version: int
    status: str  # draft, pending_approval, approved, executing, completed
    created_at: datetime
    approved_at: Optional[datetime]

    def to_markdown(self) -> str: ...

# NEED: PlanRepository for persistence
class PlanRepository:
    def save(plan: Plan) -> Path
    def load(plan_id, version=None) -> Plan
    def list_plans() -> List[str]
```

---

## Phase 2A: Two-Phase Execution

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Execution Modes** | ✅ IMPLEMENTED | 6 modes: agentic, agent, operation, tool, write, read | Complete |
| **Mode-Based Routing** | ✅ IMPLEMENTED | `SkillExecutorService` routes by `execution_type` | Complete |
| **Planning vs Execution Tools** | ❌ MISSING | All tools available in all modes | Need read-only tool set for planning |
| **Mode Transitions** | ❌ MISSING | No explicit planning → execution flow | Need approval gate between phases |

### What Exists
```python
# services/skill_executor.py - Execution type routing
async def execute_skill(skill_config, runtime_inputs, ...):
    if self._is_tool_skill(skill_config):
        return self._execute_tool(...)
    elif self._is_write_skill(skill_config):
        return self._execute_write(...)
    elif self._is_read_skill(skill_config):
        return self._execute_read(...)
    elif self._is_operation_skill(skill_config):
        return self._execute_operation(...)
    elif self._is_agent_skill(skill_config):
        return self._execute_steps(...)  # DAG execution
    else:
        return self._execute_agent(...)  # Agentic (LLM)
```

### What's Missing
```python
# NEED: Tool access modes
class ToolMode(Enum):
    PLANNING = "planning"      # Read-only tools
    EXECUTION = "execution"    # All tools

READ_ONLY_TOOLS = {"database_crud:list", "database_crud:read", ...}
MUTATION_TOOLS = {"database_crud:create", "tool_executor", ...}

def filter_tools_by_mode(tools, mode: ToolMode) -> List[Tool]: ...

# NEED: ExecutionCoordinator for phase transitions
class ExecutionCoordinator:
    async def run(task, tools):
        # Phase 1: Planning (read-only)
        plan = await planner.run(task, mode=PLANNING)

        # Phase 2: Approval (HITL)
        approved = await await_approval(plan)

        # Phase 3: Execution (full access)
        return await executor.run(plan, mode=EXECUTION)
```

---

## Phase 2B: Context Offloading

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Result Storage** | ⚠️ PARTIAL | `step_context` dict in StepExecutor | In-memory only |
| **Result Summarization** | ❌ MISSING | None | Need auto-summarization for large results |
| **Context Threshold** | ❌ MISSING | None | Need token/size limits for offloading |
| **File References** | ❌ MISSING | None | Need "stored at: /path" references |

### What Exists
```python
# services/step_executor.py - Step context (in-memory)
step_context: Dict[str, Any] = {}  # Accumulates across steps

# _flatten_json helper for nested results
def _flatten_json(data, parent_key=''):
    # {"data": {"id": 1}} → {"data_id": 1}
```

### What's Missing
```python
# NEED: ResultStorage with offloading
class ResultStorage:
    THRESHOLD_CHARS = 2000

    def should_offload(result: str) -> bool
    def offload(result, context) -> StoredResult
    def retrieve(result_id) -> str

@dataclass
class StoredResult:
    id: str
    summary: str
    path: str
    size: int
    record_count: Optional[int]

    def to_context_string(self) -> str:
        return f"{self.summary}\nFull data: {self.path}"
```

---

## Phase 3: Task Ledger

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Task Entity** | ✅ IMPLEMENTED | `Task` in `entities/task.py` | Complete |
| **Task Lifecycle** | ✅ IMPLEMENTED | start(), complete(), fail(), cancel() | Complete |
| **Step Tracking** | ✅ IMPLEMENTED | `StepProgress` in step_executor.py | Complete |
| **Dependency Tracking** | ✅ IMPLEMENTED | `step_outputs` routing, parallel_group | Complete |
| **Ledger Persistence** | ⚠️ PARTIAL | Task saved to DB, steps in-memory | Step progress not persisted |

### What Exists
```python
# entities/task.py - Full task lifecycle
class Task:
    id: TaskId
    _status: str  # pending, in_progress, completed, failed, cancelled
    _result: Optional[str]
    _error: Optional[str]
    _started_at, _completed_at: Optional[datetime]

    def start(self): ...
    def complete(self, result): ...
    def fail(self, error): ...
    def cancel(self, reason): ...

# services/step_executor.py - Step execution tracking
@dataclass
class StepProgress:
    step_id: str
    step_name: str
    status: str  # pending, in_progress, completed, failed, skipped
    result: Optional[str]
    error: Optional[str]
    retries: int
```

### What's Missing
```python
# NEED: TaskLedger with dependency graph
@dataclass
class TaskLedger:
    id: str
    goal: str
    tasks: Dict[str, Task]  # With dependencies

    def add_task(task: Task): ...
    def next_ready_tasks() -> List[Task]
    def is_complete() -> bool
    def is_blocked() -> bool
    def to_markdown() -> str
    def to_json() -> str

# NEED: Ledger persistence
class LedgerRepository:
    def save(ledger) -> Path  # JSON + markdown
    def load(ledger_id) -> TaskLedger
```

---

## Phase 4A: Magentic Orchestration

| Component | Status | Current Implementation | Gap |
|-----------|--------|------------------------|-----|
| **Manager Agent** | ✅ IMPLEMENTED | `chat_planner_agent.py` | Complete |
| **Specialist Agents** | ✅ IMPLEMENTED | skill_builder, schema_builder, document_builder, table_builder | Complete |
| **Agent Delegation** | ✅ IMPLEMENTED | `StatefulManagedAgent`, `InterruptAwareAgent` | Complete |
| **HITL Interrupts** | ✅ IMPLEMENTED | `HITLMixin` with approval detection | Complete |
| **Evaluation Loop** | ❌ MISSING | None | Need manager evaluation after each step |
| **Dynamic Replanning** | ❌ MISSING | None | Need replan on failure |

### What Exists
```python
# agents/chat_planner_agent.py - Manager with specialists
def create_chat_planner_agent(tools, model, ...):
    managed_agents = [
        create_skill_builder_agent(...),
        create_document_builder_agent(...),
        # ...
    ]
    return InterruptAwareToolCallingAgent(
        tools=tools,
        managed_agents=managed_agents,
        ...
    )

# agents/_hitl_mixin.py - Interrupt handling
class HITLMixin:
    _interrupted_agent_name: Optional[str]

    def _is_approval_response(task: str) -> bool:
        # Detects "yes", "proceed", "approve", etc.

    def _handle_hitl_resume(task, stream=False):
        # Routes approval to interrupted agent
```

### What's Missing
```python
# NEED: MagenticOrchestrator with evaluation loop
class MagenticOrchestrator:
    async def run(goal: str, tools: List[Tool]) -> str:
        ledger = await create_initial_ledger(goal)

        while not ledger.is_complete():
            if ledger.is_blocked():
                await handle_blocked(ledger)  # Replan

            for task in ledger.next_ready_tasks():
                await execute_task(ledger, task)

            # Evaluation: should we continue?
            should_continue = await evaluate_progress(ledger, goal)
            if not should_continue:
                break

        return synthesize_results(ledger)
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

### What Exists
```python
# prompts/__init__.py - Template composition
def build_agent_instructions(
    tools: List[Tool],
    agent_type: str,  # "chat_planner", "skill_builder", etc.
    context_type: str,  # "autonomous" or "interactive"
    managed_agents: List[str],
    session_attachments: List[FileAttachment],
) -> str:
    # Composes: base rules + agent-specific + tool docs + managed agents
```

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

### What Exists
```python
# services/step_executor.py - Parallel execution
async def execute_steps(...):
    # Group steps by parallel_group
    parallel_batch = [s for s in ready if s.parallel_group == current_group]

    # Execute in parallel
    results = await asyncio.gather(*[
        self._execute_step(step, ...)
        for step in parallel_batch
    ])
```

---

## Summary Matrix

| Phase | Component | Status | Priority |
|-------|-----------|--------|----------|
| **0** | Workspace | ⚠️ PARTIAL | P0 |
| **0** | FileStorage | ❌ MISSING | P0 |
| **0** | ExecutionContext | ✅ COMPLETE | - |
| **1** | Plan Structure | ⚠️ PARTIAL | P1 |
| **1** | Plan Persistence | ❌ MISSING | P1 |
| **1** | Session Resume | ⚠️ PARTIAL | P2 |
| **2A** | Execution Modes | ✅ COMPLETE | - |
| **2A** | Tool Filtering | ❌ MISSING | P1 |
| **2A** | Mode Transitions | ❌ MISSING | P1 |
| **2B** | Result Storage | ⚠️ PARTIAL | P2 |
| **2B** | Summarization | ❌ MISSING | P2 |
| **3** | Task Entity | ✅ COMPLETE | - |
| **3** | Step Tracking | ✅ COMPLETE | - |
| **3** | Ledger Persistence | ⚠️ PARTIAL | P2 |
| **4A** | Manager/Specialist | ✅ COMPLETE | - |
| **4A** | HITL Interrupts | ✅ COMPLETE | - |
| **4A** | Evaluation Loop | ❌ MISSING | P1 |
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
| `entities/task.py` | 3 | Task lifecycle management |
| `agents/_hitl_mixin.py` | 4A | HITL interrupts and approval |
| `agents/chat_planner_agent.py` | 4A | Manager/specialist pattern |
| `prompts/__init__.py` | 4B | Template composition |

---

## Recommended Build Order

Based on what exists vs what's missing:

```
1. Phase 0 (FileStorage)     → Foundation for persistence
2. Phase 1 (PlanRepository)  → Enable plan persistence
3. Phase 2A (Tool Filtering) → Enable planning mode
4. Phase 4A (Eval Loop)      → Complete Magentic pattern
5. Phase 2B (Offloading)     → Optimize context usage
6. Phase 4B (Lazy Loading)   → Optimize token usage
7. Phase 3 (Ledger Persist)  → Full auditability
```
