# Schema System

This directory contains JSON Schema files for agents and tools.

## Directory Structure

```
schemas/
├── agents/                    # Agent capability schemas
│   ├── schema_builder.schema.json
│   ├── app_builder.schema.json
│   └── skill_builder.schema.json
├── tools/                     # Tool I/O schemas
│   ├── emery/                 # Emery platform tools
│   │   ├── field_crud.schema.json
│   │   ├── row_crud.schema.json
│   │   └── table_crud.schema.json
│   └── integrations/          # External integrations
│       └── (slack.schema.json, etc.)
└── README.md
```

## Schema Hierarchy

The planning system uses a three-level hierarchy:

```
DOMAIN PLANNER (routes to agents)
    ↓
AGENT (has capability schema)
    ↓
TOOLS (have I/O schemas)
```

### Domain Planners

Domain planners use **agent capability schemas** to decide which agent to route to.
They generate steps like:
```python
Step(description="Create customers table", target_agent="schema_builder")
```

### Agents

Agents have capability schemas that describe what they can CREATE/DO.
These schemas are loaded when agents are created and included in their prompts.

### Tools

Tools have I/O schemas that describe exact parameters and returns.
These are used by agents during execution for proper tool invocation.

## Usage

```python
from emery_agents.prompts.schema_loader import (
    load_agent_schema,
    render_agent_capabilities,
    load_tool_schema,
    render_tool_io,
)

# Load raw schema
schema = load_agent_schema("schema_builder")

# Render as markdown for prompts
capabilities = render_agent_capabilities("schema_builder")

# Tool I/O documentation
tool_io = render_tool_io("field_crud", category="emery")
```

## Schema Format

### Agent Capability Schema

```json
{
  "name": "agent_name",
  "description": "What this agent does",
  "capabilities": {
    "capability_name": {
      "description": "What this capability does",
      "inputs": {
        "param_name": {
          "type": "string",
          "required": true,
          "description": "Parameter description"
        }
      },
      "outputs": {
        "result_name": {"type": "string"}
      }
    }
  },
  "definitions": {
    "shared_type": { ... }
  }
}
```

### Tool I/O Schema

```json
{
  "name": "tool_name",
  "description": "What this tool does",
  "operations": {
    "operation_name": {
      "description": "What this operation does",
      "inputs": { ... },
      "outputs": { ... },
      "errors": ["ERROR_CODE_1", "ERROR_CODE_2"]
    }
  }
}
```
