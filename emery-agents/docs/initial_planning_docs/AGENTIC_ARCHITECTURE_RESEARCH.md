# Agentic Architecture Research: Improving Emery Agents

> Research conducted January 2026 - analyzing Claude Code patterns, multi-agent orchestration, and planning implementations to improve the emery-agents system.

---

## Executive Summary

This document synthesizes research on Claude Code's architecture, multi-agent orchestration patterns, and planning implementations to provide a roadmap for improving the emery-agents system.

---

## Current Architecture (emery-agents)

| Component | Implementation | Status |
|-----------|----------------|--------|
| **Agent Framework** | smolagents (ToolCallingAgent, CodeAgent) | ✅ Good foundation |
| **HITL Workflow** | `HITLMixin`, `StatefulManagedAgent`, interrupt propagation | ✅ Well-implemented |
| **Planning** | `planning_interval=2` with `PlanningStep` callbacks | ⚠️ Basic - ephemeral |
| **Tool Execution** | `ToolExecutorTool` wrapper with isolated sub-agents | ✅ Claude Code-like pattern |
| **Prompt Templates** | Jinja2 with composition (`base/`, `agents/`, `components/`) | ✅ Solid structure |
| **State Management** | `reset=False` for memory preservation | ⚠️ In-memory only |
| **Context Isolation** | Sub-agents with `reset=True` | ✅ Good pattern |

---

## Key Patterns from Claude Code

### 1. File-Based Plan Persistence

Claude Code stores plans as markdown files in `~/.claude/plans/`, treating the filesystem as persistent memory:

```
Context Window = RAM (volatile, limited)
Filesystem = Disk (persistent, unlimited)
```

**Current gap**: Plans exist only in memory via `PlanningStep`. If the session ends, the plan is lost.

**Pattern**:
```python
class PlanFile:
    def __init__(self, workspace_dir: str):
        self.plans_dir = Path(workspace_dir) / ".emery" / "plans"

    def save_plan(self, plan_id: str, plan: str) -> Path:
        path = self.plans_dir / f"{plan_id}.md"
        path.write_text(plan)
        return path

    def load_plan(self, plan_id: str) -> str:
        return (self.plans_dir / f"{plan_id}.md").read_text()
```

### 2. Two-Phase Execution Model

Claude Code enforces a clear boundary between planning (read-only) and execution (full access):

| Phase | Tools Available | State |
|-------|-----------------|-------|
| Planning | Read-only (file reading, searches, web fetch) | Exploration mode |
| Execution | Full (editing, commands, mutations) | After approval |

**Current gap**: Agents can mutate during planning (no tool restrictions).

**Pattern**:
```python
def create_agent(mode: Literal["planning", "execution"]):
    if mode == "planning":
        tools = [t for t in all_tools if t.name in READ_ONLY_TOOLS]
    else:
        tools = all_tools
```

### 3. Progressive Disclosure for Skills

Claude Code's Agent Skills use a two-tier loading pattern:
- **Tier 1**: Lightweight metadata (~100 tokens) - always loaded
- **Tier 2**: Full instructions (<5k tokens) - loaded on-demand when matched

```yaml
# SKILL.md structure
---
name: skill-name
description: "When to activate (100 tokens max)"
tools: tool1, tool2
---
# Full instructions loaded only when needed (up to 5k tokens)
```

**Current gap**: All agent instructions load fully upfront via `build_agent_instructions()`.

**Pattern**: Split templates into meta/full pairs:
```
prompts/
├── agents/
│   ├── skill_builder.meta.j2    # ~100 tokens, always loaded
│   └── skill_builder.full.j2    # Full instructions, loaded on match
```

### 4. Context Offloading Pattern

Large tool outputs are stored in files with only summaries in context:

```python
def execute_tool(tool, args):
    result = tool.run(args)
    if len(result) > THRESHOLD:
        file_path = store_to_file(result)
        return f"Query returned {len(result)} records. Stored at: {file_path}"
    return result
```

**Current gap**: Tool outputs go directly into agent memory.

### 5. Sub-Agent Architecture

Claude Code uses specialized sub-agents with:
- **Isolated context windows** (prevent pollution)
- **Granular tool access** (only needed tools)
- **YAML frontmatter configuration**:

```yaml
name: unique-identifier
description: "When to use this agent"
tools: file_read,file_write,terminal
priority: high
```

---

## Orchestration Patterns (Microsoft Azure)

| Pattern | Description | Current State | Fit for Emery |
|---------|-------------|---------------|---------------|
| **Sequential** | Linear pipeline | ✅ via managed agents | Good for workflows |
| **Concurrent** | Parallel + aggregate | ❌ Not implemented | High impact for analysis |
| **Handoff** | Dynamic routing | ⚠️ Basic via `agent.description` | Improve routing logic |
| **Magentic** | Task ledger + dynamic planning | ❌ Not implemented | **Highest impact** |
| **Group Chat** | Multi-agent discussion | ❌ Not implemented | Lower priority |

### Magentic Pattern (Recommended)

This matches Claude Code's approach most closely. A manager agent:
1. Creates a **task ledger** (the plan)
2. Consults specialists to **refine the plan**
3. **Delegates** tasks with tool access
4. **Evaluates** completion and loops

```python
class MagenticOrchestrator:
    def __init__(self, manager: Agent, specialists: List[Agent]):
        self.manager = manager
        self.specialists = specialists
        self.ledger = TaskLedger()

    async def run(self, goal: str):
        # Phase 1: Initial planning
        initial_plan = await self.manager.plan(goal)
        self.ledger.set_plan(initial_plan)

        # Phase 2: Iterative refinement
        while not self.ledger.is_complete():
            next_task = self.ledger.next_pending()
            specialist = self.route_to_specialist(next_task)
            result = await specialist.execute(next_task)
            self.ledger.update(next_task.id, result)

            # Re-evaluate with manager
            should_continue = await self.manager.evaluate(self.ledger)
            if not should_continue:
                break

        return self.ledger.synthesize()
```

---

## Plan-and-Execute Architecture

### Current ReAct Loop
```
User → Think → Act → Observe → Think → Act → ...
         ↑         LLM call for each step
```

### Plan-and-Execute (Recommended)
```
User → Planner (1 LLM call) → [Step1, Step2, Step3, ...]
                                    ↓
                              Executor (smaller LLM or tools)
                                    ↓
                              Results → Replan if needed
```

**Benefits**:
- Fewer expensive LLM calls
- Can use smaller models for execution
- Explicit reasoning about all steps upfront
- Natural HITL checkpoint between planning and execution

**Implementation pattern**:
```python
class PlanAndExecuteAgent:
    def __init__(self, planner_model, executor_model):
        self.planner = CodeAgent(model=planner_model, tools=[])
        self.executor = ToolCallingAgent(model=executor_model, tools=all_tools)

    def run(self, task: str):
        # Phase 1: Planning (expensive model, no tools)
        plan = self.planner.run(f"Create a step-by-step plan for: {task}")

        # HITL checkpoint
        approved_plan = self.wait_for_approval(plan)

        # Phase 2: Execution (cheaper model, with tools)
        for step in approved_plan.steps:
            result = self.executor.run(step)
```

---

## Prompt Engineering Best Practices

### 1. Critical Rules Pattern
Explicit constraints that prevent hallucination:
- "NEVER fabricate" enforcement
- Tool output as truth
- Explicit verification requirements

### 2. Context Type Separation
```jinja2
{% if context_type == "planning" %}
## Planning Mode
You are in READ-ONLY planning mode.
- DO NOT use tools that modify state
- Focus on understanding and proposing
- Output a structured plan for approval
{% elif context_type == "execution" %}
## Execution Mode
User has approved your plan. Execute immediately.
- Use tools to implement each step
- Verify after each mutation
- Report any deviations from plan
{% endif %}
```

### 3. Output Capture Pattern
```jinja2
## Output Requirements
After completing the task, you MUST:
1. Store large outputs to files (>2000 chars)
2. Summarize results in <500 chars for the user
3. Include file references for detailed data
4. Use structured format: SUCCESS: or FAILED: prefix
```

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EMERY ORCHESTRATOR                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   PLANNER   │───▶│ TASK LEDGER │◀───│  EVALUATOR  │          │
│  │  (CodeAgent)│    │ (Persistent)│    │ (replan?)   │          │
│  └─────────────┘    └──────┬──────┘    └─────────────┘          │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   SKILL     │    │   SCHEMA    │    │  DOCUMENT   │          │
│  │  BUILDER    │    │   BUILDER   │    │   BUILDER   │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            ▼                                     │
│                   ┌─────────────┐                                │
│                   │    TOOL     │                                │
│                   │  EXECUTOR   │◀── Context Isolation           │
│                   └──────┬──────┘                                │
│                          │                                       │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  CRUD Tools │  │  External   │  │   File      │              │
│  │ (API calls) │  │   Tools     │  │   Storage   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sources

**Claude Code Architecture**:
- [What Actually Is Claude Code's Plan Mode - Armin Ronacher](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/)
- [Claude Code Sub-Agents Transform Task Management - htdocs.dev](https://htdocs.dev/posts/revolutionizing-ai-development-how-claude-codes-sub-agents-transform-task-management/)
- [GitHub - anthropics/claude-code](https://github.com/anthropics/claude-code)

**Orchestration Patterns**:
- [AI Agent Orchestration Patterns - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Plan-and-Execute Agents - LangChain Blog](https://blog.langchain.com/planning-agents/)
- [20 Agentic AI Workflow Patterns - Skywork](https://skywork.ai/blog/agentic-ai-examples-workflow-patterns-2025/)

**File-Based State Management**:
- [Advanced AI Agents with File Access - FlowHunt](https://www.flowhunt.io/blog/advanced-ai-agents-with-file-access-mastering-context-offloading-and-state-management/)

**Framework Comparisons**:
- [LangGraph vs AutoGen vs CrewAI - Latenode](https://latenode.com/blog/platform-comparisons-alternatives/automation-platform-comparisons/langgraph-vs-autogen-vs-crewai-complete-ai-agent-framework-comparison-architecture-analysis-2025)
- [Choosing the Right Orchestration Pattern - Kore.ai](https://www.kore.ai/blog/choosing-the-right-orchestration-pattern-for-multi-agent-systems)
