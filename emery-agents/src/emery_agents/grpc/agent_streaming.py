"""
Agent Streaming Handler - Handles the core agent execution flow with streaming responses.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, cast

import dspy

from emery_agents.planning.registry import PlanningRegistry
from emery_agents.services.analysis.llm_usage import record_from_lm
from emery_agents.services.analysis.token_accumulator import TokenAccumulator
from emery_agents.tools.capability_registry import CapabilityRegistry
from emery_agents.tools.factories import create_all_tools
from emery_agents.tools.provider import ToolProvider

from ..entities.execution_context import ExecutionContext
from ..entities.message import FileAttachment, HistoryMessage
from ..entities.tool_config import ToolConfig
from ..reasoning.config import get_dspy_lm
from ..reasoning.modules.executor import ExecutorModule
from ..services.agents.executor import AgentExecutor
from ..services.context.session_manager import SessionManager
from ..services.execution.state_machine import ActionType, Phase
from ..services.models.provider import ModelProvider
from ..services.plan_service import PlanService
from ..services.skills.executor import SkillExecutorService
from ..tools.execution.skill import SkillTool
from ..tools.loader import UnifiedToolLoader
from ..tools.tool_modes import ToolMode
from ..types import ExecutionMode
from ..utils.error_classifier import classify_error
from ..utils.error_messages import ErrorSeverity
from ..utils.mention_parser import (
    count_all_mentions,
    parse_agent_mention,
    parse_skill_invocation,
    parse_tool_mention,
)
from .agents.agent_models import ChatAgent, get_builder_descriptors
from .approval_handler import is_approval_response
from .coordinator_streaming import CoordinatorStreamingHandler
from .mappers.message_types import ChatMessage
from .message_processor import (
    extract_images_from_message,
    extract_text_from_message,
    extract_user_api_key_from_tools,
)
from .response_types import (
    StreamResponseDict,
)
from .types import CoordinatorStreamingParams

logger = logging.getLogger(__name__)


class AgentStreamingHandler:
    """
    Handles streaming agent responses with tool calling.
    Delegates coordinator logic to CoordinatorStreamingHandler.
    """

    def __init__(
        self,
        session_manager: SessionManager,
        model_provider: ModelProvider,
        skill_executor_service: SkillExecutorService,
        tool_loader: UnifiedToolLoader | None,
        plan_service: PlanService,
        coordinator_handler: CoordinatorStreamingHandler,
        capability_registry: CapabilityRegistry,
        planning_registry: PlanningRegistry | None = None,
    ):
        self.session_manager = session_manager
        self.model_provider = model_provider
        self.skill_executor_service = skill_executor_service
        self.tool_loader = tool_loader
        self.plan_service = plan_service
        self.coordinator_handler = coordinator_handler
        self.capability_registry = capability_registry
        self.planning_registry = planning_registry

    async def stream_response(
        self,
        conversation_messages: list[ChatMessage],
        tools: list[ToolConfig],
        token_accumulator: TokenAccumulator,
        domain_context: dict[str, Any] | None = None,
        org_model: str | None = None,
        has_images: bool = False,
        session_id: str | None = None,
        user_id: str | None = None,
        org_id: int | None = None,
        conversation_history: list[HistoryMessage] | None = None,
        agent_config: Any | None = None,
        user_api_key: str | None = None,
        file_attachments: list[FileAttachment] | None = None,
        workspace_path: Path | None = None,
        workspace_id: str | None = None,
        workspace_type: str | None = None,
        workspace_org_id: int | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> AsyncIterator[StreamResponseDict]:
        """Stream AI response with HOT/COLD session path management."""
        SkillTool.reset_call_stack()
        SkillTool.reset_result_cache()

        agent: ChatAgent | None = None
        current_task: str = "Starting conversation..."

        try:
            smolagents_tools = self._convert_tools_to_smolagents(
                tools,
                agent_config=agent_config,
                org_model=org_model,
                org_id=org_id,
                api_key=user_api_key,
            )
            effective_api_key = user_api_key or extract_user_api_key_from_tools(tools)
            tool_provider = ToolProvider(
                effective_api_key or "", org_id or 0, extra_headers=extra_headers
            )

            agent = (
                self.session_manager.get_agent(session_id, organization_id=org_id)
                if session_id
                else None
            )

            if agent:
                logger.info(f"♻️  [HOT-PATH] Reusing agent from session {session_id}")
                if file_attachments and session_id:
                    self.session_manager.add_attachments(session_id, file_attachments)
            else:
                logger.info(
                    f"✨ [COLD-PATH] Creating new agent for session {session_id}"
                )
                agent = await self._create_agent_cold_path(
                    tool_provider=tool_provider,
                    smolagents_tools=smolagents_tools,
                    org_model=org_model,
                    has_images=has_images,
                    file_attachments=file_attachments,
                    session_id=session_id,
                    user_id=user_id,
                    org_id=org_id,
                    conversation_history=conversation_history,
                    workspace_path=workspace_path,
                    workspace_id=workspace_id,
                    workspace_type=workspace_type,
                    workspace_org_id=workspace_org_id,
                )

            last_message = conversation_messages[-1] if conversation_messages else None
            images = extract_images_from_message(last_message) if last_message else []
            current_task = (
                extract_text_from_message(last_message)
                if last_message
                else "Continue..."
            )

            pre_selected_skill, pre_selected_agent, pre_selected_tool = None, None, None
            if count_all_mentions(current_task) == 1:
                _, agent_mention = parse_agent_mention(current_task)
                skill_invocation = (
                    parse_skill_invocation(current_task) if not agent_mention else None
                )
                _, tool_mention = (
                    parse_tool_mention(current_task)
                    if not agent_mention and not skill_invocation
                    else (current_task, None)
                )
                pre_selected_agent = agent_mention
                pre_selected_skill = (
                    skill_invocation.skill_name if skill_invocation else None
                )
                pre_selected_tool = tool_mention

            async for event in self._execute_with_streaming(
                agent=agent,
                tools=smolagents_tools,
                tool_provider=tool_provider,
                current_task=current_task,
                images=images,
                session_id=session_id,
                org_model=org_model,
                agent_config=agent_config,
                file_attachments=file_attachments,
                conversation_history=conversation_history,
                workspace_path=workspace_path,
                user_id=user_id,
                workspace_type=workspace_type,
                workspace_id=workspace_id,
                pre_selected_skill=pre_selected_skill,
                pre_selected_agent=pre_selected_agent,
                pre_selected_tool=pre_selected_tool,
                token_accumulator=token_accumulator,
            ):
                yield event

        except Exception as e:
            async for event in self._handle_execution_error(
                e, agent, session_id, current_task
            ):
                yield event
        finally:
            if session_id and "error_info" not in locals():
                self.session_manager.reset_error_count(session_id)

    async def _create_agent_cold_path(self, **kwargs: Any) -> ChatAgent:
        """Create new agent and restore from history (COLD PATH)."""
        agent = ChatAgent.create(
            managed_agents=get_builder_descriptors(), system_prompt=""
        )
        session_id = kwargs.get("session_id")
        conversation_history = kwargs.get("conversation_history")

        if conversation_history:
            await self.session_manager.restore_agent_from_history(
                agent, conversation_history
            )

        if session_id:
            self.session_manager.register_agent(
                session_id=session_id,
                agent=agent,
                organization_id=kwargs.get("org_id") or 0,
                user_id=kwargs.get("user_id") or "",
                restored_from_history=bool(conversation_history),
                history_message_count=len(conversation_history)
                if conversation_history
                else 0,
                **{
                    k: v
                    for k, v in kwargs.items()
                    if k
                    in [
                        "workspace_path",
                        "workspace_id",
                        "workspace_type",
                        "workspace_org_id",
                    ]
                },
            )
            if kwargs.get("file_attachments"):
                self.session_manager.add_attachments(
                    session_id, kwargs["file_attachments"]
                )
            if conversation_history:
                history_attachments = (
                    self.session_manager.extract_file_attachments_from_history(
                        conversation_history
                    )
                )
                if history_attachments:
                    self.session_manager.add_attachments(
                        session_id, history_attachments
                    )
        return agent

    async def _execute_with_streaming(
        self,
        agent: ChatAgent,
        tool_provider: ToolProvider,
        current_task: str,
        token_accumulator: TokenAccumulator,
        tools: list[Any],
        **kwargs: Any,
    ) -> AsyncIterator[StreamResponseDict]:
        """Execute agent with streaming and coordinator integration."""
        session_id = kwargs.get("session_id")
        sm = (
            self.session_manager.get_or_create_state_machine(session_id)
            if session_id
            else None
        )
        skip_coordinator = False

        if sm and sm.phase == Phase.AWAITING_QUESTIONS:
            action = sm.handle_input(
                "approval" if is_approval_response(current_task) else "feedback",
                current_task,
            )
            if action.action_type == ActionType.FALL_THROUGH:
                skip_coordinator = True
                if action.combined_task:
                    current_task = action.combined_task

        session_attachments = (
            self.session_manager.get_attachments(session_id) if session_id else []
        )
        context = ExecutionContext(
            mode=ExecutionMode.INTERACTIVE,
            task=current_task,
            available_tools=[],
            attachments=kwargs.get("file_attachments") or [],
            session_attachments=session_attachments,
            tool_mode=ToolMode.EXECUTION,
            organization_id=tool_provider.organization_id,
            tool_provider=tool_provider,
            workspace_path=kwargs.get("workspace_path"),
        )
        AgentExecutor.set_current_context(context)

        if not skip_coordinator:
            # Extract only coordinator-accepted params from kwargs (type-safe)
            coordinator_params: CoordinatorStreamingParams = {
                k: kwargs[k]
                for k in CoordinatorStreamingParams.__annotations__
                if k in kwargs
            }
            async for event in self.coordinator_handler.stream_response(
                context=context,
                task=current_task,
                managed_agents=list(agent.managed_agents.values()),
                capability_registry=self.capability_registry,
                planning_registry=self.planning_registry,
                token_accumulator=token_accumulator,
                tools=tools,
                **coordinator_params,
            ):
                if isinstance(event, dict):
                    yield cast(StreamResponseDict, event)
            return

        logger.info("🚀 DSPy fallback: Executing task directly...")
        try:
            dspy_tools = create_all_tools(
                api_key=tool_provider.api_key, org_id=str(tool_provider.organization_id)
            )
            executor = ExecutorModule(execution_tools=dspy_tools, max_iters=10)
            lm = get_dspy_lm(org_model=kwargs.get("org_model"))

            with dspy.context(lm=lm):
                result = executor(
                    step_description=current_task,
                    context=json.dumps(
                        {
                            "task": current_task,
                            "org_id": str(tool_provider.organization_id),
                        }
                    ),
                )
            record_from_lm(lm, token_accumulator.get_llm_tracker())

            result_str = str(result)
            yield cast(
                StreamResponseDict,
                {
                    "type": "step_progress",
                    "step_type": "ACTION",
                    "step_name": "Direct Execution",
                    "content": "Task executed.",
                    "metadata": {},
                    "step_index": 0,
                },
            )
            async for chunk in self._stream_text_chunks(result_str):
                yield cast(
                    StreamResponseDict, {"type": "content_chunk", "content": chunk}
                )

        except Exception as e:
            logger.error(f"❌ DSPy fallback execution failed: {e}", exc_info=True)
            yield cast(
                StreamResponseDict,
                {
                    "type": "error",
                    "error": {
                        "error_code": "EXECUTION_FAILED",
                        "error_message": f"Failed to execute task: {e}",
                    },
                },
            )
        finally:
            AgentExecutor.set_current_context(None)

    async def _handle_execution_error(
        self,
        e: Exception,
        agent: ChatAgent | None,
        session_id: str | None,
        current_task: str | None,
    ) -> AsyncIterator[StreamResponseDict]:
        """Handle execution errors, including HITL interrupts."""
        if "interrupted" in str(e).lower():
            plan_content = self._find_plan_in_memory(agent) if agent else None
            yield cast(
                StreamResponseDict,
                {
                    "type": "awaiting_input",
                    "data": {
                        "input_type": "plan_approval",
                        "title": "Proposed Plan",
                        "content": plan_content or "Approval needed.",
                    },
                },
            )
            if session_id and current_task:
                sm = self.session_manager.get_state_machine(session_id)
                if sm:
                    sm.on_managed_agent_hitl(task=current_task)
            return

        error_info = classify_error(e)
        logger.error(
            f"❌ Agent execution failed: {error_info.technical_details}", exc_info=True
        )
        session_was_reset = False

        if session_id:
            if error_info.severity in [ErrorSeverity.RECOVERABLE, ErrorSeverity.FATAL]:
                self.session_manager.increment_error_count(
                    session_id, error_info.error_type
                )
                if self.session_manager.should_remove_session_on_error(session_id):
                    await self.session_manager.remove_session_on_error(
                        session_id, "error_threshold"
                    )
                    session_was_reset = True

        yield cast(
            StreamResponseDict,
            {
                "type": "error",
                "error": {
                    "error_code": error_info.error_type,
                    "error_message": error_info.user_message,
                    "session_reset": session_was_reset,
                },
            },
        )

    def _find_plan_in_memory(self, agent: ChatAgent) -> str | None:
        """Find the most recent plan in the agent's or its managed agents' memory."""
        for step in reversed(agent.memory.steps):
            if hasattr(step, "plan") and step.plan:
                return cast(str, step.plan)
        for managed_agent in agent.managed_agents.values():
            if hasattr(managed_agent, "memory") and hasattr(managed_agent, "memory"):
                for step in reversed(managed_agent.memory.steps):
                    if hasattr(step, "plan") and step.plan:
                        return cast(str, step.plan)
        return None

    def _convert_tools_to_smolagents(
        self, tools: list[ToolConfig], **kwargs: Any
    ) -> list[Any]:
        """Convert entity ToolConfig objects to smolagents tools."""
        if not self.tool_loader:
            return []
        return self.tool_loader.load_tools_from_configs(
            tool_configs=tools,
            api_key=kwargs.get("api_key"),
            api_key_mode="user",
            organization_id=kwargs.get("org_id"),
        )

    async def _stream_text_chunks(
        self, text: str, chunk_size: int = 5
    ) -> AsyncIterator[str]:
        """Stream text by word chunks."""
        words = text.split()
        for i in range(0, len(words), chunk_size):
            yield " ".join(words[i : i + chunk_size]) + " "
            await asyncio.sleep(0.05)
