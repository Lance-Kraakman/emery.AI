"""
Plan Service

Manages plan files - generation, storage, and retrieval.
Plans are stored on agent/skill entities via gRPC.

AIDEV-NOTE: Plan generation uses PlanOutputTool for structured capture.
The planner calls submit_plan tool with goal and steps - no text parsing.
Step execution uses ToolExecutor pattern - sub-agent resolves descriptions to tool calls.
"""

import asyncio
import logging
from typing import List, Optional, Any

from smolagents import ToolCallingAgent

from emery_agents.models.plan import (
    Plan,
    PlanStep,
    StepPlan,
    PlanStatus,
    RecoveryResult,
    create_plan,
    create_step,
)
from emery_agents.models.task_ledger import TaskLedger
from emery_agents.models.context_mapping import ResolvedContext
from emery_agents.tools.plan_output_tool import PlanOutputTool
from emery_agents.tools.recovery_output_tool import RecoveryOutputTool
from emery_agents.prompts import render_template
from emery_agents.agents import create_research_agent
from .protocols import ModelProvider, GRPCClient, Tool

logger = logging.getLogger(__name__)


class PlanService:
    """
    Manages plan files - generation, storage, retrieval via gRPC.

    Plans are detailed execution instructions generated from basic instructions.
    Uses LLM to generate text-only step descriptions that are executed via ToolExecutor.
    """

    def __init__(
        self,
        grpc_client: Optional[GRPCClient] = None,
        model_provider: Optional[ModelProvider] = None,
    ):
        """
        Initialize plan service.

        Args:
            grpc_client: gRPC client for communication with Next.js server
            model_provider: Model provider for LLM access and model resolution
        """
        self.grpc_client = grpc_client
        self.model_provider = model_provider

    async def generate_plan(
        self,
        basic_instructions: str,
        context_tables: Optional[ResolvedContext] = None,
        available_tools: Optional[List[str]] = None,
        goal: Optional[str] = None,
        org_model: Optional[str] = None,
        tools: Optional[List[Tool]] = None,
        managed_agents: Optional[List[Any]] = None,
        research_tools: Optional[List[Any]] = None,
        api_key: Optional[str] = None,
        skill_inputs: Optional[List[dict]] = None,
        previous_plan_json: Optional[str] = None,
        user_feedback: Optional[str] = None,
        organization_id: Optional[int] = None,
        skill_outputs: Optional[List[dict]] = None,
        is_skill_template: bool = False,
    ) -> Plan:
        """
        Generate plan using context-first planning pattern.

        The planner:
        1. Delegates research to research_agent (web + system)
        2. Analyzes the request with gathered context
        3. Calls submit_plan with context, analysis, goal, and steps

        Args:
            basic_instructions: Human-readable instructions to convert to plan
            context_tables: Resolved context mappings (tables available for the plan)
            available_tools: Tool names as strings (for logging)
            goal: Optional explicit goal (defaults to LLM-generated goal)
            org_model: Organization model ID for model resolution hierarchy
            tools: Actual tool objects (for prompt template)
            managed_agents: Available managed agents (planner sees their descriptions)
            research_tools: Optional web research tools (web_search, visit_webpage)
            api_key: Optional API key for model providers (e.g., Gemini)
            skill_inputs: Optional skill input definitions for variable-aware planning
            previous_plan_json: Optional previous plan JSON for regeneration with feedback
            user_feedback: Optional user feedback for plan regeneration
            organization_id: Optional organization ID for research_agent (RLS context)
            skill_outputs: Optional skill output definitions for result-aware planning
            is_skill_template: If True, plan is for a reusable skill (no hardcoded IDs)

        Returns:
            Plan object with generated steps, context, and analysis
        """
        # Resolve model using model hierarchy
        if not self.model_provider:
            logger.warning("No model_provider for plan generation - returning empty plan")
            fallback_goal = goal or self._summarize_task(basic_instructions)
            return create_plan(goal=fallback_goal, basic_instructions=basic_instructions)

        model_id = self.model_provider.resolve_model_selection(org_model=org_model)
        # AIDEV-NOTE: Don't pass api_key here - that's the Emery internal API key for CRUD tools,
        # not the Gemini API key. Model provider will use GEMINI_API_KEY env var for Google models.
        model = self.model_provider.get_model(model_id=model_id)

        # Create plan output tool
        plan_tool = PlanOutputTool()

        # Build list of planner tools: just submit_plan
        # Context gathering is done via research_agent (managed agent) which has research_emery
        planner_tools = [plan_tool]

        # Create research_agent for intelligent context gathering
        # For skill templates: research is allowed (to understand tools/capabilities)
        # but the OUTPUT must use {input_variables} instead of hardcoded values
        planner_managed_agents = []
        if api_key and organization_id:
            research_agent = create_research_agent(
                model=model,
                api_key=api_key,
                organization_id=organization_id,
                max_steps=8,  # Allow multiple research queries
            )
            planner_managed_agents.append(research_agent)
            logger.info(f"🔬 Planner has research_agent for context gathering (web + system)")
        elif research_tools:
            # Fallback: use research tools directly if no org context
            planner_tools.extend(research_tools)
            logger.info(f"🔬 Planner has {len(research_tools)} direct research tools (fallback)")

        # Extract agent info for template (names + descriptions + capabilities)
        # Include both execution agents (for routing info) and planner's research_agent
        agent_info = []
        for agent in (managed_agents or []):
            agent_info.append({
                "name": getattr(agent, "name", "unknown"),
                "description": getattr(agent, "description", ""),
                "capabilities": getattr(agent, "capabilities", ""),
            })
        # Also include research_agent info so planner prompt knows to use it
        for agent in planner_managed_agents:
            agent_info.append({
                "name": getattr(agent, "name", "unknown"),
                "description": getattr(agent, "description", ""),
                "capabilities": getattr(agent, "capabilities", ""),
            })

        # Build prompt using Jinja template
        # has_research_agent tells template that research_agent is available for delegation
        prompt = render_template(
            "planning/step_planner.j2",
            task=basic_instructions,
            tools=tools or [],
            managed_agents=agent_info,  # Pass info for template (includes research_agent)
            has_research_agent=bool(planner_managed_agents),  # research_agent available
            has_research_tools=bool(research_tools) and not planner_managed_agents,  # Direct tools fallback
            skill_inputs=skill_inputs or [],  # For variable-aware planning
            skill_outputs=skill_outputs or [],  # For result-aware planning
            previous_plan_json=previous_plan_json,  # For regeneration with feedback
            user_feedback=user_feedback,  # User feedback for improvement
            is_skill_template=is_skill_template,  # True = no hardcoded IDs
        )

        logger.info(f"📋 Generating plan with research-driven pattern...")
        logger.debug(f"📋 Planning prompt ({len(prompt)} chars)")

        # Generate plan via LLM with context tools + research_agent + submit_plan
        plan_goal: Optional[str] = None
        plan_context: Optional[str] = None
        plan_analysis: Optional[str] = None
        steps: List[PlanStep] = []

        try:
            # Allow more steps when research_agent is available (delegate + synthesize)
            max_steps = 12 if planner_managed_agents else (10 if research_tools else 6)
            planner = ToolCallingAgent(
                tools=planner_tools,
                model=model,
                max_steps=max_steps,
                managed_agents=planner_managed_agents if planner_managed_agents else None,
            )
            planner.run(prompt)

            # Get structured plan from tool
            captured = plan_tool.get_plan()

            if captured:
                # Extract context and analysis
                plan_context = captured.get("context")
                plan_analysis = captured.get("analysis")

                # Steps are now objects with description and optional target_agent
                steps = []
                for step_data in captured["steps"]:
                    if isinstance(step_data, dict):
                        steps.append(create_step(
                            description=step_data.get("description", str(step_data)),
                            tool_call=None,
                            parameters=None,
                            target_agent=step_data.get("target_agent"),
                        ))
                    else:
                        # Legacy string format
                        steps.append(create_step(
                            description=str(step_data),
                            tool_call=None,
                            parameters=None,
                        ))
                # ALWAYS use captured goal - the LLM analyzed the task and summarized it
                plan_goal = captured["goal"]
                logger.info(f"✅ Generated {len(steps)} plan steps via submit_plan tool")
                logger.info(f"📋 Captured goal: {plan_goal}")
                if plan_context:
                    logger.info(f"📋 Has context: {len(plan_context)} chars")
                if plan_analysis:
                    logger.info(f"📋 Has analysis: {len(plan_analysis)} chars")
            else:
                logger.warning("⚠️ Plan tool not called, using empty plan")

        except Exception as e:
            logger.error(f"❌ Plan generation failed: {e}")
            # Re-raise the exception so the coordinator can handle it properly
            # instead of silently creating an empty plan
            raise

        # Fallback goal hierarchy: captured > explicit param > summarize
        if not plan_goal:
            plan_goal = goal or self._summarize_task(basic_instructions)

        # Create plan with generated steps, context, and analysis
        plan = create_plan(
            goal=plan_goal,
            basic_instructions=basic_instructions,
            steps=steps,
            context=plan_context,
            analysis=plan_analysis,
        )

        logger.info(f"📋 Created plan {plan.id} with {len(steps)} steps for goal: {plan_goal}")
        return plan

    def _summarize_task(self, task: str, max_length: int = 100) -> str:
        """
        Create a short summary of the task for display.

        Takes first line and truncates if needed.

        Args:
            task: Full task text
            max_length: Maximum length for summary

        Returns:
            Short summary string
        """
        first_line = task.split("\n")[0].strip()
        if len(first_line) > max_length:
            return first_line[: max_length - 3] + "..."
        return first_line

    async def save_agent_plan(self, agent_id: int, plan: Plan) -> None:
        """
        Save plan to agent entity via gRPC.

        Args:
            agent_id: ID of the agent to save the plan to
            plan: Plan to save
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, skipping save for agent {agent_id}"
            )
            return

        try:
            await self.grpc_client.update_agent_plan(
                agent_id=agent_id,
                plan=plan.to_dict(),
            )
            logger.info(f"Saved plan {plan.id} to agent {agent_id}")
        except Exception as e:
            logger.error(f"Failed to save plan to agent {agent_id}: {e}")
            raise

    async def save_step_plan(
        self,
        skill_id: int,
        step_id: str,
        plan: StepPlan,
    ) -> None:
        """
        Save plan to skill step via gRPC.

        Args:
            skill_id: ID of the parent skill
            step_id: ID of the step within the skill
            plan: StepPlan to save
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, skipping save for step {step_id}"
            )
            return

        try:
            await self.grpc_client.update_step_plan(
                skill_id=skill_id,
                step_id=step_id,
                plan=plan.to_dict(),
            )
            logger.info(f"Saved plan {plan.id} to skill {skill_id} step {step_id}")
        except Exception as e:
            logger.error(
                f"Failed to save plan to skill {skill_id} step {step_id}: {e}"
            )
            raise

    async def load_agent_plan(self, agent_id: int) -> Optional[Plan]:
        """
        Load plan from agent entity.

        Args:
            agent_id: ID of the agent to load the plan from

        Returns:
            Plan if exists, None otherwise
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, cannot load plan for agent {agent_id}"
            )
            return None

        try:
            response = await self.grpc_client.get_agent(agent_id)
            if response and hasattr(response, 'plan') and response.plan:
                plan = Plan.from_dict(response.plan)
                logger.info(f"Loaded plan {plan.id} from agent {agent_id}")
                return plan
            return None
        except Exception as e:
            logger.error(f"Failed to load plan from agent {agent_id}: {e}")
            return None

    async def load_step_plan(
        self,
        skill_id: int,
        step_id: str,
    ) -> Optional[StepPlan]:
        """
        Load plan from skill step.

        Args:
            skill_id: ID of the parent skill
            step_id: ID of the step within the skill

        Returns:
            StepPlan if exists, None otherwise
        """
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, cannot load plan for step {step_id}"
            )
            return None

        try:
            response = await self.grpc_client.get_skill_step(skill_id, step_id)
            if response and hasattr(response, 'plan') and response.plan:
                plan = StepPlan.from_dict(response.plan)
                logger.info(
                    f"Loaded plan {plan.id} from skill {skill_id} step {step_id}"
                )
                return plan
            return None
        except Exception as e:
            logger.error(
                f"Failed to load plan from skill {skill_id} step {step_id}: {e}"
            )
            return None

    async def approve_plan(self, plan: Plan) -> Plan:
        """
        Mark a plan as approved.

        Args:
            plan: Plan to approve

        Returns:
            Approved plan
        """
        approved = plan.approve()
        logger.info(f"Approved plan {approved.id}")
        return approved

    async def update_plan_status(
        self,
        plan: Plan,
        status: str,
    ) -> Plan:
        """
        Update plan status.

        Args:
            plan: Plan to update
            status: New status (draft, approved, executing, completed, failed)

        Returns:
            Updated plan
        """
        if status == PlanStatus.APPROVED.value:
            return plan.approve()
        elif status == PlanStatus.EXECUTING.value:
            return plan.start_execution()
        elif status == PlanStatus.COMPLETED.value:
            return plan.complete()
        elif status == PlanStatus.FAILED.value:
            return plan.fail()
        else:
            logger.warning(f"Unknown plan status: {status}")
            return plan

    async def update_step_status(
        self,
        plan: Plan,
        step_id: str,
        status: str,
        result: Optional[str] = None,
        error: Optional[str] = None,
    ) -> Plan:
        """
        Update a step's status within a plan.

        Args:
            plan: Plan containing the step
            step_id: ID of the step to update
            status: New step status
            result: Optional result (for completed steps)
            error: Optional error message (for failed steps)

        Returns:
            Updated plan with modified step
        """
        for step in plan.steps:
            if step.step_id == step_id:
                if status == "in_progress":
                    updated_step = step.mark_in_progress()
                elif status == "completed":
                    updated_step = step.mark_completed(result)
                elif status == "failed":
                    updated_step = step.mark_failed(error or "Unknown error")
                else:
                    logger.warning(f"Unknown step status: {status}")
                    return plan

                return plan.update_step(step_id, updated_step)

        logger.warning(f"Step {step_id} not found in plan {plan.id}")
        return plan

    def analyze_step_failure(
        self,
        failed_step: PlanStep,
        error_message: str,
        plan: Plan,
        ledger: TaskLedger,
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
    ) -> RecoveryResult:
        """
        Analyze a failed step and determine how to fix it.

        Uses LLM with research_emery to:
        1. Gather fresh context based on the error
        2. Determine what parameters are missing or wrong
        3. Return corrected parameters with confidence

        Does NOT create a new plan - just returns corrected parameters
        to update the original step.

        Args:
            failed_step: The step that failed
            error_message: The error from execution
            plan: The original plan (for context)
            ledger: Current execution state
            org_model: Organization model ID for model resolution hierarchy
            api_key: API key for research_emery auth
            organization_id: Organization ID for research_emery RLS context

        Returns:
            RecoveryResult with corrected_parameters and confidence
        """
        if not self.model_provider:
            logger.warning("No model_provider for recovery analysis")
            return RecoveryResult(
                confidence=0.1,
                corrected_parameters={},
                reasoning="No model provider available for analysis",
                questions=["How would you like to fix this step?"],
            )

        recovery_tool = RecoveryOutputTool()

        # Build prompt using recovery template
        prompt = render_template(
            "execution/step_recovery.j2",
            failed_step=failed_step,
            error_message=error_message,
            plan_goal=plan.goal,
            plan_context=plan.context,
            ledger_summary=ledger.to_toon_summary(),
        )

        logger.info(f"🔧 Analyzing step failure for '{failed_step.step_id}'")
        logger.debug(f"Error: {error_message[:200]}...")

        try:
            # LLM gathers context and analyzes using resolved model
            model_id = self.model_provider.resolve_model_selection(org_model=org_model)
            model = self.model_provider.get_model(model_id=model_id)

            # Create research_emery for context gathering
            managed_agents = []
            if api_key and organization_id:
                from ..agents.research_emery_agent import create_research_emery_agent
                research_emery = create_research_emery_agent(
                    model=model,
                    api_key=api_key,
                    organization_id=organization_id,
                    max_steps=6,
                )
                managed_agents.append(research_emery)
                logger.info("🔬 Recovery analyzer has research_emery for context gathering")

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


class PlanServiceFactory:
    """Factory for creating PlanService instances."""

    def __init__(
        self,
        grpc_client: Optional[GRPCClient] = None,
        model_provider: Optional[ModelProvider] = None,
    ) -> None:
        """
        Initialize factory.

        Args:
            grpc_client: gRPC client to use for all plan services
            model_provider: Model provider for LLM access
        """
        self.grpc_client = grpc_client
        self.model_provider = model_provider

    def create(self) -> PlanService:
        """Create a PlanService instance."""
        return PlanService(
            grpc_client=self.grpc_client,
            model_provider=self.model_provider,
        )
