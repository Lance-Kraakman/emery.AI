"""
Evaluator Agent

Assesses task progress and determines next actions.
Uses TaskLedger state to make decisions about:
- Goal achievement
- Blocking issues
- Continuation
- Replanning needs

AIDEV-NOTE: Uses EvaluationTool pattern (like GapAnalysisTool) for structured
output instead of relying on JSON parsing from prompt instructions.
"""

import logging
from typing import Any, Callable, Dict, Optional, Tuple

from smolagents import Tool, ToolCallingAgent

logger = logging.getLogger(__name__)


class EvaluationTool(Tool):  # type: ignore[misc]
    """
    Tool for LLM to report evaluation results.

    The evaluator LLM calls this tool with structured assessment.
    This ensures reliable output without JSON parsing.
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "report_evaluation"
    description = """Report your evaluation of task execution progress.

After analyzing the goal and ledger state, call this tool with your assessment:
- goal_achieved: True if the original goal is fully accomplished
- blocking_issues: True if errors are preventing progress
- should_continue: True if more steps should be executed
- needs_replan: True if the current plan needs modification
- reason: Brief explanation of your assessment
"""

    inputs = {
        "goal_achieved": {
            "type": "boolean",
            "description": "True if the original goal has been fully accomplished",
        },
        "blocking_issues": {
            "type": "boolean",
            "description": "True if there are errors preventing progress",
        },
        "should_continue": {
            "type": "boolean",
            "description": "True if more steps should be executed",
        },
        "needs_replan": {
            "type": "boolean",
            "description": "True if the current plan needs modification",
        },
        "reason": {
            "type": "string",
            "description": "Brief explanation of the assessment",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.captured_result: Optional[Dict[str, Any]] = None

    def forward(
        self,
        goal_achieved: bool,
        blocking_issues: bool,
        should_continue: bool,
        needs_replan: bool,
        reason: str,
    ) -> str:
        """Capture the evaluation result."""
        self.captured_result = {
            "goal_achieved": goal_achieved,
            "blocking_issues": blocking_issues,
            "should_continue": should_continue,
            "needs_replan": needs_replan,
            "reason": reason,
        }
        logger.info(
            f"📊 Evaluation: goal_achieved={goal_achieved}, "
            f"blocking={blocking_issues}, continue={should_continue}"
        )
        return f"Evaluation recorded: goal_achieved={goal_achieved}, reason={reason[:50]}"

    def get_result(self) -> Optional[Dict[str, Any]]:
        """Retrieve captured result."""
        return self.captured_result

EVALUATOR_INSTRUCTIONS = """
You are an evaluation agent. Your job is to assess task execution progress.

## Input
You will receive:
- The original goal
- Current task ledger state (steps, results, failures)

## Your Task
Analyze the state and call the `report_evaluation` tool with your assessment.

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
Call report_evaluation with:
- goal_achieved=true, blocking_issues=false, should_continue=false, needs_replan=false
- reason="All steps completed successfully, goal accomplished"

### Continue execution
Call report_evaluation with:
- goal_achieved=false, blocking_issues=false, should_continue=true, needs_replan=false
- reason="2 of 5 steps completed, proceeding with remaining steps"

### Needs replan
Call report_evaluation with:
- goal_achieved=false, blocking_issues=false, should_continue=true, needs_replan=true
- reason="Step 3 failed due to missing table, need alternative approach"

### Blocked
Call report_evaluation with:
- goal_achieved=false, blocking_issues=true, should_continue=false, needs_replan=false
- reason="External API unavailable, cannot proceed without user intervention"

IMPORTANT: Always call the report_evaluation tool with your assessment. Do not respond with text only.
"""


def create_evaluator_agent(
    model: str,
    max_steps: int = 2,
) -> Tuple[ToolCallingAgent, EvaluationTool]:
    """
    Creates an agent for evaluating task progress.

    The evaluator assesses the current state of execution and determines
    whether to continue, stop, or trigger replanning.

    Uses EvaluationTool for structured output - the LLM calls the tool
    with its assessment instead of returning raw JSON.

    Args:
        model: Model identifier for the evaluator
        max_steps: Maximum steps for evaluation (default: 2 for tool call + finish)

    Returns:
        Tuple of (ToolCallingAgent, EvaluationTool) - tool captures structured result
    """
    logger.debug(f"Creating evaluator agent with model: {model}")

    evaluation_tool = EvaluationTool()

    agent = ToolCallingAgent(
        tools=[evaluation_tool],
        model=model,
        instructions=EVALUATOR_INSTRUCTIONS,
        max_steps=max_steps,
    )

    return agent, evaluation_tool


def create_evaluator_factory(
    model: str,
) -> Callable[[], Tuple[ToolCallingAgent, EvaluationTool]]:
    """
    Creates a factory function for evaluator agents.

    Useful for passing to ExecutionCoordinator as evaluator_factory.

    Args:
        model: Model identifier for evaluators

    Returns:
        Callable that creates (agent, tool) tuples
    """
    def factory() -> Tuple[ToolCallingAgent, EvaluationTool]:
        return create_evaluator_agent(model)

    return factory
