# Pre-Prompt Generation for Skills

## Overview

This document outlines future enhancement ideas for pre-generating executor prompts during plan generation. Currently, plans contain step descriptions that are interpreted at runtime by executor agents. Pre-generating prompts would move prompt construction to plan generation time, enabling:

1. **Faster execution** - No prompt generation at runtime
2. **Better UX** - Users can preview exact prompts before execution
3. **Prompt editing** - Users can modify prompts before running
4. **Consistency** - Same prompts run every time the skill executes

## Current Flow

```
Plan Generation → Step Descriptions → [Runtime] → Executor Prompt → LLM Call
```

Each step has a text `description` that an executor agent interprets at runtime to determine tool calls and actions.

## Proposed Flow

```
Plan Generation → Pre-generated Prompts → [Runtime] → Direct LLM Call
```

Prompts are generated during planning phase and stored with each step.

## Challenge: Conditional Branching

The main challenge is handling **conditional logic** in plans:

- "If table exists, update it; otherwise create it"
- "For each row in results, process..."
- "If validation fails, retry with different parameters"

Pre-generating prompts for all branches creates complexity.

## Approach Options

### Option A: Flat Plans Only (No Branching)

Only support linear plans without conditionals. Simple but limiting.

**Pros**: Easy to implement, deterministic
**Cons**: Can't handle dynamic workflows

### Option B: Branch Templates

Pre-generate prompts for all possible branches:

```json
{
  "step_id": "check_table",
  "branches": {
    "table_exists": {
      "prompt": "Update table {{table_id}} with..."
    },
    "table_not_exists": {
      "prompt": "Create table {{table_name}} with..."
    }
  }
}
```

**Pros**: All prompts visible upfront
**Cons**: Exponential growth with nested conditions

### Option C: Prompt Templates with Runtime Resolution

Store prompts as templates with placeholders resolved at runtime:

```json
{
  "prompt_template": "Process {{result_count}} results from {{previous_step_output}}",
  "requires": ["result_count", "previous_step_output"]
}
```

**Pros**: Flexible, handles dynamic data
**Cons**: Still requires runtime processing

### Option D: Jinja2 Templates (Recommended)

Use Jinja2 for prompt templates, matching existing template system:

```jinja2
{% if table_exists %}
Update table {{table_id}} by adding field {{field_name}}.
{% else %}
Create new table {{table_name}} with fields: {{field_list}}.
{% endif %}

Context from previous steps:
{{ previous_results | tojson }}
```

**Pros**:
- Consistent with existing template system
- Full conditional logic support
- User-editable with familiar syntax
- Renders to final prompt at execution

**Cons**:
- Users need to understand Jinja2 for editing
- Template validation needed

## Implementation Notes

### Step Schema Extension

```python
class PlanStep:
    step_id: str
    description: str  # Human-readable
    prompt_template: Optional[str]  # Jinja2 template
    required_context: List[str]  # Variables needed from previous steps
    target_agent: Optional[str]
```

### Execution Flow

1. **Plan Generation**: Generate both `description` (for display) and `prompt_template` (for execution)
2. **Plan Approval**: User sees descriptions, can optionally view/edit templates
3. **Execution**: Render template with context from previous steps, execute

### Context Accumulation

Each step execution adds to a context dict:

```python
execution_context = {
    "step_1_result": {...},
    "step_2_result": {...},
    "tables_found": [...],
    "skill_inputs": {...},  # From runtime inputs
}
```

Templates can reference any context:

```jinja2
Based on research findings:
{{ step_1_result.summary }}

Create table with these fields:
{% for field in step_2_result.suggested_fields %}
- {{ field.name }}: {{ field.type }}
{% endfor %}
```

## Future Considerations

1. **Prompt Library** - Reusable prompt templates for common operations
2. **Prompt Versioning** - Track changes to prompts over time
3. **A/B Testing** - Compare different prompt variations
4. **Prompt Optimization** - Auto-improve prompts based on execution results

## Status

This is a **future enhancement**. Current system uses:
- Step descriptions interpreted at runtime
- Executor agents determine tool calls dynamically
- Works well for most use cases

Pre-prompt generation should be considered when:
- Users request prompt preview/editing capabilities
- Execution speed becomes a bottleneck
- Deterministic execution is critical
