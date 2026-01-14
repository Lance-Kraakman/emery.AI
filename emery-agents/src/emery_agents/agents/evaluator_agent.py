"""
Evaluator Agent

Assesses task progress and determines next actions.
Uses TaskLedger state to make decisions about:
- Goal achievement
- Blocking issues
- Continuation
- Replanning needs
"""

import logging
from typing import Optional

from smolagents import ToolCallingAgent

logger = logging.getLogger(__name__)

EVALUATOR_INSTRUCTIONS = """
You are an evaluation agent. Your job is to assess task execution progress.

## Input
You will receive:
- The original goal
- Current task ledger state (steps, results, failures)
- Recent step results

## Output
Respond with JSON only - no other text:
```json
{
    "goal_achieved": true/false,
    "blocking_issues": true/false,
    "should_continue": true/false,
    "needs_replan": true/false,
    "reason": "brief explanation"
}
```

## Decision Rules

### goal_achieved
Set to `true` if:
- The original goal has been fully accomplished
- All required outcomes have been achieved
- No further steps are needed to meet the goal

### blocking_issues
Set to `true` if:
- There are errors preventing progress
- Required dependencies are missing
- External services are unavailable
- User intervention is required

### should_continue
Set to `true` if:
- More steps remain to be executed
- The goal is not yet achieved
- No blocking issues prevent progress

### needs_replan
Set to `true` if:
- A step has failed and requires a different approach
- The current plan cannot achieve the goal
- Unexpected conditions require plan modification

## Examples

### Goal achieved
```json
{
    "goal_achieved": true,
    "blocking_issues": false,
    "should_continue": false,
    "needs_replan": false,
    "reason": "All steps completed successfully, goal accomplished"
}
```

### Continue execution
```json
{
    "goal_achieved": false,
    "blocking_issues": false,
    "should_continue": true,
    "needs_replan": false,
    "reason": "2 of 5 steps completed, proceeding with remaining steps"
}
```

### Needs replan
```json
{
    "goal_achieved": false,
    "blocking_issues": false,
    "should_continue": true,
    "needs_replan": true,
    "reason": "Step 3 failed due to missing table, need alternative approach"
}
```

### Blocked
```json
{
    "goal_achieved": false,
    "blocking_issues": true,
    "should_continue": false,
    "needs_replan": false,
    "reason": "External API unavailable, cannot proceed without user intervention"
}
```
"""


def create_evaluator_agent(
    model: str,
    max_steps: int = 1,
) -> ToolCallingAgent:
    """
    Creates an agent for evaluating task progress.

    The evaluator assesses the current state of execution and determines
    whether to continue, stop, or trigger replanning.

    Args:
        model: Model identifier for the evaluator
        max_steps: Maximum steps for evaluation (default: 1)

    Returns:
        ToolCallingAgent configured for evaluation
    """
    logger.debug(f"Creating evaluator agent with model: {model}")

    return ToolCallingAgent(
        tools=[],  # No tools - evaluation only
        model=model,
        system_prompt=EVALUATOR_INSTRUCTIONS,
        max_steps=max_steps,
    )


def create_evaluator_factory(model: str):
    """
    Creates a factory function for evaluator agents.

    Useful for passing to ExecutionCoordinator as evaluator_factory.

    Args:
        model: Model identifier for evaluators

    Returns:
        Callable that creates evaluator agents
    """
    def factory() -> ToolCallingAgent:
        return create_evaluator_agent(model)

    return factory
