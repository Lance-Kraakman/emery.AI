# Python Puck Template Generation

This directory contains Python code for programmatically generating Puck templates from data/analysis results.

## Overview

The puck generation module allows you to create Puck templates programmatically from your backend/analysis code, rather than building them manually in the UI.

## Files

- `puck_gen.py` - Main generation logic with helper functions
- `payload_client.py` - Client for saving templates (PayloadCMS-specific, needs adaptation)
- `__main__.py` - CLI entry point
- `__init__.py` - Package initialization

## Key Functions

### Component Generators

```python
generate_text_component(text: str, **kwargs) -> dict
generate_markdown_view_component(content: str, **kwargs) -> dict
generate_stats_component(workflow_id: str, output_key: str, **kwargs) -> dict
generate_debate_table_component(workflow_id: str, output_key: str, **kwargs) -> dict
```

### Template Generators

```python
generate_topic_template(topic_analysis, workflow_id) -> dict
generate_question_template(question_analysis, workflow_id) -> dict
generate_combined_template(analysis_result, workflow_id) -> dict
```

## Usage Example

```python
from puck_gen import generate_text_component, generate_stats_component

# Build a simple template
template = {
    "root": {"type": "root", "props": {"content": []}},
    "zones": {},
    "content": [
        generate_text_component(
            "Analysis Results",
            size="xl",
            align="center",
            weight="bold"
        ),
        generate_stats_component(
            workflow_id="workflow-123",
            output_key="charts.distribution",
        ),
    ]
}

# Save to your database/storage
# (adapt the payload_client.py for your backend)
```

## Integration with New Repo

You'll need to:

1. **Adapt the persistence layer** - Replace `payload_client.py` with your own database client
2. **Update data structures** - Modify generators to match your data schema
3. **Add new component generators** - Create functions for any custom components you build

## Component Output Format

Each generator produces a dict like:

```python
{
    "type": "ComponentName",
    "props": {
        "id": "ComponentName-<uuid>",
        # ... component-specific props
    }
}
```

## Notes

- This code is domain-specific to consultation analysis
- Use it as a **reference/starting point** for your own generation logic
- The template structure matches Puck's Data format exactly
