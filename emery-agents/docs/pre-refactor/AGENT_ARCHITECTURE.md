# Emery Agent Architecture

This document details all agents in the Emery system. For orchestration flows and state machines, see [ORCHESTRATION_FLOW.md](./ORCHESTRATION_FLOW.md). For system-level architecture, see [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md).

---

## Table of Contents

1. [Agent Overview](#1-agent-overview)
2. [Agent Hierarchy](#2-agent-hierarchy)
3. [Agent Catalog](#3-agent-catalog)
4. [Factory Pattern](#4-factory-pattern)
5. [HITL Configuration](#5-hitl-configuration)
6. [Cascade Planning](#6-cascade-planning)
7. [Tool Assignments](#7-tool-assignments)
8. [Key Files](#8-key-files)

---

## 1. Agent Overview

### Agent Categories

| Category | Agents | HITL | Purpose |
|----------|--------|------|---------|
| **Orchestrator** | chat_planner | Propagates | Routes user requests to specialized agents |
| **HITL Builders** | skill_builder, document_builder, schema_builder, app_builder, page_builder, agent_builder | Yes | Create/modify resources with user approval |
| **Autonomous** | table_builder | No | Quick single operations, no approval needed |
| **Research** | research_agent, research_emery | No | Read-only context gathering |
| **Dynamic** | agent_executor | No | User-defined agent wrapper |

### Agent Count Summary

- **Total Agents**: 11
- **HITL Agents**: 6 (require user approval for plans)
- **Autonomous Agents**: 1 (execute directly)
- **Research Agents**: 2 (read-only)
- **Dynamic Agents**: 1 (runtime-configured)
- **Orchestrator**: 1 (routes to others)

---

## 2. Agent Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT HIERARCHY                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│                          ┌─────────────────────┐                                    │
│                          │    chat_planner     │                                    │
│                          │   (orchestrator)    │                                    │
│                          └──────────┬──────────┘                                    │
│                                     │                                               │
│          ┌──────────────────────────┼──────────────────────────┐                   │
│          │                          │                          │                   │
│          ▼                          ▼                          ▼                   │
│   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐           │
│   │  HITL BUILDERS  │      │   AUTONOMOUS    │      │    RESEARCH     │           │
│   └────────┬────────┘      └────────┬────────┘      └────────┬────────┘           │
│            │                        │                        │                     │
│    ┌───────┼───────┐               │                ┌───────┼───────┐             │
│    │       │       │               │                │               │             │
│    ▼       ▼       ▼               ▼                ▼               ▼             │
│  skill  schema  document      table_builder    research      research_emery       │
│ builder builder  builder       (no HITL)        _agent         (system)           │
│                                                     │                              │
│  agent   app                                        │                              │
│ builder builder                                     │                              │
│            │                                        │                              │
│            ▼                                        ▼                              │
│      page_builder ─────────────────────────► research_agent                       │
│         (HITL)                                (read-only)                          │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Parent-Child Relationships

| Parent Agent | Child Agents | Relationship |
|--------------|--------------|--------------|
| chat_planner | skill_builder, document_builder, schema_builder, app_builder, table_builder, agent_builder, research_agent | Direct managed agents |
| app_builder | page_builder | Cascade planning for page creation |
| page_builder | research_agent | Content research during page building |
| research_agent | research_emery | Emery-specific context lookup |

---

## 3. Agent Catalog

### 3.1 chat_planner (Orchestrator)

```yaml
Purpose: Top-level orchestrator that routes user requests to specialized agents
Type: InterruptAwareToolCallingAgent
Location: emery-agents/src/emery_agents/grpc/chat_processing_service.py
```

| Property | Value |
|----------|-------|
| **Tools** | Direct tools from config + SkillTools |
| **Managed Agents** | skill_builder, document_builder, schema_builder, app_builder, table_builder, agent_builder, research_agent |
| **HITL** | Propagates from managed agents |
| **Max Steps** | 10 |
| **Planning Interval** | None (delegates to managed agents) |

**Key Behaviors:**
- Receives all user messages in interactive chat
- Routes requests to appropriate specialized agents
- Propagates HITL interrupts from managed agents to UI
- Maintains conversation context via SessionManager

---

### 3.2 skill_builder

```yaml
Purpose: Create, read, update, delete skills with user approval
Type: StatefulManagedAgent
Location: emery-agents/src/emery_agents/agents/skill_builder_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | skill_crud (via tool_executor) |
| **Managed Agents** | None |
| **HITL** | Yes (planning_interval=2) |
| **Max Steps** | 10 |
| **Prompt Template** | prompts/agents/skill_builder.j2 |

**Available Operations:**
- `list` - List all skills for organization
- `read` - Get skill details by ID
- `create` - Create new skill with instructions/tools
- `update` - Modify existing skill configuration
- `delete` - Remove skill

**Workflow:**
1. User: "Create a skill to summarize articles"
2. Agent lists existing skills for context
3. Agent creates plan with skill configuration
4. **INTERRUPT** - User approves plan
5. Agent executes skill creation

---

### 3.3 document_builder

```yaml
Purpose: Create and manage documents with user approval
Type: StatefulManagedAgent
Location: emery-agents/src/emery_agents/agents/document_builder_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | document_crud (via tool_executor) |
| **Managed Agents** | None |
| **HITL** | Yes (planning_interval=2) |
| **Max Steps** | 10 |
| **Prompt Template** | prompts/agents/document_builder.j2 |

**Available Operations:**
- `list` - List documents in database
- `read` - Get document content
- `create` - Create new document
- `update` - Modify document content
- `delete` - Remove document

---

### 3.4 table_builder (Autonomous)

```yaml
Purpose: Quick single-field operations without approval
Type: StatefulManagedAgent (no step_callbacks)
Location: emery-agents/src/emery_agents/agents/table_builder_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | field_crud, table_crud (via tool_executor) |
| **Managed Agents** | None |
| **HITL** | **None** (autonomous) |
| **Max Steps** | 10 |
| **Prompt Template** | prompts/agents/table_builder.j2 |

**Why Autonomous:**
- Low-risk, single operations (add column, rename field)
- Quick execution without approval overhead
- Used for simple modifications, not complex schema design

**Available Operations:**
- `create_field` - Add column to table
- `list_fields` - Get table schema
- `delete_field` - Remove column
- `read_table` - Get table details
- `list_tables` - List tables in database

**Workflow:**
1. User: "Add a status column to the Contacts table"
2. Agent lists tables to find Contacts ID
3. Agent executes field creation directly
4. Agent verifies and reports completion

---

### 3.5 schema_builder

```yaml
Purpose: Design complex database schemas from requirements
Type: StatefulManagedAgent
Location: emery-agents/src/emery_agents/agents/schema_builder_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | database_crud, table_crud, field_crud + research tools (via tool_executor) |
| **Managed Agents** | table_builder |
| **HITL** | Yes (planning_interval=3, stateful callback) |
| **Max Steps** | 15 |
| **Prompt Template** | prompts/agents/schema_builder.j2 |

**Stateful HITL Pattern:**
- Uses count-based callback (not simple PlanningStep trigger)
- Skips first plan (initial exploration)
- Interrupts on second plan (schema design ready for approval)

**Workflow:**
1. User: "Create a CRM database with contacts and deals"
2. Agent researches existing databases
3. Agent creates detailed schema plan
4. **INTERRUPT** - User reviews/approves schema
5. Agent creates tables and fields

---

### 3.6 app_builder

```yaml
Purpose: Create and manage Puck visual apps
Type: StatefulManagedAgent
Location: emery-agents/src/emery_agents/agents/app_builder_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | app_crud, page_crud + research tools (via tool_executor) |
| **Managed Agents** | page_builder |
| **HITL** | Yes (planning_interval=3) |
| **Max Steps** | 10 |
| **Prompt Template** | prompts/agents/app_builder.j2 |

**Cascade Planning:**
When a plan step references page_builder, cascade planning triggers:
1. app_builder creates high-level plan
2. SubAgentPlanner detects page_builder step
3. page_builder creates nested sub-plan
4. Combined plan presented for user approval

**Available Operations:**
- `list` - List apps for organization
- `read` - Get app with pages
- `create` - Create new app
- `update` - Update app settings
- `delete` - Remove app

---

### 3.7 page_builder

```yaml
Purpose: Create/edit Puck pages with 38 block types
Type: StatefulManagedAgent
Location: emery-agents/src/emery_agents/agents/page_builder_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | page_crud (**DIRECT** - not wrapped), research tools |
| **Managed Agents** | research_agent |
| **HITL** | Yes (planning_interval=3) |
| **Max Steps** | 15 |
| **Prompt Template** | prompts/agents/page_builder.j2 |

**Direct Tool Exception:**
page_builder receives `page_crud` directly (not wrapped in tool_executor) to preserve the full Puck block schema. The schema defines 38 block types with complex nested properties.

**Available Operations:**
- `list` - List pages in app
- `read` - Get page with content
- `create` - Create new page
- `update` - Update page settings
- `update_content` - Modify page blocks
- `publish` - Publish page
- `add_dialog` - Add modal dialog

**Block Categories:**
- Layout: Flex, Grid, Stack
- Content: Text, Heading, Icon, Image
- Interactive: Button, Link, Form
- Data: DataTable, DataChart
- Navigation: Sidebar, Navbar, Footer

---

### 3.8 agent_builder

```yaml
Purpose: Configure agent personas, automations, and skills
Type: StatefulManagedAgent
Location: emery-agents/src/emery_agents/agents/agent_builder_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | agent_crud, skill_crud (via tool_executor) |
| **Managed Agents** | None |
| **HITL** | Yes (planning_interval=2) |
| **Max Steps** | 10 |
| **Prompt Template** | prompts/agents/agent_builder.j2 |

**Available Operations:**
- `list` - List agents for organization
- `read` - Get agent configuration
- `update` - Modify agent settings (persona, automations)

---

### 3.9 research_agent

```yaml
Purpose: Web search and external content research
Type: StatefulManagedAgent (no step_callbacks)
Location: emery-agents/src/emery_agents/agents/research_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | DuckDuckGoSearchTool, VisitWebpageTool |
| **Managed Agents** | research_emery |
| **HITL** | **None** (read-only) |
| **Max Steps** | 10 |
| **Prompt Template** | prompts/agents/research.j2 |

**Why No HITL:**
- Read-only operations (search, visit pages)
- No data modifications
- Used for context gathering

**Workflow:**
1. Parent agent delegates research task
2. research_agent searches web
3. research_agent visits relevant pages
4. Returns consolidated findings

---

### 3.10 research_emery

```yaml
Purpose: Internal Emery system introspection
Type: StatefulManagedAgent
Location: emery-agents/src/emery_agents/agents/research_emery_agent.py
```

| Property | Value |
|----------|-------|
| **Tools** | system_research_tool |
| **Managed Agents** | None |
| **HITL** | **None** (read-only) |
| **Max Steps** | 5 |

**Capabilities:**
- Query organization's tables and fields
- List available skills
- Get database schemas
- Retrieve context about Emery resources

---

### 3.11 agent_executor (Dynamic)

```yaml
Purpose: Wrapper for user-defined agent configurations
Type: ToolCallingAgent (dynamically configured)
Location: emery-agents/src/emery_agents/services/agent_executor.py
```

| Property | Value |
|----------|-------|
| **Tools** | Configured per skill |
| **Managed Agents** | None |
| **HITL** | **None** (autonomous execution) |
| **Max Steps** | Configured per skill |

**Usage:**
- Executes user-created agentic skills
- Tools loaded from skill configuration
- Used in autonomous execution mode (scheduled, triggered)

---

## 4. Factory Pattern

### ManagedAgentsFactory

Central factory that creates all managed agents with consistent configuration.

```
Location: emery-agents/src/emery_agents/grpc/agents/managed_agents_factory.py
```

### StatefulManagedAgent Base Class

All HITL builder agents extend `StatefulManagedAgent`, which in turn extends smolagents' `CodeAgent`:

```
CodeAgent (smolagents)
└── StatefulManagedAgent
    └── All builder agents (skill, document, table, schema, app, page, agent)
```

**Why CodeAgent (not ToolCallingAgent)?**
- CodeAgent generates Python code for planning, enabling more sophisticated multi-step reasoning
- Better at structured planning with complex logic
- Supports `reset=False` in `__call__()` to preserve memory across HITL interrupts

### Tool Wrapping Pattern

```
specialized_tools → tool_executor → managed_agent → chat_planner
```

Most agents receive their CRUD tools wrapped in `tool_executor`. This provides:
- Unified interface for all tool calls
- Consistent error handling
- Logging and observability

### Direct Tool Exception

**page_builder** receives `page_crud` DIRECTLY (not wrapped) because:
- Puck block schema has 38 block types with complex nested properties
- Wrapping would lose schema information needed for LLM
- Full schema enables intelligent block generation

### Factory Methods

```python
class ManagedAgentsFactory:
    def create_skill_builder() -> StatefulManagedAgent
    def create_document_builder() -> StatefulManagedAgent
    def create_table_builder() -> StatefulManagedAgent
    def create_schema_builder() -> StatefulManagedAgent
    def create_app_builder() -> StatefulManagedAgent
    def create_page_builder() -> StatefulManagedAgent
    def create_agent_builder() -> StatefulManagedAgent
    def create_research_agent() -> StatefulManagedAgent
    def create_all_managed_agents() -> List[StatefulManagedAgent]
```

---

## 5. HITL Configuration

### Planning Intervals

| Agent | planning_interval | Behavior |
|-------|-------------------|----------|
| skill_builder | 2 | Interrupt after 2 steps |
| document_builder | 2 | Interrupt after 2 steps |
| schema_builder | 3 | Skip first, interrupt on second |
| app_builder | 3 | Interrupt after 3 steps |
| page_builder | 3 | Interrupt after 3 steps |
| agent_builder | 2 | Interrupt after 2 steps |
| table_builder | None | Autonomous (no interrupts) |
| research_agent | None | Read-only (no interrupts) |
| research_emery | None | Read-only (no interrupts) |

### Callback Patterns

**Simple Callback:**
```python
def step_callback(step):
    if isinstance(step, PlanningStep):
        raise AgentInterrupt("Plan requires approval")
```

Used by: skill_builder, document_builder, app_builder, page_builder, agent_builder

**Stateful Callback:**
```python
def create_stateful_callback():
    plan_count = 0
    def callback(step):
        nonlocal plan_count
        if isinstance(step, PlanningStep):
            plan_count += 1
            if plan_count >= 2:
                raise AgentInterrupt("Plan requires approval")
    return callback
```

Used by: schema_builder (skips first exploration plan)

### HITL Interrupt Flow

```
Agent PlanningStep
      │
      ▼
step_callbacks[PlanningStep] triggers
      │
      ▼
Raises AgentInterrupt("Plan requires approval")
      │
      ▼
InterruptAwareToolCallingAgent catches interrupt
      │
      ▼
Returns AwaitingInputDict to gRPC stream
      │
      ▼
UI shows ApprovalInputBar (Approve/Reject/Modify)
      │
      ▼
User responds → Agent resumes with reset=False (memory preserved)
```

---

## 6. Cascade Planning

For full cascade planning details, see [ORCHESTRATION_FLOW.md Section 11](./ORCHESTRATION_FLOW.md#11-recursive-cascade-planning).

### Quick Reference

| Setting | Value | Purpose |
|---------|-------|---------|
| **max_depth** | 3 | Maximum recursion levels |
| **confidence_threshold** | 0.7 | LLM classification confidence |
| **fallback** | Pattern matching | When LLM confidence low |

### Cascade Detection

When SubAgentPlanner encounters a plan step:

1. **LLM Classification** (TaskClassifier)
   - Analyzes step description
   - Returns agent name + confidence score
   - If confidence > 0.7, triggers cascade

2. **Pattern Matching Fallback**
   - Keywords: "page", "create page", "build page" → page_builder
   - Keywords: "research", "search", "look up" → research_agent

### Example Cascade

```
User: "Create a CRM app with a contacts page"

app_builder Plan:
├─ Step 1: Create CRM app
├─ Step 2: Create contacts page  ← Triggers cascade
│           │
│           └─► page_builder Sub-Plan:
│               ├─ Step 2.1: Research contact fields
│               ├─ Step 2.2: Create page structure
│               └─ Step 2.3: Add data table block
└─ Step 3: Publish app
```

---

## 7. Tool Assignments

### CRUD Tool Matrix

| Agent | skill_crud | document_crud | table_crud | field_crud | database_crud | app_crud | page_crud | agent_crud |
|-------|------------|---------------|------------|------------|---------------|----------|-----------|------------|
| skill_builder | via executor | - | - | - | - | - | - | - |
| document_builder | - | via executor | - | - | - | - | - | - |
| table_builder | - | - | via executor | via executor | - | - | - | - |
| schema_builder | - | - | via executor | via executor | via executor | - | - | - |
| app_builder | - | - | - | - | - | via executor | via executor | - |
| page_builder | - | - | - | - | - | - | **DIRECT** | - |
| agent_builder | via executor | - | - | - | - | - | - | via executor |

### Research Tools

| Agent | DuckDuckGoSearchTool | VisitWebpageTool | system_research_tool |
|-------|----------------------|------------------|---------------------|
| schema_builder | via executor | via executor | - |
| app_builder | via executor | via executor | - |
| page_builder | direct | direct | - |
| research_agent | direct | direct | - |
| research_emery | - | - | direct |

---

## 8. Key Files

| File | Purpose |
|------|---------|
| `grpc/agents/managed_agents_factory.py` | Central agent factory |
| `agents/stateful_managed_agent.py` | HITL state preservation (extends CodeAgent) |
| `agents/interrupt_aware_agent.py` | Interrupt propagation to parent |
| `agents/planning_utils.py` | Shared HITL callbacks |
| `services/sub_agent_planner.py` | Cascade planning orchestration |
| `services/plan_step_executor.py` | Execute plan steps |
| `services/task_classifier.py` | LLM step classification |
| `agents/skill_builder_agent.py` | Skill builder |
| `agents/document_builder_agent.py` | Document builder |
| `agents/table_builder_agent.py` | Table builder (autonomous) |
| `agents/schema_builder_agent.py` | Schema builder |
| `agents/app_builder_agent.py` | App builder |
| `agents/page_builder_agent.py` | Page builder |
| `agents/agent_builder_agent.py` | Agent builder |
| `agents/research_agent.py` | Web research |
| `agents/research_emery_agent.py` | Emery system research |
| `prompts/agents/*.j2` | Agent prompt templates |

---

## Related Documentation

- **[ORCHESTRATION_FLOW.md](./ORCHESTRATION_FLOW.md)** - State machines, event flows, cascade planning details
- **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** - High-level platform architecture, data flows
