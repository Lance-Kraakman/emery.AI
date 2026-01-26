"""
Coordinator Streaming Handler

Handles execution coordinator integration for two-phase execution.
Extracted from ChatProcessingService for maintainability.
"""

import json
import logging
from typing import AsyncIterator, Optional, List, Any, TYPE_CHECKING

import dspy

from ..services.execution_coordinator import (
    ExecutionCoordinator,
    PlanCreatedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    AwaitingClarificationEvent,
    ErrorEvent,
)
from ..services.plan_step_executor import PlanStepExecutor
from ..models.plan import Plan
from ..tools.tool_modes import ToolMode
from ..services.agent_executor import AgentExecutor
from ..dspy_modules.config import get_dspy_lm
from ..dspy_modules.modules.executor import ExecutorModule
from ..dspy_modules.tools import create_all_tools, QuestionCollector, create_ask_question_tool
from .coordinator_event_converter import convert_coordinator_event
from .mappers import format_clarifying_questions
from .approval_handler import is_approval_response, create_awaiting_input_for_plan
from .response_types import create_error_response

if TYPE_CHECKING:
    from ..entities.execution_context import ExecutionContext
    from ..services.coordinator_state_machine import CoordinatorStateMachine, Phase
    from ..services.model_provider import ModelProvider
    from ..services.plan_service import PlanService

logger = logging.getLogger(__name__)


def _format_dict_questions(questions: List[dict[str, Any]]) -> List[dict[str, Any]]:
    """Format dict-based questions from QuestionCollector for serialization."""
    questions_data = []
    for i, q in enumerate(questions):
        q_dict = {
            "questionId": f"q_{i}",
            "question": q.get("question", ""),
            "questionType": q.get("question_type", "text"),
            "required": q.get("required", True),
            "allowOther": q.get("allow_other", True),
        }
        if q.get("options"):
            q_dict["options"] = q["options"]
        if q.get("context"):
            q_dict["context"] = q["context"]
        questions_data.append(q_dict)
    return questions_data


class CoordinatorStreamingHandler:
    """
    Handles coordinator-driven execution paths.

    The coordinator internally decides the mode:
    - PASSTHROUGH: Single managed agent task (agent has own HITL)
    - DIRECT: Simple task, execute without plan
    - PLAN_AND_APPROVE: Complex task, create plan and await approval
    - AUTONOMOUS: Pre-approved stored plan, execute directly (skip HITL)
    """

    def __init__(
        self,
        plan_service: 'PlanService',
        model_provider: 'ModelProvider',
    ):
        self.plan_service = plan_service
        self.model_provider = model_provider

    async def stream_response(
        self,
        context: 'ExecutionContext',
        tools: List[Any],
        task: str,
        session_id: Optional[str],
        org_model: Optional[str],
        sm: Optional['CoordinatorStateMachine'],
        managed_agents: Optional[List[Any]] = None,
        stored_plan: Optional[Plan] = None,
        conversation_history: Optional[List[Any]] = None,
        capability_registry: Optional[Any] = None,
    ) -> AsyncIterator[Any]:
        """Coordinator-driven execution path. Yields streaming events."""
        # Import Phase here to avoid circular imports at module level
        from ..services.coordinator_state_machine import Phase

        # === AUTONOMOUS MODE: Execute stored plan directly ===
        if stored_plan and (not sm or sm.phase == Phase.IDLE):
            async for event in self._handle_autonomous_execution(
                context=context,
                tools=tools,
                task=task,
                org_model=org_model,
                managed_agents=managed_agents,
                stored_plan=stored_plan,
                conversation_history=conversation_history,
                capability_registry=capability_registry,
            ):
                yield event
            return

        if not sm or sm.phase == Phase.IDLE:
            # === NEW REQUEST - Let coordinator determine mode ===
            async for event in self._handle_new_request(
                context=context,
                tools=tools,
                task=task,
                org_model=org_model,
                sm=sm,
                managed_agents=managed_agents,
                conversation_history=conversation_history,
                capability_registry=capability_registry,
            ):
                yield event

        elif sm and sm.phase == Phase.AWAITING_APPROVAL:
            # === CHECK FOR APPROVAL ===
            async for event in self._handle_approval_response(
                context=context,
                tools=tools,
                task=task,
                sm=sm,
            ):
                yield event

        elif sm and sm.phase == Phase.EXECUTING:
            # User sent message during EXECUTING state - treat as new task
            logger.info(f"📋 Coordinator: User input during EXECUTING phase, treating as new task: {task[:100]}...")
            sm.context.clear()
            async for event in self._handle_direct_execution(
                context=context,
                task=task,
                org_model=org_model,
            ):
                yield event
            return

        elif sm and sm.phase == Phase.AWAITING_QUESTIONS:
            # Questions response - process with DSPy
            logger.info("📋 Coordinator: Questions response, processing with DSPy direct execution")
            sm.context.clear()
            async for event in self._handle_direct_execution(
                context=context,
                task=task,
                org_model=org_model,
            ):
                yield event

    async def _handle_autonomous_execution(
        self,
        context: 'ExecutionContext',
        tools: List[Any],
        task: str,
        org_model: Optional[str],
        managed_agents: Optional[List[Any]],
        stored_plan: Plan,
        conversation_history: Optional[List[Any]],
        capability_registry: Optional[Any] = None,
    ) -> AsyncIterator[Any]:
        """Handle autonomous mode with pre-approved stored plan."""
        assert context.tool_provider is not None, "tool_provider required for autonomous execution"
        logger.info(f"📋 Coordinator: AUTONOMOUS mode - executing stored plan '{stored_plan.id}' directly")

        managed_agents_list = self._get_managed_agents_list(managed_agents)

        plan_step_executor = PlanStepExecutor(
            api_key=context.tool_provider.api_key,
            org_id=str(context.tool_provider.organization_id),
            org_model=org_model,
            max_steps=10,
            capability_registry=capability_registry,
        )

        coordinator = ExecutionCoordinator(
            plan_service=self.plan_service,
            model_provider=self.model_provider,
            plan_step_executor=plan_step_executor,
            evaluate_after_steps=1,
            max_replans=3,
            org_model=org_model,
            api_key=context.tool_provider.api_key,
            organization_id=context.tool_provider.organization_id,
            conversation_history=conversation_history,
            capability_registry=capability_registry,
        )

        step_index = 0
        final_synthesis: Optional[str] = None
        execution_success = False

        async for event in coordinator.execute(
            task=task,
            tools=tools,
            managed_agents=managed_agents,
            stored_plan=stored_plan,
        ):
            converted = convert_coordinator_event(event, step_index)
            if converted:
                yield converted
                step_index += 1

            if isinstance(event, FinalSynthesisEvent):
                final_synthesis = event.synthesis
            elif isinstance(event, ExecutionCompletedEvent):
                execution_success = event.success

        # Send final summary
        if execution_success:
            summary = final_synthesis or f"Plan executed successfully with {step_index} steps."
            yield {
                "type": "content_chunk",
                "content": f"\n\n{summary}"
            }
        else:
            yield {
                "type": "content_chunk",
                "content": "\n\nExecution completed with issues. Some steps may have failed."
            }

    async def _handle_new_request(
        self,
        context: 'ExecutionContext',
        tools: List[Any],
        task: str,
        org_model: Optional[str],
        sm: Optional['CoordinatorStateMachine'],
        managed_agents: Optional[List[Any]],
        conversation_history: Optional[List[Any]],
        capability_registry: Optional[Any] = None,
    ) -> AsyncIterator[Any]:
        """Handle new request - coordinator determines mode."""
        logger.info("📋 Coordinator: Analyzing task to determine execution mode...")

        managed_agents_list = self._get_managed_agents_list(managed_agents)

        if context.tool_provider is None:
            logger.error("❌ ToolProvider not set on context - cannot create coordinator")
            yield create_error_response(
                "CONFIGURATION_ERROR",
                "Tool provider not configured. Please try again.",
            )
            return

        plan_step_executor = PlanStepExecutor(
            api_key=context.tool_provider.api_key,
            org_id=str(context.tool_provider.organization_id),
            org_model=org_model,
            max_steps=10,
            capability_registry=capability_registry,
        )

        coordinator = ExecutionCoordinator(
            plan_service=self.plan_service,
            model_provider=self.model_provider,
            plan_step_executor=plan_step_executor,
            evaluate_after_steps=1,
            max_replans=3,
            org_model=org_model,
            api_key=context.tool_provider.api_key,
            organization_id=context.tool_provider.organization_id,
            conversation_history=conversation_history,
            capability_registry=capability_registry,
        )

        plan: Optional[Plan] = None
        async for event in coordinator.execute(
            task=task,
            tools=tools,
            managed_agents=managed_agents,
        ):
            if isinstance(event, AwaitingClarificationEvent):
                logger.info(f"📋 Coordinator: Task needs clarification - {len(event.questions)} questions")

                yield {
                    "type": "awaiting_input",
                    "data": {
                        "input_type": "questions",
                        "title": "Clarification Needed",
                        "content": event.reasoning,
                        "questions": format_clarifying_questions(event.questions),
                        "options": [],
                        "plan_json": ""
                    }
                }

                if sm:
                    sm.on_clarification_needed(task)
                return

            elif isinstance(event, PlanCreatedEvent):
                plan = event.plan
                logger.info(f"📋 Coordinator: PLAN_AND_APPROVE mode - plan {plan.id} with {len(plan.steps)} steps")

            elif isinstance(event, ErrorEvent):
                logger.error(f"📋 Coordinator: Plan generation error - {event.error}")
                yield create_error_response(
                    "PLAN_GENERATION_FAILED",
                    event.error,
                )
                if sm:
                    sm.on_error(event.error)
                return

        if plan and sm:
            sm.on_plan_created(coordinator, plan, task)
            yield create_awaiting_input_for_plan(plan)
        elif plan is None:
            # Direct execution without plan - use DSPy ExecutorModule
            logger.info("📋 Coordinator: No plan needed, executing directly with DSPy")
            async for event in self._handle_direct_execution(
                context=context,
                task=task,
                org_model=org_model,
            ):
                yield event

    async def _handle_direct_execution(
        self,
        context: 'ExecutionContext',
        task: str,
        org_model: Optional[str],
    ) -> AsyncIterator[Any]:
        """
        Handle direct execution without a plan using DSPy.

        Used for simple tasks that don't require planning.
        """
        assert context.tool_provider is not None, "tool_provider required for direct execution"

        logger.info("🚀 Direct execution: Starting DSPy ReAct execution...")

        # Create DSPy tools with auth
        tools = create_all_tools(
            api_key=context.tool_provider.api_key,
            org_id=str(context.tool_provider.organization_id),
        )

        # Add ask_question tool for clarification
        question_collector = QuestionCollector()
        ask_question_tool = create_ask_question_tool(question_collector)
        all_tools = [ask_question_tool] + tools

        # Create executor
        executor = ExecutorModule(
            execution_tools=all_tools,
            max_iters=10,
        )

        # Get DSPy LM
        lm = get_dspy_lm(org_model=org_model)

        # Build minimal context
        execution_context = {
            "task": task,
            "org_id": str(context.tool_provider.organization_id),
        }

        try:
            # Execute with DSPy
            with dspy.context(lm=lm):
                result = executor(
                    step_description=task,
                    context=json.dumps(execution_context),
                )

            result_str = str(result)

            # Check for clarification questions
            if question_collector.has_questions():
                questions = question_collector.get_questions()
                logger.info(f"❓ Direct execution needs clarification: {len(questions)} question(s)")
                yield {
                    "type": "awaiting_input",
                    "data": {
                        "input_type": "questions",
                        "title": "Clarification Needed",
                        "content": "I need some additional information to complete this task.",
                        "questions": _format_dict_questions(questions),
                        "options": [],
                        "plan_json": ""
                    }
                }
                return

            logger.info(f"✅ Direct execution completed: {len(result_str)} chars")

            # Yield result as content chunks
            yield {
                "type": "step_progress",
                "step_type": "ACTION",
                "step_name": "Direct Execution",
                "content": "Task executed directly",
                "metadata": {},
                "step_index": 0
            }
            yield {
                "type": "content_chunk",
                "content": result_str
            }

        except Exception as e:
            logger.error(f"❌ Direct execution failed: {e}", exc_info=True)
            yield create_error_response(
                "DIRECT_EXECUTION_FAILED",
                f"Failed to execute task: {e}",
            )

    async def _handle_approval_response(
        self,
        context: 'ExecutionContext',
        tools: List[Any],
        task: str,
        sm: 'CoordinatorStateMachine',
    ) -> AsyncIterator[Any]:
        """Handle approval response for pending plan."""
        if is_approval_response(task):
            context.tool_mode = ToolMode.EXECUTION
            AgentExecutor.set_current_context(context)
            logger.info("✅ Coordinator: User approved, starting execution phase")

            coordinator_from_session = sm.context.coordinator
            plan_from_session = sm.context.plan

            if not coordinator_from_session or not plan_from_session:
                logger.error("📋 Coordinator: No coordinator/plan found in state machine")
                yield create_error_response(
                    "SESSION_STATE_ERROR",
                    "Session state lost. Please start over.",
                )
                sm.on_error("Session state lost")
                return

            sm.on_execution_started()

            try:
                await coordinator_from_session.approve_plan(plan_from_session.id)
            except Exception as e:
                logger.error(f"📋 Coordinator: Plan approval failed: {e}")
                sm.on_error(f"Plan approval failed: {e}")
                yield create_error_response(
                    "PLAN_APPROVAL_FAILED",
                    f"Failed to approve plan: {e}",
                )
                return

            # === PHASE 2: EXECUTION ===
            step_index = 0
            final_synthesis: Optional[str] = None
            execution_success = False

            async for event in coordinator_from_session.execute_plan(plan_from_session.id, tools):
                converted = convert_coordinator_event(event, step_index)
                if converted:
                    yield converted
                    step_index += 1

                # Check if execution paused for clarification - return early
                if isinstance(event, AwaitingClarificationEvent):
                    logger.info(f"📋 Execution paused for clarification: {len(event.questions)} question(s)")
                    return  # Don't show completion message - UI shows clarification questions

                if isinstance(event, FinalSynthesisEvent):
                    final_synthesis = event.synthesis
                elif isinstance(event, ExecutionCompletedEvent):
                    execution_success = event.success

            if execution_success:
                summary = final_synthesis or f"Plan executed successfully with {step_index} steps."
                yield {
                    "type": "content_chunk",
                    "content": f"\n\n✅ **Execution Complete**\n\n{summary}"
                }
            else:
                yield {
                    "type": "content_chunk",
                    "content": "\n\n⚠️ **Execution completed with issues.** Some steps may have failed."
                }

            sm.on_execution_complete()
            logger.info("✅ Coordinator: Execution complete, state cleared")

        else:
            # Feedback (not approval) - clear state and process with DSPy
            logger.info("📝 Coordinator: Feedback received (not approval), processing with DSPy direct execution")
            sm.context.clear()
            async for event in self._handle_direct_execution(
                context=context,
                task=task,
                org_model=None,  # Use default model
            ):
                yield event
            return

    def _get_managed_agents_list(self, managed_agents: Optional[List[Any]]) -> List[Any]:
        """Convert managed_agents to list format."""
        if managed_agents:
            if isinstance(managed_agents, dict):
                return list(managed_agents.values())
            return list(managed_agents)
        return []
