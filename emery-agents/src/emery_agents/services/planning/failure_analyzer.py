"""
Failure Analyzer - DSPy-based failure analysis and recovery.

Analyzes failed steps and determines recovery strategies using DSPy
ChainOfThought with AnalyzeRecovery signature.
"""

import logging
from typing import Optional

import dspy

from ..protocols import ModelProviderProtocol
from emery_agents.entities.models.plan import PlanStep, RecoveryResult
from emery_agents.entities.models.task_ledger import TaskLedger
from emery_agents.reasoning.signatures.evaluation import AnalyzeRecovery, RecoveryAction

from ..tools.capability_registry import CapabilityRegistry
from .models import FailureAnalysisRequest

logger = logging.getLogger(__name__)


class FailureAnalyzerModule(dspy.Module):
    """DSPy module for failure analysis and recovery."""

    def __init__(self) -> None:
        super().__init__()
        self.analyzer = dspy.ChainOfThought(AnalyzeRecovery)

    def forward(
        self,
        failed_step: str,
        error_message: str,
        context: str,
    ) -> RecoveryAction:
        """Analyze failure and propose recovery action."""
        result = self.analyzer(
            failed_step=failed_step,
            error_message=error_message,
            context=context,
        )
        return result.recovery


class FailureAnalyzer:
    """
    DSPy-based failure analysis and recovery.

    Analyzes step failures and determines recovery strategies using
    ChainOfThought with AnalyzeRecovery signature.
    """

    def __init__(
        self,
        lm: Optional[dspy.LM] = None,
        model_provider: Optional["ModelProviderProtocol"] = None,
    ):
        """
        Initialize analyzer.

        Args:
            lm: DSPy language model (uses global settings if not provided)
            model_provider: Model provider for LM resolution (alternative to lm)
        """
        self.lm = lm
        self.model_provider = model_provider
        self._module = FailureAnalyzerModule()

    def analyze(
        self,
        failed_step: PlanStep,
        error_message: str,
        plan_goal: str,
        plan_context: Optional[str],
        ledger: TaskLedger,
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        capability_registry: Optional[CapabilityRegistry] = None,
    ) -> RecoveryResult:
        """
        Analyze a failed step and determine how to fix it.

        Args:
            failed_step: The step that failed
            error_message: The error from execution
            plan_goal: The overall plan goal (for context)
            plan_context: Optional plan context
            ledger: Current execution state
            org_model: Organization model ID for model resolution
            api_key: API key (unused in DSPy version)
            organization_id: Organization ID (unused in DSPy version)
            capability_registry: Capability registry (unused in DSPy version)

        Returns:
            RecoveryResult with corrected_parameters and confidence
        """
        logger.info(f"🔧 Analyzing step failure for '{failed_step.step_id}'")
        logger.debug(f"Error: {error_message[:200]}...")

        # Build context string
        context = f"""
Plan Goal: {plan_goal}

Plan Context: {plan_context or 'None'}

Execution State:
{ledger.to_json_summary()}
"""

        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(
                        failed_step=failed_step.description,
                        error_message=error_message,
                        context=context,
                    )
            else:
                result = self._module(
                    failed_step=failed_step.description,
                    error_message=error_message,
                    context=context,
                )

            recovery = RecoveryResult(
                confidence=result.confidence,
                corrected_parameters=result.corrected_parameters,
                reasoning=result.reasoning,
                questions=result.questions,
            )

            logger.info(
                f"✅ Recovery analysis: confidence={recovery.confidence:.0%}, "
                f"{len(recovery.corrected_parameters)} corrected params"
            )
            return recovery

        except Exception as e:
            logger.error(f"❌ Recovery analysis failed: {e}")
            return self._fallback_recovery(error_message)

    def analyze_from_request(self, request: FailureAnalysisRequest) -> RecoveryResult:
        """
        Analyze failure from a request object.

        Args:
            request: FailureAnalysisRequest with all context

        Returns:
            RecoveryResult with corrected_parameters and confidence
        """
        # Create minimal step for analysis
        from emery_agents.entities.models.plan import create_step
        failed_step = create_step(
            description=request.step_description,
        )
        # Override step_id if needed
        object.__setattr__(failed_step, 'step_id', request.step_id)

        # Create minimal ledger from summary
        ledger = TaskLedger(task_id=request.step_id, goal=request.plan_goal)

        return self.analyze(
            failed_step=failed_step,
            error_message=request.error_message,
            plan_goal=request.plan_goal,
            plan_context=request.plan_context,
            ledger=ledger,
            org_model=request.org_model,
            api_key=request.api_key,
            organization_id=request.organization_id,
        )

    def _fallback_recovery(self, error_message: str) -> RecoveryResult:
        """Fallback recovery when analysis fails."""
        return RecoveryResult(
            confidence=0.2,
            corrected_parameters={},
            reasoning=f"Automatic analysis failed. Error: {error_message[:200]}",
            questions=[
                "What would you like to do about this error?",
                "Should we retry, skip this step, or try a different approach?",
            ],
        )
