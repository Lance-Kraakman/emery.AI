"""
DSPy Evaluator Module.

Handles goal evaluation, recovery analysis, and answer synthesis.
"""

from __future__ import annotations

import dspy

from emery_agents.reasoning.signatures.evaluation import (
    AnalyzeRecovery,
    EvaluateGoal,
    EvaluateStep,
    GoalEvaluation,
    RecoveryAction,
    ReflectOnExecution,
    StepEvaluation,
    StepReflection,
    SynthesizeAnswer,
)
from emery_agents.reasoning.utils import StepOutcome


class EvaluatorModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for evaluating goal achievement, step quality, and synthesis.
    """

    def __init__(self) -> None:
        """Initialize the evaluator module."""
        super().__init__()
        self.goal_evaluator = dspy.ChainOfThought(EvaluateGoal)
        self.step_evaluator = dspy.ChainOfThought(EvaluateStep)
        self.recovery_analyzer = dspy.ChainOfThought(AnalyzeRecovery)
        self.synthesizer = dspy.ChainOfThought(SynthesizeAnswer)
        self.reflector = dspy.ChainOfThought(ReflectOnExecution)

    @staticmethod
    def _format_tool_evidence(outcomes: list[StepOutcome]) -> str:
        """Format StepOutcome objects into tool evidence text for the DSPy signature."""
        if not outcomes:
            return "No tool evidence available."
        parts = []
        for outcome in outcomes:
            evidence = outcome.format_evidence()
            if evidence:
                parts.append(evidence)
        return "\n\n".join(parts) if parts else "No tool evidence available."

    def evaluate_goal(
        self,
        original_goal: str,
        plan_steps: list[str],
        step_results: list[str],
        step_outcomes: list[StepOutcome] | None = None,
    ) -> GoalEvaluation:
        """
        Evaluate whether the original goal was achieved.

        Args:
            original_goal: The user's original request
            plan_steps: List of planned step descriptions
            step_results: List of results from each step
            step_outcomes: Structured step outcomes with raw tool call data

        Returns:
            GoalEvaluation with achievement status and details
        """
        tool_evidence = self._format_tool_evidence(step_outcomes or [])
        result = self.goal_evaluator(
            original_goal=original_goal,
            plan_steps=plan_steps,
            step_results=step_results,
            tool_evidence=tool_evidence,
        )
        return result.evaluation  # type: ignore[no-any-return]

    def evaluate_step(
        self,
        step_description: str,
        step_output: str,
        expected_outcome: str,
    ) -> StepEvaluation:
        """
        Evaluate the quality of a single step's execution.

        Args:
            step_description: What the step was supposed to do
            step_output: What the step actually produced
            expected_outcome: What outcome was expected

        Returns:
            StepEvaluation with quality assessment
        """
        result = self.step_evaluator(
            step_description=step_description,
            step_output=step_output,
            expected_outcome=expected_outcome,
        )
        return result.evaluation  # type: ignore[no-any-return]

    def analyze_recovery(
        self,
        failed_step: str,
        error_message: str,
        context: str,
    ) -> RecoveryAction:
        """
        Analyze a failure and propose recovery action.

        Args:
            failed_step: Description of the step that failed
            error_message: Error message from the failure
            context: Execution context

        Returns:
            RecoveryAction with proposed recovery strategy
        """
        result = self.recovery_analyzer(
            failed_step=failed_step,
            error_message=error_message,
            context=context,
        )
        return result.recovery  # type: ignore[no-any-return]

    def synthesize_answer(
        self,
        goal: str,
        step_results: str,
        curated_context: str = "",
    ) -> str:
        """
        Synthesize step results into a coherent final answer.

        Args:
            goal: The original goal or request
            step_results: Formatted results from each step
            curated_context: Additional insights from execution

        Returns:
            Synthesized, coherent final answer
        """
        result = self.synthesizer(
            goal=goal,
            step_results=step_results,
            curated_context=curated_context or "No additional context.",
        )
        return result.answer  # type: ignore[no-any-return]

    def reflect_on_step(
        self,
        step_description: str,
        step_result: str,
        tool_evidence: str,
        plan_goal: str,
        previous_reflections: str = "",
    ) -> StepReflection:
        """Reflect on a completed step to extract insights for future steps.

        Args:
            step_description: What the step was supposed to do
            step_result: What the step produced (truncated to 500 chars)
            tool_evidence: Raw tool call outcomes (truncated to 800 chars)
            plan_goal: The overall plan goal
            previous_reflections: Rolling summary from prior steps

        Returns:
            StepReflection with quality assessment and actionable insights
        """
        result = self.reflector(
            step_description=step_description,
            step_result=step_result[:500],
            tool_evidence=tool_evidence[:800],
            plan_goal=plan_goal,
            previous_reflections=previous_reflections or "No previous reflections.",
        )
        return result.reflection  # type: ignore[no-any-return]

    def forward(
        self,
        original_goal: str,
        plan_steps: list[str],
        step_results: list[str],
        step_outcomes: list[StepOutcome] | None = None,
    ) -> GoalEvaluation:
        """
        Default forward pass evaluates goal achievement.

        Args:
            original_goal: The user's original request
            plan_steps: List of planned step descriptions
            step_results: List of results from each step
            step_outcomes: Structured step outcomes with raw tool call data

        Returns:
            GoalEvaluation with achievement status
        """
        return self.evaluate_goal(
            original_goal, plan_steps, step_results, step_outcomes
        )
