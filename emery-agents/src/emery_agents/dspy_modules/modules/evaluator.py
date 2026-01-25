"""
DSPy Evaluator Module.

This module handles goal evaluation and recovery analysis.
"""

from __future__ import annotations

import dspy

from emery_agents.dspy_modules.signatures.evaluation import (
    AnalyzeRecovery,
    EvaluateGoal,
    EvaluateStep,
    GoalEvaluation,
    RecoveryAction,
    StepEvaluation,
)


class EvaluatorModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for evaluating goal achievement and step quality.
    """

    def __init__(self) -> None:
        """Initialize the evaluator module."""
        super().__init__()
        self.goal_evaluator = dspy.ChainOfThought(EvaluateGoal)
        self.step_evaluator = dspy.ChainOfThought(EvaluateStep)
        self.recovery_analyzer = dspy.ChainOfThought(AnalyzeRecovery)

    def evaluate_goal(
        self,
        original_goal: str,
        plan_steps: list[str],
        step_results: list[str],
    ) -> GoalEvaluation:
        """
        Evaluate whether the original goal was achieved.

        Args:
            original_goal: The user's original request
            plan_steps: List of planned step descriptions
            step_results: List of results from each step

        Returns:
            GoalEvaluation with achievement status and details
        """
        result = self.goal_evaluator(
            original_goal=original_goal,
            plan_steps=plan_steps,
            step_results=step_results,
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

    def forward(
        self,
        original_goal: str,
        plan_steps: list[str],
        step_results: list[str],
    ) -> GoalEvaluation:
        """
        Default forward pass evaluates goal achievement.

        Args:
            original_goal: The user's original request
            plan_steps: List of planned step descriptions
            step_results: List of results from each step

        Returns:
            GoalEvaluation with achievement status
        """
        return self.evaluate_goal(original_goal, plan_steps, step_results)
