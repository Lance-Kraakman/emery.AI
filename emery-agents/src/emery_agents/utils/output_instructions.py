"""
Output Instructions Builder

Generates output capture instructions for skills with output mappings.
"""

from typing import Any, Dict, List, Optional


def render_output_instructions(
    skill_outputs: List[Any],
    target_field_metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Render output capture instructions for agent mode skills.

    Args:
        skill_outputs: List of skill output objects (proto or dict format)
        target_field_metadata: Optional dict mapping output_name -> target field info

    Returns:
        Rendered output instructions string
    """
    if not skill_outputs:
        return ""

    target_metadata = target_field_metadata or {}

    # Convert outputs to dicts
    outputs = []
    for output in skill_outputs:
        if hasattr(output, 'name'):
            name = output.name
            output_type = getattr(output, 'type', 'text') or 'text'
            description = getattr(output, 'description', '') or ''
        elif isinstance(output, dict):
            name = output.get('name', '')
            output_type = output.get('type', 'text') or 'text'
            description = output.get('description', '') or ''
        else:
            continue

        target = target_metadata.get(name, {})
        outputs.append({
            'name': name,
            'type': output_type,
            'description': description,
            'target': target,
        })

    if not outputs:
        return ""

    # Build submit_result signature
    params = ",\n".join(f"    {o['name']}=<value or null>" for o in outputs)

    # Build output descriptions
    output_lines = []
    for output in outputs:
        name = output['name']
        target = output.get('target', {})
        field_type = target.get('field_type', output['type'])
        options = target.get('options', [])
        max_selections = target.get('max_selections')
        description = output.get('description', '')

        line = f"- **{name}** ({field_type})"

        if field_type == 'single-select' and options:
            line += f"\n  -> One of: {', '.join(options)}, or null"
        elif field_type == 'multi-select' and options:
            max_note = f" (max {max_selections})" if max_selections else ""
            line += f"\n  -> Array from: {', '.join(options)}{max_note}, or null"
        elif field_type in ('number',) or output['type'] == 'number':
            line += "\n  -> Number or null"
        elif field_type in ('boolean',) or output['type'] == 'boolean':
            line += "\n  -> true/false or null"
        elif field_type in ('date',) or output['type'] == 'date':
            line += "\n  -> YYYY-MM-DD or null"
        elif field_type in ('email',) or output['type'] == 'email':
            line += "\n  -> Email or null"
        elif field_type in ('phone',) or output['type'] == 'phone':
            line += "\n  -> E.164 (+61...) or null"
        elif field_type in ('json',) or output['type'] == 'json':
            line += "\n  -> JSON or null"
        elif description:
            line += f"\n  -> {description}, or null"
        else:
            line += "\n  -> or null if not in input"

        output_lines.append(line)

    outputs_section = "\n".join(output_lines)

    return f"""## Output Submission Required

**Call only ONE tool at a time. Wait for the observation before calling another.**

EXTRACTION RULES:
- ONLY use data explicitly stated in the input
- Use `null` if data is not found (never make up values)
- Never use placeholders like "N/A" or "unknown"

### Call `submit_result`:
```
submit_result(
{params}
)
```

### Outputs:
{outputs_section}

After `submit_result` succeeds, call `final_answer`.
"""
