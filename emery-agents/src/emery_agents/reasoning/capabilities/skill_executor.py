"""
Planning guidance for skill_executor capability.

This handles EXECUTING existing skills, not creating new ones.
For skill creation, see skill_builder.py.
"""

PLANNING_GUIDANCE = """
## Skill Executor (agent:skill_executor)

**Choose when**: User wants to RUN, EXECUTE, or TRIGGER an existing skill.
**Examples**: "run my generate-summary skill", "execute the weekly-report skill",
"trigger send-welcome-email", "use my data-cleanup skill"

**DO NOT choose when**: User wants to CREATE, BUILD, or MODIFY a skill → use skill_builder instead.

### How Skill Execution Works

The executor has a `skill_crud` tool with `method='execute'`. Your plan step must
instruct the executor to call it with the correct skill_id.

### Finding the Skill ID

1. CHECK workspace_context — existing skills are listed with {name, id, description}
2. Match the user's skill name to an existing skill
3. If the skill is not in workspace_context, add a Discovery step using
   skill_crud(method='list') first, then execute by ID

### Step Format

Use target_agent='skill_executor' and include the skill_id and any inputs
in the description.

When skill ID is known from workspace_context:
- description: "Execute skill 'generate-summary' (skill_id=42) using skill_crud(method='execute', skill_id=42). No additional inputs needed."
- target_agent: "skill_executor"

When the user provides inputs:
- description: "Execute skill 'generate-summary' (skill_id=42) using skill_crud(method='execute', skill_id=42, data={'topic': 'Q4 financials'})"
- target_agent: "skill_executor"

When skill ID is NOT known:
Step 1 (Discovery):
- description: "List available skills using skill_crud(method='list') to find the skill ID for 'generate-summary'"
- phase_name: "Discovery"

Step 2 (Execution):
- description: "Execute the matched skill using skill_crud(method='execute', skill_id=<ID from step 1>)"
- target_agent: "skill_executor"
- required_context: ["step_1_..."]

### Important

- ALWAYS use skill_crud(method='execute') — do NOT try to replicate the skill's logic manually
- The skill has its own instructions, tools, and model — just execute it by ID
- Pass data={} if no explicit inputs are needed
"""
