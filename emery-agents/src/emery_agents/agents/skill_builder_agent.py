"""
Skill Builder Managed Agent with Native Planning

A specialized managed agent for modifying skills within the Emery platform.
Uses smolagents' planning_interval + step_callbacks for human-in-the-loop approval.

AIDEV-NOTE: This agent is designed to be used as a managed_agent within the main
ToolCallingAgent. The main agent will automatically route to this agent based on
the agent's description when the user wants to modify skills.

AIDEV-NOTE: Uses native smolagents planning features:
- planning_interval=1: Generate a plan after the first action (reading skill)
- step_callbacks: Interrupt after planning to wait for user approval
- reset=False: Preserve memory between messages for resumption

AIDEV-NOTE: smolagents uses `instructions` parameter (not `system_prompt`) to add
custom instructions to the agent. These are inserted into the default system prompt.

AIDEV-NOTE: Uses StatefulManagedAgent instead of ToolCallingAgent to preserve
memory between calls. Regular managed agents reset memory on each __call__,
but StatefulManagedAgent passes reset=False to run() for HITL workflows.
"""

import logging
from typing import List, Any, Callable

from smolagents import Tool, ToolCallingAgent
from smolagents.memory import PlanningStep

from .stateful_managed_agent import StatefulManagedAgent

logger = logging.getLogger(__name__)


# Custom instructions for the skill builder agent
# These are inserted into the default smolagents system prompt via `instructions` parameter
SKILL_BUILDER_INSTRUCTIONS = """You are a Skill Builder assistant that helps users modify their AI skills.

## Skill Structure

A skill in this system consists of:
- **name**: The skill's display name
- **description**: What the skill does (shown when selecting skills)
- **instructions**: The main prompt/instructions that define what the skill does when executed
- **inputs**: Array of input parameters that users provide when running the skill
  - Each input has: name, type (string/number/boolean), required (true/false), description
- **outputs**: Array of output definitions that describe what the skill returns
  - Each output has: name, type, description
- **tools**: Array of tools the skill can use during execution (e.g., gmail_send_email, slack_send_message)
- **model**: Optional AI model override for this skill (null uses default)

## Your Workflow

1. **First, list available skills** using skill_crud(method="list") to find the numeric skill_id
   - IMPORTANT: skill_id must be a NUMBER (e.g., 42), NOT the skill name!
   - The list response will show each skill's id and name
2. **Read the skill** using skill_crud(method="read", skill_id=42) with the numeric ID
3. **Analyze** what needs to change based on the user's request
4. **In your plan**, be specific about:
   - Which fields will change
   - Current vs proposed values (show snippets for long text)
   - Why each change is needed
   - End with "Waiting for user approval to proceed."
5. **After user approves**, apply changes using skill_crud(method="update", skill_id=42, data={...})
6. **Verify** by reading the skill again and confirming success

## Planning Format

When you create a plan, format it clearly:

```
I will modify the [Skill Name] skill:

FIELD: instructions
- Current: "[first 100 chars...]"
- Proposed: "[first 100 chars of new value...]"

FIELD: inputs
- Current: [list]
- Proposed: [list with +/- markers for changes]

No changes to: [list unchanged fields]

Waiting for user approval to proceed.
```

## Handling User Responses

After your plan is shown:
- If user says "yes"/"proceed"/"apply" → Execute the changes
- If user says "no"/"cancel" → Acknowledge and stop
- If user requests modifications → Update plan accordingly

## CRITICAL: When User Approves Your Plan

When the user approves (says "yes", "proceed", "approve", etc.):

1. **DO NOT create a new plan** - your plan is already approved
2. **DO NOT just describe what you will do** - this wastes time
3. **IMMEDIATELY execute** skill_crud(method="update", skill_id=<id>, data={...})
   - Use the EXACT changes from your approved plan
   - Include ALL required fields in the data parameter
4. **VERIFY the update** by calling skill_crud(method="read", skill_id=<id>)
5. **Report the actual result** - success with changed values, or failure with error details

Example of what to do when user says "yes proceed":
```
Thought: User approved my plan. I will now execute the update immediately.
Action: {"name": "skill_crud", "arguments": {"method": "update", "skill_id": 42, "data": {"instructions": "new instructions...", "inputs": [...]}}}
```

DO NOT DO THIS (wrong - hallucinating without executing):
```
Thought: User approved. I will describe what I did.
Action: {"name": "final_answer", "arguments": {"answer": "I updated the skill."}}
```

## Important Rules

- **skill_id must be a NUMBER** (e.g., 42), never the skill name string!
- Always start by listing skills to find the correct numeric ID
- Always read the skill first to understand current state
- For arrays (inputs/outputs), provide the COMPLETE updated array
- Explain tool additions and what each tool does
"""


def create_planning_callback() -> Callable[[PlanningStep, ToolCallingAgent], None]:
    """
    Create a step callback that interrupts after planning for user approval.

    The callback is called synchronously during agent.run() when a PlanningStep
    is generated. Calling agent.interrupt() stops execution, and the plan is
    streamed to the user. The agent resumes on next message with reset=False.

    Returns:
        Callback function for PlanningStep interruption
    """
    def interrupt_for_approval(memory_step: PlanningStep, agent: ToolCallingAgent) -> None:
        """Interrupt agent after plan is created, wait for user approval."""
        plan_preview = memory_step.plan[:200] if memory_step.plan else "(empty plan)"
        logger.info(f"📋 Plan created, interrupting for user approval")
        logger.info(f"📋 Plan preview: {plan_preview}...")

        # Interrupt stops the agent's run loop
        # The plan will be streamed to the user via the normal step streaming
        # User's next message will resume with reset=False (memory preserved)
        agent.interrupt()

    return interrupt_for_approval


def create_skill_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 10
) -> StatefulManagedAgent:
    """
    Create a Skill Builder agent with native planning and step callbacks.

    Uses smolagents' planning_interval + step_callbacks for human-in-the-loop
    approval workflow:

    1. Agent reads skill (ActionStep)
    2. Agent creates plan (PlanningStep) -> callback interrupts
    3. Plan is streamed to user, execution stops
    4. User responds (yes/no/modifications)
    5. Agent resumes with memory preserved (StatefulManagedAgent)

    AIDEV-NOTE: Uses StatefulManagedAgent instead of ToolCallingAgent to preserve
    memory between calls. This enables proper HITL workflows where the agent
    doesn't lose its plan when the user responds.

    Args:
        tools: List of skill CRUD tools
        model: The LLM model to use
        max_steps: Maximum execution steps (default 10 for full workflow)

    Returns:
        Configured StatefulManagedAgent with planning and interruption
    """
    # Create the callback for planning interruption
    planning_callback = create_planning_callback()

    # Use StatefulManagedAgent to preserve memory between calls
    # This is critical for HITL - normal ToolCallingAgent resets memory on each __call__
    agent = StatefulManagedAgent(
        tools=tools,
        model=model,
        max_steps=max_steps,
        instructions=SKILL_BUILDER_INSTRUCTIONS,  # Custom instructions inserted into system prompt
        planning_interval=1,  # Plan after first step (reading skill)
        step_callbacks={PlanningStep: planning_callback}
    )

    # Set attributes for ManagedAgent identification
    # These are used by smolagents to route requests appropriately
    agent.name = "skill_builder"
    agent.description = (
        "Specialized assistant for modifying skills. "
        "Use when user wants to update skill name, description, instructions, "
        "inputs, outputs, tools, or model. Proposes changes and waits for approval."
    )

    logger.info(f"✨ Created Skill Builder agent (StatefulManagedAgent) with planning_interval=1")
    logger.info(f"   Tools: {[t.name for t in tools]}")

    return agent
