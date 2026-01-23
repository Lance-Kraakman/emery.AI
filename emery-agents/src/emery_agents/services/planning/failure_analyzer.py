"""
Failure Analyzer

Analyzes failed steps and determines recovery strategies using LLM.
Uses research_emery to gather fresh context and determine corrections.

AIDEV-NOTE: Does NOT create a new plan - just returns corrected parameters
to update the original step. This preserves plan continuity.
"""

import logging
from typing import Optional

from smolagents import ToolCallingAgent

from typing import Optional

from emery_agents.models.plan import PlanStep, RecoveryResult
from emery_agents.models.task_ledger import TaskLedger
from emery_agents.tools.recovery_output_tool import RecoveryOutputTool
from emery_agents.prompts import render_template

from ..capability_registry import CapabilityRegistry
from ..protocols import ModelProvider
from .models import FailureAnalysisRequest

logger = logging.getLogger(__name__)


class FailureAnalyzer:
    """
    Analyzes step failures and determines recovery strategies.

    Uses LLM with research_emery to:
    1. Gather fresh context based on the error
    2. Determine what parameters are missing or wrong
    3. Return corrected parameters with confidence
    """

    def __init__(self, model_provider: Optional[ModelProvider] = None):
        """
        Initialize analyzer.

        Args:
            model_provider: Model provider for LLM access and model resolution
        """
        self.model_provider = model_provider

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
            org_model: Organization model ID for model resolution hierarchy
            api_key: API key for research_emery auth
            organization_id: Organization ID for research_emery RLS context

        Returns:
            RecoveryResult with corrected_parameters and confidence
        """
        if not self.model_provider:
            raise ValueError(
                "FailureAnalyzer requires model_provider for LLM-based recovery analysis."
            )

        recovery_tool = RecoveryOutputTool()

        # Build prompt using recovery template
        prompt = render_template(
            "execution/step_recovery.j2",
            failed_step=failed_step,
            error_message=error_message,
            plan_goal=plan_goal,
            plan_context=plan_context,
            ledger_summary=ledger.to_toon_summary(),
        )

        logger.info(f"🔧 Analyzing step failure for '{failed_step.step_id}'")
        logger.debug(f"Error: {error_message[:200]}...")

        try:
            # LLM gathers context and analyzes using resolved model
            model_id = self.model_provider.resolve_model_selection(org_model=org_model)
            model = self.model_provider.get_model(model_id=model_id)

            # Get research_emery from capability registry if available
            managed_agents = []
            if capability_registry:
                # Try to get existing research_emery from registry
                research_cap = capability_registry.get("agent:research_emery")
                if research_cap and research_cap.metadata.get("executor"):
                    managed_agents.append(research_cap.metadata["executor"])
                    logger.info("🔬 Recovery analyzer using research_emery from capability registry")

            # Fallback: create new research_emery if not in registry and auth available
            if not managed_agents and api_key and organization_id:
                from emery_agents.agents.research_emery_agent import create_research_emery_agent
                research_emery = create_research_emery_agent(
                    model=model,
                    api_key=api_key,
                    organization_id=organization_id,
                    max_steps=6,
                )
                managed_agents.append(research_emery)
                logger.info("🔬 Recovery analyzer created new research_emery (not in registry)")

            analyzer = ToolCallingAgent(
                tools=[recovery_tool],
                model=model,
                max_steps=10,  # Allow multiple context gathering steps
                managed_agents=managed_agents if managed_agents else None,
            )
            analyzer.run(prompt)

            result = recovery_tool.get_result()
            if result:
                recovery = RecoveryResult(
                    confidence=result["confidence"],
                    corrected_parameters=result["corrected_parameters"],
                    reasoning=result["reasoning"],
                    questions=result.get("questions", []),
                )
                logger.info(
                    f"✅ Recovery analysis: confidence={recovery.confidence:.0%}, "
                    f"{len(recovery.corrected_parameters)} corrected params"
                )
                return recovery

            # Tool not called - fallback
            logger.warning("⚠️ Recovery tool not called, using fallback")
            return self._fallback_recovery(error_message)

        except Exception as e:
            logger.error(f"❌ Recovery analysis failed: {e}")
            return self._fallback_recovery(error_message)

    def analyze_from_request(self, request: FailureAnalysisRequest) -> RecoveryResult:
        """
        Analyze failure from a request object.

        This is a convenience method that unpacks the request and
        creates a minimal PlanStep for analysis.

        Args:
            request: FailureAnalysisRequest with all context

        Returns:
            RecoveryResult with corrected_parameters and confidence
        """
        # Create minimal step for analysis
        from emery_agents.models.plan import create_step
        failed_step = create_step(
            description=request.step_description,
        )
        # Override step_id if needed (create_step generates one automatically)
        # We use object.__setattr__ since PlanStep is frozen
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
