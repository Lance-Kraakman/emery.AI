# Emery Agent Prompting Guide

This guide documents the patterns and best practices for writing agent prompts in the Emery system.

## Directory Structure

```
prompts/
├── agents/           # Agent-specific prompts (16 files)
├── planning/         # Planning & orchestration prompts (11 files)
├── tools/            # Tool documentation
│   ├── emery/        # Emery CRUD operations
│   ├── categories/   # Integration categories (email, messaging)
│   └── integrations/ # External services (Gmail, Slack)
├── components/       # Shared reusable components
├── base/             # Base mode templates & critical rules
├── hitl/             # Human-in-the-loop recovery prompts
└── __init__.py       # Prompt loading & composition
```

---

## Agent Prompt Structure

All agent prompts follow this consistent structure:

### 1. Capabilities Block

```jinja2
{% block capabilities %}
- What this agent can do (action 1)
- Another capability (action 2)
- Data handling or output format
{% endblock %}
```

This block is used by `render_capabilities()` for agent descriptions.

### 2. Title & Role

```jinja2
## [Agent Name] Agent

**CRITICAL:** You are the [role description].
You [primary responsibility].
```

### 3. Include Shared Rules

```jinja2
{% set extra_rules = '4. **RULE NAME** - Description of agent-specific rule.' %}
{% include 'components/builder_rules.j2' %}
```

The `builder_rules.j2` provides three core rules:
1. **NEVER INVENT IDs** - Must list first to find numeric IDs
2. **TOOL OUTPUT IS TRUTH** - If tool returns FAILED, it failed
3. **VERIFY BEFORE CLAIMING SUCCESS** - Read back after create/update

### 4. Entity/Resource Documentation

```jinja2
### [Entity] Structure

| Field | Description |
|-------|-------------|
| id | Unique identifier (number) |
| name | Display name |
| ... | ... |
```

### 5. Tool Usage Section

```jinja2
### Tool Usage

```python
# List resources
tool_executor(tool="entity_crud", task="list entities")

# Create resource
tool_executor(tool="entity_crud", task="create entity with name='X', field='Y'")

# Read resource
tool_executor(tool="entity_crud", task="read entity with id=42")
```

**Important:** Always use two parameters: `tool` and `task` (natural language).
```

### 6. Workflow Section

```jinja2
### Workflow

**Step 1: Gather Context**
- List existing resources
- Understand the current state

**Step 2: Present Plan**
[Plan format - see below]

**Step 3: On Approval**
- Execute the plan
- Verify results
```

### 7. Plan Format

```jinja2
### Plan Format

```
# Plan: [Brief description]

## [Context]
- Resource: [name] (ID: X)

## Changes
1. [Step with specific details]
2. [Step with specific details]

Reply 'yes' to proceed.
```
```

### 8. Executor Mode Section

```jinja2
## Executor Mode (When Called by Parent Agent)

When receiving a task from [parent_agent] with detailed specifications:

1. **DO NOT ask additional questions** - specifications are complete
2. **Research first** - still need to get resource IDs
3. **Execute exactly as specified** - follow the requirements
4. **Report completion** - confirm what was created with IDs
```

---

## Agent Modes

### Planning Mode (HITL)

Used by: `schema_builder`, `app_builder`, `skill_builder`, `view_builder`, `system_designer`

**Characteristics:**
- Gathers context first (lists resources)
- Creates a plan in markdown format
- Waits for user approval ("yes")
- Executes only after approval
- Verifies results

**When to use:** Complex changes that modify data structure or create multiple resources.

### Executor Mode

Used by: `page_builder`, `table_builder` (when called by parent)

**Characteristics:**
- Receives complete specifications from parent agent
- Does NOT ask redundant questions
- Executes immediately
- Reports completion with IDs

**When to use:** When delegated to by a planning agent with full specifications.

### Autonomous Mode

Used by: `table_builder` (direct calls), `research_agent`

**Characteristics:**
- Executes directly without approval
- For simple, low-risk operations
- Read-only agents (research)

**When to use:** Simple operations or read-only research.

---

## Delegation Pattern

When an orchestrator delegates to a specialist:

### WRONG (too vague)
```python
page_builder.forward(task="Create a landing page")
```

### CORRECT (fully specified)
```python
page_builder.forward(task="""
Create Home page for app_id=5 with these exact specifications:

1. Hero Section (Hero block):
   - title: "Welcome to Our Service"
   - description: "Your trusted partner"
   - buttons: [{"text": "Get Started", "href": "/signup"}]

2. Features Section:
   - Heading: "Our Features" (h2, centered)
   - Grid (3 columns):
     * Card: title="Feature 1", description="..."
     * Card: title="Feature 2", description="..."
     * Card: title="Feature 3", description="..."
""")
```

**Key Principle:** The delegating agent provides WHAT to build; the specialist agent knows HOW.

---

## Critical Rules

These rules are enforced across ALL agents:

### 1. Never Invent IDs
```
WRONG: tool_executor(tool="field_crud", task="create field in table 'customers'")
RIGHT: tool_executor(tool="table_crud", task="list tables")  # Find ID first
       tool_executor(tool="field_crud", task="create field in table_id=42")
```

### 2. Tool Output Is Truth
```
If tool returns: "FAILED: Table not found"
Then: Report failure to user (don't claim success)

If tool returns: "table:created,42,Customers"
Then: Operation succeeded (can claim success)
```

### 3. Verify Before Claiming Success
```python
# After creating
tool_executor(tool="table_crud", task="create table 'Customers' in database_id=1")
# Verify
tool_executor(tool="table_crud", task="read table_id=42")
# Then report
"Created table 'Customers' (ID: 42)"
```

### 4. List → Read → Modify Workflow
```python
# 1. List to find IDs
tool_executor(tool="table_crud", task="list tables for database_id=1")

# 2. Read to understand current state
tool_executor(tool="table_crud", task="read table_id=42")

# 3. Modify with complete data
tool_executor(tool="field_crud", task="create field 'status' in table_id=42")
```

---

## Tool Documentation Pattern

Each tool in `tools/emery/` follows this structure:

```jinja2
## [tool_name] Tool - [Brief Description]

### Methods
| Method | Description | Required Params |
|--------|-------------|-----------------|
| list | List resources | (optional filters) |
| read | Get by ID | resource_id |
| create | Create new | data fields |
| update | Modify existing | resource_id, data |
| delete | Remove | resource_id |

### Examples

**List all:**
```python
tool_name(method="list")
```

**Create:**
```python
tool_name(method="create", data={
    "field1": "value1",
    "field2": "value2"
})
```

### Response Format (TOON)
- Success: `entity:action,id,name`
- Failure: `FAILED: error message`
```

---

## Response Patterns

### TOON Format (Tabular Object-Oriented Notation)

Tools return responses in this compact format:
```
entity:action,id,data...
page:created,7,Home,true
skill:updated,15,Research Skill
table:deleted,42,Customers
```

### Error Responses
```
FAILED: [error description]
ERROR: [error description]
```

### List Responses
```
entities[count]{fields}:data
tables[3]{id,name,fields_count}:42,Customers,5|43,Orders,8|44,Products,6
```

---

## Jinja2 Patterns

### Using Variables
```jinja2
{% set extra_rules = '4. **RESEARCH FIRST** - Always list before modifying.' %}
{% include 'components/builder_rules.j2' %}
```

### Conditional Content
```jinja2
{% if managed_agents %}
### Available Sub-Agents
{% for agent in managed_agents %}
- **{{ agent.name }}**: {{ agent.description }}
{% endfor %}
{% endif %}
```

### Template Inheritance
```jinja2
{% extends 'shared/agent_base.j2' %}

{% block agent_specific %}
## Agent-specific content here
{% endblock %}
```

---

## Orchestration Levels

### Level 1: Simple/Autonomous
```
User request → Execute → Verify → Done
```
Example: `table_builder` adding a single field

### Level 2: HITL Planning
```
User request → Gather context → Create plan → Wait approval → Execute → Verify → Done
```
Example: `schema_builder` designing a database schema

### Level 3: Cascade Planning
```
User request → Research → Create architecture → Wait approval
→ Delegate to specialists (each does their HITL) → Collect results → Done
```
Example: `system_designer` building a complete automation system

---

## Agent Hierarchy

```
system_designer (Top-Level Orchestrator)
├── research_agent (combined web + system research)
│   └── research_emery (system introspection)
├── schema_builder (HITL)
│   └── table_builder (autonomous)
├── app_builder (HITL)
│   ├── page_builder (executor)
│   └── view_builder (HITL)
├── agent_builder (HITL)
└── skill_builder (HITL)
```

---

## Common Anti-Patterns

### Don't: Create empty placeholders
```
WRONG: "I'll create a page with placeholder content"
RIGHT: Ask about content requirements first, then create with real content
```

### Don't: Invent schema without tools
```
WRONG: "Here's what a CRM schema might look like: [theoretical design]"
RIGHT: List existing tables, propose plan in Emery terms, wait for approval
```

### Don't: Use SQL terminology
```
WRONG: "CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(255))"
RIGHT: "Create table 'customers' with fields: name (text), email (email)"
```

### Don't: Guess field types
```
WRONG: "I'll create a 'status' field as text"
RIGHT: Check requirements - if it's pick-one-from-list, use single-select
```

---

## Field Type Selection Guide

| If the field is... | Use Type |
|-------------------|----------|
| Yes/No question | boolean |
| Pick ONE from fixed list | single-select |
| Pick MULTIPLE from list | multi-select |
| Free-form short text | text |
| Long-form content | long-text |
| Email address | email |
| Phone number | phone |
| URL/link | url |
| Date only | date |
| Date and time | datetime |
| Whole number | number |
| Decimal/currency | decimal |
| Reference to another table | link |
| Auto-generated ID | uuid (usually auto) |

---

## Checklist for New Agent Prompts

- [ ] Has `{% block capabilities %}` for description
- [ ] Includes `components/builder_rules.j2` with any extra rules
- [ ] Documents entity structure (table format)
- [ ] Shows tool usage with correct two-parameter syntax
- [ ] Defines clear workflow (context → plan → execute)
- [ ] Includes plan format for HITL agents
- [ ] Has Executor Mode section if can be delegated to
- [ ] Lists common errors and how to handle them
- [ ] Provides realistic examples

---

## File Naming Conventions

- Agent prompts: `agents/[agent_name].j2`
- Tool docs: `tools/emery/[tool_name].j2`
- Components: `components/[component_name].j2`
- Planning: `planning/[stage_name].j2`
- Base templates: `base/[template_name].j2`
- Capability templates: `capabilities/[capability_name]/[mode].j2`

---

## Capability-Agnostic Architecture

Agent prompts should NOT contain hardcoded domain knowledge (field types, etc.).
Domain-specific guidance comes from capability templates.

### Template Locations

```
capabilities/
├── schema_builder/
│   ├── planning.j2      # Planning guidance for the planner
│   └── execution.j2     # Runtime instructions for the agent
├── skill_builder/
│   ├── planning.j2
│   └── execution.j2
└── ...
```

### How It Works

1. `Capability.to_summary()` loads `capabilities/{name}/planning.j2`
2. Returns it as `planning_instructions` in the summary
3. `step_planner.j2` renders `{{ cap.planning_instructions }}`
4. Planner sees domain-specific guidance without hardcoding

### Example: schema_builder

The file `capabilities/schema_builder/planning.j2` contains:
- Emery field types (text, number, email, boolean, single-select, etc.)
- Examples of proper step format
- Anti-patterns (never use SQL types like INT, VARCHAR)

This keeps the planner generic while capabilities provide domain context.

### Adding New Capabilities

1. Create `capabilities/[name]/planning.j2` with planning guidance
2. Create `capabilities/[name]/execution.j2` with runtime instructions
3. Register capability in `managed_agents_factory.py`
4. Planner automatically discovers and uses the guidance

---

## Think vs Ask Decision Tree

Before asking the user a question, follow this decision tree:

```
User provides vague requirement
        │
        ├─ Did they delegate? ("you decide", "what do you think", "generate some")
        │   └─ YES → Research capability guidance, propose solution
        │
        ├─ Can workspace context help? (existing tables show patterns)
        │   └─ YES → Use existing patterns as reference, propose solution
        │
        ├─ Can discovery/research help?
        │   └─ YES → Use search_org(), get_capability(), then propose
        │
        ├─ Are there multiple valid approaches?
        │   └─ YES → Briefly explain tradeoffs, recommend one
        │
        └─ Still truly unclear?
            └─ YES → Ask clarifying question WITH EXAMPLES
```

### Delegation Phrases (Use Defaults)

These phrases mean the user wants YOU to decide:
- "make something up", "anything", "you pick", "you decide"
- "what do you think", "what would you suggest", "you suggest"
- "generate some", "create some", "come up with"
- "typical", "standard", "default", "common"
- "figure it out", "use your judgment"

### When to Think/Research

- User says "create a [domain] database" → Research capabilities + workspace context for patterns
- User says "what do you suggest" → Use get_capability() to get field types, then propose
- User references external system → Research that system
- User asks about existing resources → Use system_research tool
- User delegates ("you decide") → Research, then propose based on capability guidance

### When to Ask

- Security implications ("should this data be encrypted?")
- Business rules unclear ("what triggers this workflow?")
- Destructive operations ("delete all records?")
- User explicitly asks ("which approach should we use?")
- No capability guidance available and no workspace patterns to reference

### How to Ask (With Examples)

**Always provide concrete examples, not abstract categories.**

```
WRONG:
"What would you like help with?"
Options: ["Build an automation", "Create tables", "Create an app"]

RIGHT:
"What would you like help with?"
Options: [
  "Send notifications when something happens (e.g., email on new order)",
  "Track and manage data (e.g., customers, projects, inventory)",
  "Generate reports or summaries",
  "Something else"
]
```

**Follow-up questions should also include suggestions:**

```
WRONG:
"What kind of automation would you like to build?"

RIGHT:
"What would you like to automate? For example: notify team on new orders,
send weekly reports, sync data between tables, remind about overdue tasks."
```

### Re-evaluate Intent on Every Message

When a user responds to a clarification with a NEW question (instead of selecting an option), you MUST:
1. Recognize it as a new task type
2. Handle the new task type appropriately
3. Do NOT repeat the previous clarification

```
WRONG:
Agent: "What would you like help with?" [options: A, B, C]
User: "what can you do?"
Agent: "What would you like help with?" ← WRONG - repeated clarification

RIGHT:
Agent: "What would you like help with?" [options: A, B, C]
User: "what can you do?"
Agent: "I can help you with: [discovered capabilities list]" ← CORRECT - answered question
```

**How to handle "what can you do?":**
Use `search_org("")` with an empty query to discover all enabled capabilities, then summarize them for the user.

---

## Propose with Defaults Pattern

Instead of asking open-ended questions, propose a solution with defaults.

### WRONG (Endless Question Loop)

```
Agent: "What fields should the Projects table have?"
User: "generate some for me"
Agent: "What fields do you think are necessary for the Projects table?" ← WRONG
```

### RIGHT (Propose with Defaults)

```
Agent: "What fields should the Projects table have?"
User: "generate some for me"

# Agent flow:
# 1. Uses discovery tools to find relevant capability
# 2. Gets capability guidance for valid field types
# 3. Checks workspace context for existing patterns
# 4. Proposes based on guidance

Agent: "I'll create a Projects table with these fields:
- name (text) - Project title
- description (text) - Details about the project
- status (single-select: Active, Completed, On Hold)
- due_date (date) - Target completion date
- priority (single-select: High, Medium, Low)

Reply 'yes' to proceed, or let me know what changes you'd like."
```

### Key Principles

1. **Research first** - Call get_capability() to understand valid field types before proposing
2. **Use workspace context** - Check existing tables to understand domain patterns
3. **Always have a default** - Never ask without offering an answer
4. **Allow customization** - User can modify the proposal
5. **Be specific** - Include actual field names and types from capability guidance

### Deriving Defaults (Capability-Agnostic)

Instead of hardcoded domain templates, derive defaults from:

1. **Capability guidance** - `get_capability("agent:schema_builder")` returns:
   - Valid field types (text, number, single-select, date, relation, etc.)
   - Examples of proper field definitions
   - Anti-patterns to avoid

2. **Workspace context** - Existing tables show:
   - What domain the user is working in
   - Naming patterns they prefer
   - Field structures already established

3. **Logical field structure** - For any entity, consider:
   - Name/title field (text)
   - Description/notes (text)
   - Status tracking (single-select)
   - Key dates (date fields)
   - Relations to other entities (relation type)
