# Implementation Roadmap: Composable Phases

> A phased approach to improving the emery-agents architecture. Each phase is independently valuable and builds on previous phases.

---

## Design Principles

1. **Composable**: Each phase delivers standalone value
2. **Incremental**: No big-bang rewrites; evolve existing patterns
3. **Testable**: Each phase includes evaluation criteria
4. **Backwards Compatible**: Existing agents continue to work

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 0: Foundation Layer (Prerequisites)                              │
│  - Workspace abstraction                                                │
│  - File storage service                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Plan Persistence                                              │
│  - PlanFile class                                                       │
│  - Plan versioning                                                      │
│  - Session resume with plans                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│  PHASE 2A: Two-Phase Execution │  │  PHASE 2B: Context Offloading      │
│  - Tool access modes           │  │  - Large result storage            │
│  - Planning vs execution tools │  │  - Summarization layer             │
│  - Mode transition logic       │  │  - File references in context      │
└────────────────────────────────┘  └────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: Task Ledger                                                   │
│  - TaskLedger data structure                                            │
│  - Ledger persistence                                                   │
│  - Step tracking and status                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│  PHASE 4A: Magentic Orchestr.  │  │  PHASE 4B: Progressive Disclosure  │
│  - Manager agent               │  │  - Meta/full template split        │
│  - Specialist routing          │  │  - Lazy loading                    │
│  - Evaluation loop             │  │  - Skill matching                  │
└────────────────────────────────┘  └────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: Parallel Execution                                            │
│  - Concurrent specialist invocation                                     │
│  - Result aggregation                                                   │
│  - DAG-based task scheduling                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Foundation Layer

**Goal**: Create shared infrastructure that all subsequent phases depend on.

### 0.1 Workspace Abstraction

```python
# src/emery_agents/infrastructure/workspace.py

from pathlib import Path
from dataclasses import dataclass
from typing import Optional
import os

@dataclass
class WorkspaceConfig:
    """Configuration for agent workspace."""
    base_dir: Path
    plans_dir: Path
    results_dir: Path
    session_id: str

    @classmethod
    def from_env(cls, session_id: str) -> "WorkspaceConfig":
        base = Path(os.getenv("EMERY_WORKSPACE_DIR", "/tmp/emery"))
        return cls(
            base_dir=base,
            plans_dir=base / "plans",
            results_dir=base / "results",
            session_id=session_id,
        )

    def ensure_dirs(self) -> None:
        """Create workspace directories if they don't exist."""
        self.plans_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)


class Workspace:
    """Manages file-based state for agent sessions."""

    def __init__(self, config: WorkspaceConfig):
        self.config = config
        self.config.ensure_dirs()

    def plan_path(self, plan_id: str, version: int = 1) -> Path:
        return self.config.plans_dir / f"{plan_id}_v{version}.md"

    def result_path(self, result_id: str) -> Path:
        return self.config.results_dir / f"{result_id}.json"

    def session_path(self) -> Path:
        return self.config.base_dir / f"session_{self.config.session_id}.json"
```

### 0.2 File Storage Service

```python
# src/emery_agents/infrastructure/file_storage.py

from pathlib import Path
from typing import Optional, Any
import json
from datetime import datetime

class FileStorage:
    """Simple file-based storage with metadata tracking."""

    def __init__(self, workspace: Workspace):
        self.workspace = workspace

    def write(self, path: Path, content: str, metadata: Optional[dict] = None) -> Path:
        """Write content with optional metadata sidecar."""
        path.write_text(content)
        if metadata:
            meta_path = path.with_suffix(path.suffix + ".meta.json")
            meta_path.write_text(json.dumps({
                **metadata,
                "created_at": datetime.utcnow().isoformat(),
                "path": str(path),
            }))
        return path

    def read(self, path: Path) -> str:
        """Read file content."""
        return path.read_text()

    def exists(self, path: Path) -> bool:
        return path.exists()

    def list_versions(self, prefix: str, directory: Path) -> list[Path]:
        """List all versions of a file by prefix."""
        return sorted(directory.glob(f"{prefix}_v*.md"))
```

### Deliverables
- [ ] `WorkspaceConfig` dataclass
- [ ] `Workspace` class with directory management
- [ ] `FileStorage` class with read/write/metadata
- [ ] Unit tests for workspace operations

### Success Criteria
- Workspace directories created on initialization
- Files persist across agent restarts
- Metadata tracked for all stored files

---

## Phase 1: Plan Persistence

**Goal**: Plans survive session boundaries and can be versioned.

**Depends on**: Phase 0

### 1.1 PlanFile Class

```python
# src/emery_agents/planning/plan_file.py

from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
from pathlib import Path
import json

@dataclass
class PlanStep:
    """A single step in a plan."""
    id: str
    description: str
    status: str = "pending"  # pending, in_progress, completed, failed
    result: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

@dataclass
class Plan:
    """A structured plan with steps and metadata."""
    id: str
    goal: str
    steps: List[PlanStep] = field(default_factory=list)
    version: int = 1
    created_at: datetime = field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    status: str = "draft"  # draft, pending_approval, approved, executing, completed

    def to_markdown(self) -> str:
        """Render plan as markdown for persistence and display."""
        lines = [
            f"# Plan: {self.goal}",
            f"",
            f"**ID**: {self.id}",
            f"**Version**: {self.version}",
            f"**Status**: {self.status}",
            f"**Created**: {self.created_at.isoformat()}",
            f"",
            f"## Steps",
            f"",
        ]
        for i, step in enumerate(self.steps, 1):
            status_icon = {"pending": "⬜", "in_progress": "🔄", "completed": "✅", "failed": "❌"}.get(step.status, "⬜")
            lines.append(f"{i}. {status_icon} **{step.description}**")
            if step.result:
                lines.append(f"   - Result: {step.result}")
        return "\n".join(lines)

    @classmethod
    def from_markdown(cls, content: str) -> "Plan":
        """Parse plan from markdown (for loading)."""
        # Implementation: parse the markdown back to Plan object
        ...


class PlanRepository:
    """Repository for plan persistence."""

    def __init__(self, workspace: Workspace, storage: FileStorage):
        self.workspace = workspace
        self.storage = storage

    def save(self, plan: Plan) -> Path:
        """Save plan to disk, incrementing version if exists."""
        existing_versions = self.storage.list_versions(plan.id, self.workspace.config.plans_dir)
        if existing_versions:
            plan.version = len(existing_versions) + 1

        path = self.workspace.plan_path(plan.id, plan.version)
        self.storage.write(path, plan.to_markdown(), metadata={
            "plan_id": plan.id,
            "version": plan.version,
            "status": plan.status,
            "goal": plan.goal,
        })
        return path

    def load(self, plan_id: str, version: Optional[int] = None) -> Optional[Plan]:
        """Load plan from disk. Latest version if not specified."""
        if version:
            path = self.workspace.plan_path(plan_id, version)
        else:
            versions = self.storage.list_versions(plan_id, self.workspace.config.plans_dir)
            if not versions:
                return None
            path = versions[-1]

        if not self.storage.exists(path):
            return None

        content = self.storage.read(path)
        return Plan.from_markdown(content)

    def list_plans(self) -> List[str]:
        """List all plan IDs in workspace."""
        plans = set()
        for path in self.workspace.config.plans_dir.glob("*_v*.md"):
            plan_id = path.stem.rsplit("_v", 1)[0]
            plans.add(plan_id)
        return sorted(plans)
```

### 1.2 Integration with PlanningStep Callback

```python
# Modify: src/emery_agents/agents/_hitl_mixin.py

def create_planning_callback(plan_repo: PlanRepository) -> Callable:
    """Create callback that persists plans on creation."""

    def persist_and_interrupt(memory_step: PlanningStep, agent: CodeAgent):
        # Extract plan from memory step
        plan_content = memory_step.plan  # or however smolagents exposes this

        # Create Plan object
        plan = Plan(
            id=f"plan_{agent.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            goal=extract_goal(memory_step),
            steps=parse_steps(plan_content),
            status="pending_approval",
        )

        # Persist to disk
        path = plan_repo.save(plan)
        logger.info(f"Plan saved to {path}")

        # Store reference for resumption
        agent._current_plan_id = plan.id

        # Interrupt for approval
        agent.interrupt()

    return persist_and_interrupt
```

### 1.3 Session Resume with Plans

```python
# src/emery_agents/services/session_manager.py

class SessionManager:
    """Manages session state including plan resumption."""

    def __init__(self, workspace: Workspace, plan_repo: PlanRepository):
        self.workspace = workspace
        self.plan_repo = plan_repo

    def save_session(self, session_id: str, plan_id: Optional[str], agent_state: dict):
        """Persist session state for resumption."""
        session_data = {
            "session_id": session_id,
            "plan_id": plan_id,
            "agent_state": agent_state,
            "saved_at": datetime.utcnow().isoformat(),
        }
        path = self.workspace.session_path()
        path.write_text(json.dumps(session_data))

    def load_session(self, session_id: str) -> Optional[dict]:
        """Load session state for resumption."""
        path = self.workspace.session_path()
        if not path.exists():
            return None
        return json.loads(path.read_text())

    def resume_with_plan(self, session_id: str) -> Optional[Plan]:
        """Resume session and load associated plan."""
        session = self.load_session(session_id)
        if not session or not session.get("plan_id"):
            return None
        return self.plan_repo.load(session["plan_id"])
```

### Deliverables
- [ ] `Plan` and `PlanStep` dataclasses
- [ ] `PlanRepository` with save/load/versioning
- [ ] Updated planning callback with persistence
- [ ] `SessionManager` for resume support
- [ ] Prompt template: `hitl/resume_with_persisted_plan.j2`

### Success Criteria
- Plans persist to `~/.emery/plans/` as markdown
- Version history maintained (v1, v2, ...)
- Session resume loads previous plan
- Evals: Add `plan-persistence.yaml` scenarios

---

## Phase 2A: Two-Phase Execution Model

**Goal**: Enforce read-only planning phase, full access execution phase.

**Depends on**: Phase 1

### 2A.1 Tool Access Modes

```python
# src/emery_agents/tools/tool_modes.py

from enum import Enum
from typing import List, Set

class ToolMode(Enum):
    PLANNING = "planning"      # Read-only tools
    EXECUTION = "execution"    # All tools

# Categorize tools by their mutation capability
READ_ONLY_TOOLS: Set[str] = {
    "database_crud:list",
    "database_crud:read",
    "table_crud:list",
    "table_crud:read",
    "field_crud:list",
    "field_crud:read",
    "row_crud:list",
    "row_crud:read",
    "document_crud:read",
    "skill_crud:list",
    "skill_crud:read",
    "file_crud:read",
    # External tools (read-only variants)
    "web_search",
    "web_fetch",
}

MUTATION_TOOLS: Set[str] = {
    "database_crud:create",
    "database_crud:update",
    "database_crud:delete",
    "table_crud:create",
    "table_crud:update",
    "table_crud:delete",
    "field_crud:create",
    "field_crud:update",
    "field_crud:delete",
    "row_crud:create",
    "row_crud:update",
    "row_crud:delete",
    "document_crud:create",
    "document_crud:update",
    "document_crud:append_text",
    "skill_crud:create",
    "skill_crud:update",
    # tool_executor can mutate
    "tool_executor",
}

def filter_tools_by_mode(tools: List[Tool], mode: ToolMode) -> List[Tool]:
    """Filter tools based on execution mode."""
    if mode == ToolMode.EXECUTION:
        return tools  # All tools available

    # Planning mode: only read-only tools
    return [t for t in tools if _is_read_only(t)]

def _is_read_only(tool: Tool) -> bool:
    """Check if tool is read-only based on name/description."""
    tool_key = tool.name.lower()
    # Check against known read-only tools
    for ro_tool in READ_ONLY_TOOLS:
        if ro_tool in tool_key:
            return True
    # Check against known mutation tools
    for mut_tool in MUTATION_TOOLS:
        if mut_tool in tool_key:
            return False
    # Default: allow in planning (conservative)
    return True
```

### 2A.2 Mode-Aware Agent Factory

```python
# Modify: src/emery_agents/services/agent_factory.py

class AgentFactory:
    def create_agent(
        self,
        agent_type: str,
        tools: List[Tool],
        mode: ToolMode = ToolMode.EXECUTION,
        **kwargs
    ) -> Agent:
        """Create agent with mode-appropriate tool access."""

        # Filter tools based on mode
        available_tools = filter_tools_by_mode(tools, mode)

        # Build instructions with mode context
        instructions = build_agent_instructions(
            tools=available_tools,
            agent_type=agent_type,
            context_type=mode.value,  # "planning" or "execution"
        )

        if mode == ToolMode.PLANNING:
            # Planning agents use CodeAgent for reasoning
            return CodeAgent(
                tools=available_tools,
                model=kwargs.get("model"),
                instructions=instructions,
                max_steps=kwargs.get("max_steps", 10),
            )
        else:
            # Execution agents use ToolCallingAgent for action
            return ToolCallingAgent(
                tools=available_tools,
                model=kwargs.get("model"),
                instructions=instructions,
                max_steps=kwargs.get("max_steps", 20),
            )
```

### 2A.3 Mode Transition Logic

```python
# src/emery_agents/services/execution_coordinator.py

class ExecutionCoordinator:
    """Coordinates planning → approval → execution flow."""

    def __init__(self, factory: AgentFactory, plan_repo: PlanRepository):
        self.factory = factory
        self.plan_repo = plan_repo

    async def run(self, task: str, tools: List[Tool]) -> str:
        # Phase 1: Planning
        planner = self.factory.create_agent(
            agent_type="planner",
            tools=tools,
            mode=ToolMode.PLANNING,
        )
        plan_result = await planner.run(f"Create a plan for: {task}")
        plan = self._parse_plan(plan_result)
        self.plan_repo.save(plan)

        # Phase 2: Await approval (HITL)
        approved = await self._await_approval(plan)
        if not approved:
            return "Plan rejected by user."

        # Phase 3: Execution
        plan.status = "executing"
        self.plan_repo.save(plan)

        executor = self.factory.create_agent(
            agent_type="executor",
            tools=tools,
            mode=ToolMode.EXECUTION,
        )

        results = []
        for step in plan.steps:
            step.status = "in_progress"
            self.plan_repo.save(plan)

            result = await executor.run(step.description)

            step.status = "completed"
            step.result = result
            self.plan_repo.save(plan)
            results.append(result)

        plan.status = "completed"
        self.plan_repo.save(plan)
        return self._synthesize_results(results)
```

### 2A.4 Prompt Templates for Modes

```jinja2
{# prompts/base/mode_planning.j2 #}
## Planning Mode

You are in PLANNING mode. Your job is to understand and plan, NOT execute.

### Restrictions
- You have access to READ-ONLY tools only
- DO NOT attempt to create, update, or delete resources
- Focus on gathering information and proposing a plan

### Your Task
1. Analyze the user's request
2. Gather context using available read tools
3. Create a structured plan with clear steps
4. Present the plan for user approval

### Output Format
Your plan should include:
- Goal: What we're trying to achieve
- Steps: Numbered list of specific actions
- Verification: How we'll confirm success
```

```jinja2
{# prompts/base/mode_execution.j2 #}
## Execution Mode

The user has APPROVED your plan. Execute it now.

### Your Approved Plan
{{ plan.to_markdown() }}

### Instructions
1. Execute each step in order
2. Use tool_executor for mutations
3. Verify after each step
4. Report any deviations from the plan
5. Do NOT re-plan unless you encounter a blocking error

### On Errors
- If a step fails, report the error
- Attempt recovery if possible
- Do NOT continue past failed steps without user approval
```

### Deliverables
- [ ] `ToolMode` enum and tool categorization
- [ ] `filter_tools_by_mode()` function
- [ ] Updated `AgentFactory` with mode support
- [ ] `ExecutionCoordinator` for phase transitions
- [ ] Prompt templates: `mode_planning.j2`, `mode_execution.j2`
- [ ] Evals: `two-phase-execution.yaml` scenarios

### Success Criteria
- Planning phase cannot call mutation tools
- Mode transition requires explicit approval
- Execution phase has full tool access
- Clear prompt differentiation between modes

---

## Phase 2B: Context Offloading

**Goal**: Large tool outputs stored externally, only summaries in context.

**Depends on**: Phase 0

### 2B.1 Result Storage

```python
# src/emery_agents/tools/result_storage.py

from dataclasses import dataclass
from typing import Optional
import hashlib
import json

@dataclass
class StoredResult:
    """Reference to a stored large result."""
    id: str
    summary: str
    path: str
    size: int
    record_count: Optional[int] = None

    def to_context_string(self) -> str:
        """Format for inclusion in agent context."""
        lines = [self.summary]
        if self.record_count:
            lines.append(f"Records: {self.record_count}")
        lines.append(f"Full data: {self.path}")
        return "\n".join(lines)


class ResultStorage:
    """Manages storage of large tool outputs."""

    THRESHOLD_CHARS = 2000
    THRESHOLD_RECORDS = 50

    def __init__(self, workspace: Workspace, storage: FileStorage):
        self.workspace = workspace
        self.storage = storage

    def should_offload(self, result: str) -> bool:
        """Determine if result should be offloaded."""
        if len(result) > self.THRESHOLD_CHARS:
            return True
        # Check if it's JSON with many records
        try:
            data = json.loads(result)
            if isinstance(data, list) and len(data) > self.THRESHOLD_RECORDS:
                return True
        except:
            pass
        return False

    def offload(self, result: str, context: str = "") -> StoredResult:
        """Store result and return reference with summary."""
        result_id = hashlib.sha256(result.encode()).hexdigest()[:12]
        path = self.workspace.result_path(result_id)

        self.storage.write(path, result, metadata={
            "context": context,
            "size": len(result),
        })

        summary = self._generate_summary(result)
        record_count = self._count_records(result)

        return StoredResult(
            id=result_id,
            summary=summary,
            path=str(path),
            size=len(result),
            record_count=record_count,
        )

    def _generate_summary(self, result: str, max_length: int = 500) -> str:
        """Generate a summary of the result."""
        # Try to parse as JSON and summarize structure
        try:
            data = json.loads(result)
            if isinstance(data, list):
                if len(data) > 0:
                    sample = data[0]
                    keys = list(sample.keys()) if isinstance(sample, dict) else []
                    return f"List of {len(data)} items. Fields: {', '.join(keys[:5])}"
                return "Empty list"
            elif isinstance(data, dict):
                keys = list(data.keys())
                return f"Object with keys: {', '.join(keys[:10])}"
        except:
            pass

        # Fallback: truncate with indicator
        if len(result) > max_length:
            return result[:max_length] + f"... [{len(result) - max_length} more chars]"
        return result

    def _count_records(self, result: str) -> Optional[int]:
        try:
            data = json.loads(result)
            if isinstance(data, list):
                return len(data)
        except:
            pass
        return None

    def retrieve(self, result_id: str) -> Optional[str]:
        """Retrieve full result by ID."""
        path = self.workspace.result_path(result_id)
        if self.storage.exists(path):
            return self.storage.read(path)
        return None
```

### 2B.2 Integration with ToolExecutorTool

```python
# Modify: src/emery_agents/tools/tool_executor.py

class ToolExecutorTool(Tool):
    def __init__(self, ..., result_storage: ResultStorage):
        super().__init__(...)
        self.result_storage = result_storage

    def forward(self, tool: str, task: str) -> str:
        # Execute tool as before
        result = self._execute_tool(tool, task)

        # Check if result should be offloaded
        if self.result_storage.should_offload(result):
            stored = self.result_storage.offload(result, context=f"{tool}: {task}")
            return f"SUCCESS: {stored.to_context_string()}"

        return result
```

### Deliverables
- [ ] `StoredResult` dataclass
- [ ] `ResultStorage` with offloading logic
- [ ] Summary generation (JSON-aware)
- [ ] Integration with `ToolExecutorTool`
- [ ] Retrieval tool for agents to fetch full results

### Success Criteria
- Results >2000 chars automatically offloaded
- Summaries include record counts for lists
- Agents can retrieve full results when needed
- Context window usage reduced for large operations

---

## Phase 3: Task Ledger

**Goal**: Structured task tracking with status, dependencies, and progress.

**Depends on**: Phase 1

### 3.1 TaskLedger Data Structure

```python
# src/emery_agents/planning/task_ledger.py

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import json

class TaskStatus(Enum):
    PENDING = "pending"
    BLOCKED = "blocked"       # Waiting on dependencies
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class Task:
    """A single task in the ledger."""
    id: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    assigned_to: Optional[str] = None  # Agent/specialist name
    dependencies: List[str] = field(default_factory=list)  # Task IDs
    result: Optional[str] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def is_ready(self, ledger: "TaskLedger") -> bool:
        """Check if all dependencies are completed."""
        for dep_id in self.dependencies:
            dep = ledger.get_task(dep_id)
            if dep and dep.status != TaskStatus.COMPLETED:
                return False
        return True


@dataclass
class TaskLedger:
    """Manages a collection of tasks with dependencies."""
    id: str
    goal: str
    tasks: Dict[str, Task] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def add_task(self, task: Task) -> None:
        self.tasks[task.id] = task
        self.updated_at = datetime.utcnow()

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.tasks.get(task_id)

    def update_task(self, task_id: str, **updates) -> None:
        task = self.tasks.get(task_id)
        if task:
            for key, value in updates.items():
                setattr(task, key, value)
            self.updated_at = datetime.utcnow()

    def next_ready_tasks(self) -> List[Task]:
        """Get all tasks that are ready to execute."""
        ready = []
        for task in self.tasks.values():
            if task.status == TaskStatus.PENDING and task.is_ready(self):
                ready.append(task)
        return ready

    def is_complete(self) -> bool:
        """Check if all tasks are completed or failed."""
        for task in self.tasks.values():
            if task.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED):
                return False
        return True

    def is_blocked(self) -> bool:
        """Check if we're stuck (no ready tasks, not complete)."""
        return not self.is_complete() and len(self.next_ready_tasks()) == 0

    def summary(self) -> Dict[str, int]:
        """Get task status counts."""
        counts = {status.value: 0 for status in TaskStatus}
        for task in self.tasks.values():
            counts[task.status.value] += 1
        return counts

    def to_markdown(self) -> str:
        """Render ledger as markdown."""
        lines = [
            f"# Task Ledger: {self.goal}",
            f"",
            f"**ID**: {self.id}",
            f"**Updated**: {self.updated_at.isoformat()}",
            f"",
            "## Progress",
            f"",
        ]

        summary = self.summary()
        total = len(self.tasks)
        completed = summary["completed"]
        lines.append(f"Progress: {completed}/{total} tasks completed")
        lines.append("")
        lines.append("## Tasks")
        lines.append("")

        # Group by status
        for status in TaskStatus:
            tasks_with_status = [t for t in self.tasks.values() if t.status == status]
            if tasks_with_status:
                lines.append(f"### {status.value.title()}")
                for task in tasks_with_status:
                    icon = {"pending": "⬜", "in_progress": "🔄", "completed": "✅", "failed": "❌", "blocked": "🚫", "skipped": "⏭️"}[status.value]
                    lines.append(f"- {icon} **{task.id}**: {task.description}")
                    if task.assigned_to:
                        lines.append(f"  - Assigned to: {task.assigned_to}")
                    if task.dependencies:
                        lines.append(f"  - Dependencies: {', '.join(task.dependencies)}")
                    if task.result:
                        lines.append(f"  - Result: {task.result[:100]}...")
                    if task.error:
                        lines.append(f"  - Error: {task.error}")
                lines.append("")

        return "\n".join(lines)

    def to_json(self) -> str:
        """Serialize to JSON for persistence."""
        return json.dumps({
            "id": self.id,
            "goal": self.goal,
            "tasks": {
                tid: {
                    "id": t.id,
                    "description": t.description,
                    "status": t.status.value,
                    "assigned_to": t.assigned_to,
                    "dependencies": t.dependencies,
                    "result": t.result,
                    "error": t.error,
                    "metadata": t.metadata,
                }
                for tid, t in self.tasks.items()
            },
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }, indent=2)

    @classmethod
    def from_json(cls, data: str) -> "TaskLedger":
        """Deserialize from JSON."""
        obj = json.loads(data)
        ledger = cls(id=obj["id"], goal=obj["goal"])
        for tid, tdata in obj["tasks"].items():
            ledger.tasks[tid] = Task(
                id=tdata["id"],
                description=tdata["description"],
                status=TaskStatus(tdata["status"]),
                assigned_to=tdata.get("assigned_to"),
                dependencies=tdata.get("dependencies", []),
                result=tdata.get("result"),
                error=tdata.get("error"),
                metadata=tdata.get("metadata", {}),
            )
        return ledger
```

### 3.2 Ledger Repository

```python
# src/emery_agents/planning/ledger_repository.py

class LedgerRepository:
    """Persistence layer for task ledgers."""

    def __init__(self, workspace: Workspace, storage: FileStorage):
        self.workspace = workspace
        self.storage = storage
        self.ledgers_dir = workspace.config.base_dir / "ledgers"
        self.ledgers_dir.mkdir(parents=True, exist_ok=True)

    def save(self, ledger: TaskLedger) -> Path:
        path = self.ledgers_dir / f"{ledger.id}.json"
        self.storage.write(path, ledger.to_json())

        # Also save markdown for human readability
        md_path = self.ledgers_dir / f"{ledger.id}.md"
        self.storage.write(md_path, ledger.to_markdown())

        return path

    def load(self, ledger_id: str) -> Optional[TaskLedger]:
        path = self.ledgers_dir / f"{ledger_id}.json"
        if not self.storage.exists(path):
            return None
        return TaskLedger.from_json(self.storage.read(path))
```

### Deliverables
- [ ] `Task` and `TaskStatus` dataclasses
- [ ] `TaskLedger` with dependency tracking
- [ ] `LedgerRepository` for persistence
- [ ] Markdown and JSON serialization
- [ ] Ready task detection with `next_ready_tasks()`

### Success Criteria
- Tasks track dependencies correctly
- Blocked state detected when no ready tasks
- Ledger persists to both JSON and markdown
- Status summary available for reporting

---

## Phase 4A: Magentic Orchestration

**Goal**: Manager agent with dynamic task ledger management.

**Depends on**: Phase 3, Phase 2A

### 4A.1 Manager Agent

```python
# src/emery_agents/orchestration/magentic_orchestrator.py

class MagenticOrchestrator:
    """
    Implements the Magentic pattern:
    1. Manager creates initial task ledger
    2. Consults specialists to refine
    3. Delegates tasks with tool access
    4. Evaluates completion and loops
    """

    def __init__(
        self,
        manager_model: str,
        specialists: Dict[str, Agent],
        factory: AgentFactory,
        ledger_repo: LedgerRepository,
        plan_repo: PlanRepository,
    ):
        self.manager_model = manager_model
        self.specialists = specialists
        self.factory = factory
        self.ledger_repo = ledger_repo
        self.plan_repo = plan_repo

    async def run(self, goal: str, tools: List[Tool]) -> str:
        # Phase 1: Create initial task ledger
        ledger = await self._create_initial_ledger(goal, tools)
        self.ledger_repo.save(ledger)

        # Phase 2: HITL approval
        approved = await self._await_approval(ledger)
        if not approved:
            return "Task ledger rejected by user."

        # Phase 3: Execute with evaluation loop
        max_iterations = 20
        for iteration in range(max_iterations):
            # Check completion
            if ledger.is_complete():
                break

            # Check if blocked
            if ledger.is_blocked():
                replan_result = await self._handle_blocked(ledger, goal)
                if not replan_result:
                    return f"Execution blocked. Ledger:\n{ledger.to_markdown()}"

            # Get next ready tasks
            ready_tasks = ledger.next_ready_tasks()

            # Execute tasks (could be parallel in Phase 5)
            for task in ready_tasks:
                await self._execute_task(ledger, task, tools)
                self.ledger_repo.save(ledger)

            # Evaluate progress
            should_continue = await self._evaluate_progress(ledger, goal)
            if not should_continue:
                break

        # Synthesize final result
        return await self._synthesize_results(ledger)

    async def _create_initial_ledger(self, goal: str, tools: List[Tool]) -> TaskLedger:
        """Use manager agent to create initial task breakdown."""
        manager = self.factory.create_agent(
            agent_type="manager",
            tools=tools,
            mode=ToolMode.PLANNING,
            model=self.manager_model,
        )

        # Get task breakdown
        prompt = f"""
        Create a task ledger for the following goal:

        GOAL: {goal}

        Output a JSON task list with:
        - id: unique task identifier
        - description: what needs to be done
        - dependencies: list of task IDs this depends on
        - assigned_to: specialist name (skill_builder, schema_builder, document_builder, or null)

        Available specialists: {list(self.specialists.keys())}
        """

        result = await manager.run(prompt)
        tasks = self._parse_task_list(result)

        ledger = TaskLedger(
            id=f"ledger_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            goal=goal,
        )
        for task in tasks:
            ledger.add_task(task)

        return ledger

    async def _execute_task(self, ledger: TaskLedger, task: Task, tools: List[Tool]):
        """Execute a single task using appropriate specialist."""
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.utcnow()

        try:
            if task.assigned_to and task.assigned_to in self.specialists:
                # Use specialist agent
                specialist = self.specialists[task.assigned_to]
                result = await specialist.run(task.description)
            else:
                # Use general executor
                executor = self.factory.create_agent(
                    agent_type="executor",
                    tools=tools,
                    mode=ToolMode.EXECUTION,
                )
                result = await executor.run(task.description)

            task.status = TaskStatus.COMPLETED
            task.result = result
            task.completed_at = datetime.utcnow()

        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.utcnow()

    async def _evaluate_progress(self, ledger: TaskLedger, goal: str) -> bool:
        """Use manager to evaluate if we should continue."""
        manager = self.factory.create_agent(
            agent_type="evaluator",
            tools=[],
            mode=ToolMode.PLANNING,
            model=self.manager_model,
        )

        prompt = f"""
        Evaluate progress on this goal:

        GOAL: {goal}

        CURRENT LEDGER:
        {ledger.to_markdown()}

        Questions:
        1. Is the goal achieved? (yes/no)
        2. Are there blocking issues that require user intervention? (yes/no)
        3. Should we continue execution? (yes/no)

        Respond with JSON: {{"goal_achieved": bool, "needs_user": bool, "continue": bool, "reason": str}}
        """

        result = await manager.run(prompt)
        evaluation = json.loads(result)
        return evaluation.get("continue", False)

    async def _handle_blocked(self, ledger: TaskLedger, goal: str) -> bool:
        """Handle blocked state - attempt replan or escalate."""
        # Find failed tasks
        failed = [t for t in ledger.tasks.values() if t.status == TaskStatus.FAILED]

        if not failed:
            # Blocked but no failures - likely circular dependency
            return False

        # Attempt to create recovery tasks
        # ... implementation details
        return True
```

### Deliverables
- [ ] `MagenticOrchestrator` class
- [ ] Manager agent for ledger creation
- [ ] Specialist routing logic
- [ ] Evaluation loop with replan capability
- [ ] Prompt templates for manager/evaluator

### Success Criteria
- Manager creates appropriate task breakdown
- Specialists invoked based on assignment
- Blocked states detected and handled
- Progress evaluation enables early termination

---

## Phase 4B: Progressive Disclosure

**Goal**: Lazy-load agent instructions based on task matching.

**Depends on**: Phase 0

### 4B.1 Template Split

```
prompts/
├── agents/
│   ├── skill_builder.meta.j2      # ~100 tokens
│   ├── skill_builder.full.j2      # Full instructions
│   ├── schema_builder.meta.j2
│   ├── schema_builder.full.j2
│   ├── document_builder.meta.j2
│   └── document_builder.full.j2
```

### 4B.2 Skill Registry

```python
# src/emery_agents/skills/skill_registry.py

@dataclass
class SkillMetadata:
    """Lightweight skill descriptor."""
    name: str
    description: str  # ~100 tokens max
    tools: List[str]
    priority: int = 0

@dataclass
class Skill:
    """Full skill with instructions."""
    metadata: SkillMetadata
    instructions: str  # Full template content

class SkillRegistry:
    """Manages skill discovery and loading."""

    def __init__(self, prompts_dir: Path):
        self.prompts_dir = prompts_dir
        self._metadata_cache: Dict[str, SkillMetadata] = {}
        self._full_cache: Dict[str, Skill] = {}

    def load_metadata(self) -> List[SkillMetadata]:
        """Load all skill metadata (lightweight)."""
        if self._metadata_cache:
            return list(self._metadata_cache.values())

        for meta_file in (self.prompts_dir / "agents").glob("*.meta.j2"):
            skill_name = meta_file.stem.replace(".meta", "")
            content = meta_file.read_text()
            metadata = self._parse_metadata(skill_name, content)
            self._metadata_cache[skill_name] = metadata

        return list(self._metadata_cache.values())

    def load_full(self, skill_name: str) -> Optional[Skill]:
        """Load full skill instructions (on-demand)."""
        if skill_name in self._full_cache:
            return self._full_cache[skill_name]

        full_file = self.prompts_dir / "agents" / f"{skill_name}.full.j2"
        if not full_file.exists():
            return None

        metadata = self._metadata_cache.get(skill_name)
        if not metadata:
            self.load_metadata()
            metadata = self._metadata_cache.get(skill_name)

        instructions = full_file.read_text()
        skill = Skill(metadata=metadata, instructions=instructions)
        self._full_cache[skill_name] = skill
        return skill

    def match_skill(self, task: str) -> Optional[str]:
        """Find best matching skill for task."""
        metadata_list = self.load_metadata()

        # Simple keyword matching (could use embeddings)
        best_match = None
        best_score = 0

        for meta in metadata_list:
            score = self._compute_match_score(task, meta.description)
            if score > best_score:
                best_score = score
                best_match = meta.name

        return best_match if best_score > 0.5 else None
```

### Deliverables
- [ ] Split existing templates into meta/full pairs
- [ ] `SkillMetadata` and `Skill` dataclasses
- [ ] `SkillRegistry` with lazy loading
- [ ] Skill matching logic
- [ ] Integration with agent factory

### Success Criteria
- Metadata loads in <100ms
- Full instructions only loaded when matched
- Reduced baseline token usage
- Skill matching accuracy >80%

---

## Phase 5: Parallel Execution

**Goal**: Execute independent tasks concurrently.

**Depends on**: Phase 4A

### 5.1 DAG-Based Scheduler

```python
# src/emery_agents/orchestration/task_scheduler.py

class TaskScheduler:
    """Schedules tasks respecting dependencies, enabling parallelism."""

    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent

    async def execute_ledger(
        self,
        ledger: TaskLedger,
        executor_fn: Callable[[Task], Awaitable[str]],
    ) -> TaskLedger:
        """Execute all tasks in ledger with parallelism."""
        while not ledger.is_complete():
            ready = ledger.next_ready_tasks()

            if not ready:
                if ledger.is_blocked():
                    break
                continue

            # Execute ready tasks in parallel (up to max_concurrent)
            batch = ready[:self.max_concurrent]
            tasks = [executor_fn(task) for task in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Update task statuses
            for task, result in zip(batch, results):
                if isinstance(result, Exception):
                    task.status = TaskStatus.FAILED
                    task.error = str(result)
                else:
                    task.status = TaskStatus.COMPLETED
                    task.result = result

        return ledger
```

### 5.2 Result Aggregation

```python
# src/emery_agents/orchestration/result_aggregator.py

class ResultAggregator:
    """Aggregates results from parallel task execution."""

    async def aggregate(
        self,
        ledger: TaskLedger,
        goal: str,
        aggregator_model: str,
    ) -> str:
        """Synthesize final result from completed tasks."""
        completed = [t for t in ledger.tasks.values() if t.status == TaskStatus.COMPLETED]

        prompt = f"""
        Synthesize the results of these completed tasks into a final response.

        GOAL: {goal}

        COMPLETED TASKS:
        {self._format_completed(completed)}

        Provide a cohesive summary that addresses the original goal.
        """

        # Use lightweight model for aggregation
        # ... implementation
```

### Deliverables
- [ ] `TaskScheduler` with dependency-aware parallelism
- [ ] `ResultAggregator` for synthesizing parallel results
- [ ] Concurrency limits and backpressure
- [ ] Error handling for partial failures

### Success Criteria
- Independent tasks execute in parallel
- Dependencies respected (no race conditions)
- Partial failures don't block unrelated tasks
- Results aggregated coherently

---

## Evaluation Strategy

Each phase should include promptfoo evaluations:

```yaml
# evals/scenarios/architecture/
├── phase-0-workspace.yaml
├── phase-1-plan-persistence.yaml
├── phase-2a-two-phase-execution.yaml
├── phase-2b-context-offloading.yaml
├── phase-3-task-ledger.yaml
├── phase-4a-magentic-orchestration.yaml
├── phase-4b-progressive-disclosure.yaml
└── phase-5-parallel-execution.yaml
```

### Example: Phase 1 Eval

```yaml
# phase-1-plan-persistence.yaml
description: "Test plan persistence across sessions"

tests:
  - description: "Plan saves to disk on creation"
    vars:
      task: "Create a new skill for sending Slack messages"
    assert:
      - type: javascript
        value: |
          const fs = require('fs');
          const planDir = process.env.EMERY_WORKSPACE_DIR + '/plans';
          const files = fs.readdirSync(planDir);
          return files.some(f => f.endsWith('.md'));

  - description: "Plan loads on session resume"
    vars:
      task: "Continue with the plan"
      session_id: "test_session_123"
    assert:
      - type: contains
        value: "Resuming plan"
```

---

## Timeline and Priorities

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Phase 0 | Foundation | Low | P0 - Required |
| Phase 1 | High | Medium | P1 - Core |
| Phase 2A | High | Medium | P1 - Core |
| Phase 2B | Medium | Low | P2 - Nice to have |
| Phase 3 | High | Medium | P1 - Core |
| Phase 4A | High | High | P1 - Core |
| Phase 4B | Medium | Medium | P2 - Optimization |
| Phase 5 | Medium | High | P3 - Future |

**Recommended order**: 0 → 1 → 3 → 2A → 4A → 2B → 4B → 5

---

## Related Documents

| Document | Description |
|----------|-------------|
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Maps current implementation to each phase - what exists vs what's missing |
| [AGENTIC_ARCHITECTURE_RESEARCH.md](./AGENTIC_ARCHITECTURE_RESEARCH.md) | Research synthesis on Claude Code, orchestration patterns, and best practices |
| [FUTURE_AUTONOMOUS_PLANNING.md](./FUTURE_AUTONOMOUS_PLANNING.md) | Vision for autonomous plan generation and skill configuration |

---

## Future Work: Phase 6+ (Autonomous Plan Generation)

> See [FUTURE_AUTONOMOUS_PLANNING.md](./FUTURE_AUTONOMOUS_PLANNING.md) for full details.

Beyond the core phases, the system can evolve to support **autonomous plan generation** for configuring agentic nodes in the skill editor.

### Concept

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   PLANNING   │────▶│    PLAN      │────▶│   SKILL      │
│    AGENT     │     │    FILE      │     │   TEMPLATE   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                   │                    │
       │ Generate          │ Persist            │ Configure
       ▼                   ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Research    │     │  Versioned   │     │   Agentic    │
│  + Plan      │     │  Markdown    │     │    Node      │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Phase 6A: Plan Generation Mode

**Goal**: Planning agents that research and generate reusable plan templates.

- `ResearchAgent` for context gathering (read-only mode)
- `PlanningAgent` for structured plan creation
- HITL refinement loop for plan approval
- Plan versioning and history

### Phase 6B: Plan → Skill Conversion

**Goal**: Convert approved plans to skill configurations.

- `PlanToSkillConverter` for plan → SkillConfig
- Automatic step generation from plan structure
- Tool and input/output schema inference
- Plan lineage metadata in skills

### Phase 6C: Integrated Evaluations

**Goal**: Every plan generates evaluation criteria that become promptfoo tests.

- `EvalGenerator` from plan criteria
- Auto-generated `evals/scenarios/generated/*.yaml`
- Continuous evaluation on skill execution
- Failure-triggered plan review suggestions

### Phase 6D: Skill Editor Integration

**Goal**: UI for plan-driven skill creation.

- "Generate from Plan" button in skill editor
- Plan library browser
- Skill lineage view (which plan created which skill)
- Evaluation dashboard with pass/fail status

### Benefits

1. **Quality**: Plans reviewed before becoming skills
2. **Consistency**: Standard format for all agentic nodes
3. **Versioning**: Full history of plan evolution
4. **Testability**: Every skill has generated evals
5. **Learning**: Plans can be shared and improved across agents

---

## Next Steps

1. Review this roadmap and adjust priorities
2. Review [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) to understand current gaps
3. Start with Phase 0 (foundation layer)
4. Iterate on Phase 1 with simple plan persistence
5. Build out Task Ledger (Phase 3) early - it's the backbone
6. Add two-phase execution (Phase 2A) for safety
7. Implement Magentic pattern (Phase 4A) for full orchestration
8. Consider Phase 6 (Autonomous Planning) as long-term vision
