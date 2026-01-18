"""
Interrupt Classifier

Classifies user interrupts during plan execution to determine appropriate action.
Uses LLM-based classification instead of keyword matching for intelligent handling.

Classification categories:
- CONTEXT_ADD: User provides additional info/clarification - continue with new context
- SCOPE_CHANGE: User wants to change direction - requires replanning
- CANCEL: User wants to stop execution entirely
"""

import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple

from smolagents import Tool, ToolCallingAgent

logger = logging.getLogger(__name__)


@dataclass
class InterruptClassification:
    """Result of subagent-based interrupt classification."""
    classification: str  # CONTEXT_ADD | SCOPE_CHANGE | CANCEL
    requires_replan: bool
    is_cancel: bool
    reasoning: str
    suggested_action: Optional[str] = None


class InterruptClassificationTool(Tool):  # type: ignore[misc]
    """
    Tool for LLM to report interrupt classification.

    The classifier LLM calls this tool with structured classification.
    This ensures reliable output without JSON parsing.
    """

    skip_forward_signature_validation = True

    name = "report_classification"
    description = """Report your classification of the user interrupt.

After analyzing the interrupt message in context of the current plan, call this tool:
- classification: "CONTEXT_ADD" | "SCOPE_CHANGE" | "CANCEL"
- reasoning: Brief explanation of why you chose this classification
- suggested_action: What should happen next (for SCOPE_CHANGE, describe new direction)
"""

    inputs = {
        "classification": {
            "type": "string",
            "description": "Classification: CONTEXT_ADD, SCOPE_CHANGE, or CANCEL",
        },
        "reasoning": {
            "type": "string",
            "description": "Brief explanation of your classification",
        },
        "suggested_action": {
            "type": "string",
            "description": "Suggested next action (especially for SCOPE_CHANGE)",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.captured_result: Optional[Dict[str, Any]] = None

    def forward(
        self,
        classification: str,
        reasoning: str,
        suggested_action: Optional[str] = None,
    ) -> str:
        """Capture the classification result."""
        # Normalize classification
        classification_upper = classification.upper().strip()
        if classification_upper not in ("CONTEXT_ADD", "SCOPE_CHANGE", "CANCEL"):
            classification_upper = "CONTEXT_ADD"  # Safe default

        self.captured_result = {
            "classification": classification_upper,
            "reasoning": reasoning,
            "suggested_action": suggested_action,
            "requires_replan": classification_upper == "SCOPE_CHANGE",
            "is_cancel": classification_upper == "CANCEL",
        }
        logger.info(
            f"🔍 Interrupt classified: {classification_upper} - {reasoning[:50]}"
        )
        return f"Classification recorded: {classification_upper}"

    def get_result(self) -> Optional[InterruptClassification]:
        """Retrieve captured result as typed dataclass."""
        if not self.captured_result:
            return None
        return InterruptClassification(
            classification=self.captured_result["classification"],
            requires_replan=self.captured_result["requires_replan"],
            is_cancel=self.captured_result["is_cancel"],
            reasoning=self.captured_result["reasoning"],
            suggested_action=self.captured_result.get("suggested_action"),
        )


INTERRUPT_CLASSIFIER_INSTRUCTIONS = """
You are an interrupt classifier for a plan execution system.

## Your Task
Analyze the user's interrupt message in the context of the current plan execution.
Classify the interrupt and call the `report_classification` tool.

## Classification Categories

### CONTEXT_ADD
The user is providing additional information, clarification, or minor adjustments.
The current plan can continue with this new context injected.

Examples:
- "Also, make sure to include the email field"
- "The table name should be Customers, not Customer"
- "Use blue color for the header"
- "Here's the API key: xxx"
- Providing answers to implicit questions
- Minor corrections or additions

### SCOPE_CHANGE
The user wants to significantly change direction, modify goals, or do something different.
This requires creating a new plan.

Examples:
- "Actually, let's build a contacts table instead"
- "Wait, I want to completely redo this"
- "Let's take a different approach"
- "Instead of that, can you..."
- Fundamentally different requirements
- Major direction changes

### CANCEL
The user wants to stop the current operation entirely.

Examples:
- "Stop"
- "Cancel"
- "Nevermind"
- "Forget it"
- "Don't do that"
- Clear expressions of wanting to abort

## Decision Guidelines

1. Default to CONTEXT_ADD if unclear - it's the safest option
2. SCOPE_CHANGE should only be used for significant direction changes
3. CANCEL is reserved for clear stop/abort requests
4. Consider the current plan progress - more completed = higher bar for SCOPE_CHANGE

IMPORTANT: Always call the report_classification tool with your assessment.
"""


def create_interrupt_classifier(
    model: str,
    max_steps: int = 2,
) -> Tuple[ToolCallingAgent, InterruptClassificationTool]:
    """
    Creates an agent for classifying user interrupts during plan execution.

    Uses Tool pattern for structured output - the LLM calls the tool
    with its classification instead of returning raw JSON.

    Args:
        model: Model identifier for the classifier
        max_steps: Maximum steps (default: 2 for tool call + finish)

    Returns:
        Tuple of (ToolCallingAgent, InterruptClassificationTool)
    """
    logger.debug(f"Creating interrupt classifier with model: {model}")

    classification_tool = InterruptClassificationTool()

    agent = ToolCallingAgent(
        tools=[classification_tool],
        model=model,
        instructions=INTERRUPT_CLASSIFIER_INSTRUCTIONS,
        max_steps=max_steps,
    )

    return agent, classification_tool


def create_interrupt_classifier_factory(
    model: str,
) -> Callable[[], Tuple[ToolCallingAgent, InterruptClassificationTool]]:
    """
    Creates a factory function for interrupt classifier agents.

    Args:
        model: Model identifier for classifiers

    Returns:
        Callable that creates (agent, tool) tuples
    """
    def factory() -> Tuple[ToolCallingAgent, InterruptClassificationTool]:
        return create_interrupt_classifier(model)

    return factory


def build_classification_prompt(
    interrupt_message: str,
    current_plan_summary: str,
    completed_steps: str,
    remaining_steps: str,
) -> str:
    """
    Build the prompt for interrupt classification.

    Args:
        interrupt_message: The user's interrupt message
        current_plan_summary: Summary of current plan goal
        completed_steps: Summary of completed steps
        remaining_steps: Summary of remaining steps

    Returns:
        Formatted prompt for the classifier
    """
    return f"""## Current Plan
{current_plan_summary}

## Progress
Completed steps:
{completed_steps or "None yet"}

Remaining steps:
{remaining_steps or "None remaining"}

## User Interrupt
{interrupt_message}

Classify this interrupt and call the report_classification tool with your assessment."""
