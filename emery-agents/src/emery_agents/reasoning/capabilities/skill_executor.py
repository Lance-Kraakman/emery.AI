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

### Tools Used by This Capability
The executor uses: **skill_crud**.
- skill_crud with method='execute': Execute an existing skill by ID
- skill_crud with method='list': List available skills (for discovery)
Set tool_call="skill_crud".

### Important

- ALWAYS use skill_crud(method='execute') — do NOT try to replicate the skill's logic manually
- The skill has its own instructions, tools, and model — just execute it by ID
- Pass data={} if no explicit inputs are needed

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every skill_executor step description:
1. **SKILL NAME**: Exact name in quotes
2. **SKILL ID**: If known from workspace_context, include it. If not, add a Discovery step first.
3. **METHOD**: Always skill_crud(method='execute', skill_id=...)
4. **INPUTS**: If the skill takes inputs, include data={...} with concrete values
5. **OUTCOME**: What the executor should verify

**Step description templates:**

Execute with known ID:
"Execute skill '[name]' (skill_id=[ID]) using skill_crud(method='execute', skill_id=[ID]). Inputs: data={'[key]': '[value]'}. Verify: skill executed successfully."

Execute without known ID (two steps):
Step 1: "List available skills using skill_crud(method='list') to find the skill ID for '[skill_name]'. Verify: skill found."
Step 2: "Execute skill '[name]' using skill_crud(method='execute', skill_id=<ID from step 1>). Verify: skill executed successfully."
(Step 2 must have required_context referencing Step 1.)

BAD: "Run the summary skill"
GOOD: "Execute skill 'generate-summary' (skill_id=42) using skill_crud(method='execute', skill_id=42, data={'topic': 'Q4 financials'}). Verify: skill executed successfully."
"""
