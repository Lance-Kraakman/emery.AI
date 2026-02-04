"""
Agent Streaming Handler

Handles the core agent execution flow with streaming responses.
Extracted from ChatProcessingService for maintainability.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import AsyncIterator, Optional, List, Dict, Any, Tuple

from emery_agents.tools.execution import SkillTool
from ..tools.tool_modes import filter_tools_for_mode, ToolMode
from ..services.agents.executor import AgentExecutor
from ..services.execution.state_machine import (
    Phase,
    ActionType,
)
from ..entities.execution_context import ExecutionContext
from ..types import ExecutionMode
from ..entities.models.plan import Plan, create_plan
from ..entities.models.capability import Capability, CapabilityType
from emery_agents.tools.provider import ToolProvider
from ..services.context.session_manager import SessionManager
from ..services.models.provider import ModelProvider
from emery_agents.tools.loader import UnifiedToolLoader
from ..services.skills.executor import SkillExecutorService
from ..services.plan_service import PlanService
# HuggingFaceInferenceClient removed - skills now executed dynamically via API
from ..utils.error_classifier import classify_error
from ..utils.error_messages import ErrorSeverity
from ..utils.mention_parser import parse_agent_mention, parse_skill_invocation
from .mention_routing import handle_agent_mention_routing
from .skill_mention_routing import handle_skill_mention_routing
from .message_processor import (
    extract_user_api_key_from_tools,
    extract_images_from_message,
    extract_text_from_message,
)
from .approval_handler import is_approval_response
from .response_types import (
    ErrorDetailsDict,
    ErrorDataDict,
    ErrorResponseDict,
    AwaitingInputResponseDict,
    StreamResponseDict,
)
from .generated import agent_worker_pb2
from .mappers.proto_mapper import tool_configs_from_proto
from .coordinator_streaming import CoordinatorStreamingHandler

from .mappers.message_types import ChatMessage
from ..entities.tool_config import ToolConfig
from ..entities.message import FileAttachment, HistoryMessage
from .agents.agent_models import ChatAgent, AgentDescriptor, get_builder_descriptors
from emery_agents.tools.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)


# AIDEV-NOTE: detect_skill_plan_from_invocation removed - skills now loaded dynamically via API
# @skill:name invocations are handled by skill_crud tool which fetches skill config at runtime


class AgentStreamingHandler:
    """
    Handles streaming agent responses with tool calling.

    Responsibilities:
    - HOT/COLD session path management
    - Managed agent creation and coordination
    - Tool conversion from protobuf to smolagents
    - Step-by-step streaming of agent execution
    - Token usage extraction

    Delegates coordinator logic to CoordinatorStreamingHandler.
    """

    def __init__(
        self,
        session_manager: 'SessionManager',
        model_provider: 'ModelProvider',
        skill_executor_service: 'SkillExecutorService',
        tool_loader: Optional['UnifiedToolLoader'],
        plan_service: 'PlanService',
        coordinator_handler: 'CoordinatorStreamingHandler',
        capability_registry: CapabilityRegistry,
    ):
        self.session_manager = session_manager
        self.model_provider = model_provider
        self.skill_executor_service = skill_executor_service
        self.tool_loader = tool_loader
        self.plan_service = plan_service
        self.coordinator_handler = coordinator_handler
        self.capability_registry = capability_registry

    async def stream_response(
        self,
        conversation_messages: List['ChatMessage'],
        tools: List[ToolConfig],
        domain_context: Optional['agent_worker_pb2.ChatContext'] = None,
        org_model: Optional[str] = None,
        has_images: bool = False,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        org_id: Optional[int] = None,
        conversation_history: Optional[List[HistoryMessage]] = None,
        agent_config: Optional['agent_worker_pb2.AgentConfig'] = None,
        user_api_key: Optional[str] = None,
        file_attachments: Optional[List[FileAttachment]] = None,
        workspace_path: Optional[Path] = None,
        workspace_id: Optional[str] = None,
        workspace_type: Optional[str] = None,
        workspace_org_id: Optional[int] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> AsyncIterator[StreamResponseDict]:
        """
        Stream AI response using ToolCallingAgent with stateful session support.

        Session Management:
        - HOT PATH: Reuse existing agent from session (agent.memory persists)
        - COLD PATH: Create new agent and restore from conversation history
        """
        # Reset thread-local state for new request
        SkillTool.reset_call_stack()
        SkillTool.reset_result_cache()

        try:
            # 1. Convert protobuf tools to smolagents tools
            smolagents_tools = self._convert_tools_to_smolagents(
                tools, agent_config=agent_config, org_model=org_model, org_id=org_id, api_key=user_api_key
            )
            logger.info(f"🔧 Converted {len(smolagents_tools)} tools for ToolCallingAgent")

            # 2. Get or create agent with session management
            logger.info(f"🔍 [SESSION-DEBUG] Checking for existing session: {session_id}")
            logger.info(f"🔍 [SESSION-DEBUG] Conversation history length: {len(conversation_history) if conversation_history else 0}")

            # Get effective API key BEFORE hot/cold path split
            effective_api_key = user_api_key or extract_user_api_key_from_tools(tools)
            if effective_api_key:
                logger.info(f"🔑 Using API key for tools (source: {'request' if user_api_key else 'tools'})")
            else:
                logger.warning("⚠️ No API key available for tools")

            # Create centralized tool provider (with audit headers if available)
            tool_provider = ToolProvider(effective_api_key or "", org_id or 0, extra_headers=extra_headers)

            agent = self.session_manager.get_agent(session_id, organization_id=org_id) if session_id else None

            if agent:
                # HOT PATH: Agent exists in memory
                logger.info(f"♻️  [HOT-PATH] Reusing existing agent from session {session_id}")
                logger.info(f"🧠 [MEMORY-DEBUG] Agent memory has {len(agent.memory.steps)} steps")

                step_types = [type(step).__name__ for step in agent.memory.steps]
                logger.info(f"🧠 [MEMORY-DEBUG] Step types: {step_types}")

                # Add new file attachments to existing session
                if file_attachments and session_id:
                    self.session_manager.add_attachments(session_id, file_attachments)
                    logger.info(f"📎 Added {len(file_attachments)} new attachments to existing session")
            else:
                # COLD PATH: Create new agent and restore from history
                logger.info(f"✨ [COLD-PATH] Creating new agent for session {session_id}")

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

            logger.info(f"🤖 Using ToolCallingAgent with {len(smolagents_tools)} tools")
            logger.info(f"🧠 [MEMORY-DEBUG] Final agent memory before execution: {len(agent.memory.steps)} steps")

            # Debug managed agents
            logger.info(f"📋 [MANAGED-AGENTS-DEBUG] Managed agents dict: {list(agent.managed_agents.keys())}")
            if agent.managed_agents:
                logger.info(f"📋 [MANAGED-AGENTS-DEBUG] System prompt includes 'team members': {'team members' in agent.system_prompt.lower()}")
                logger.info(f"📋 [MANAGED-AGENTS-DEBUG] System prompt preview (first 1500 chars):\n{agent.system_prompt[:1500]}")

            # 4. Extract current user message
            last_message = conversation_messages[-1] if conversation_messages else None
            images = extract_images_from_message(last_message) if last_message else []
            current_task = extract_text_from_message(last_message) if last_message else "Continue the conversation"

            logger.info(f"🖼️ Extracted {len(images)} images from last message")
            logger.info(f"💬 Current task: {len(current_task)} chars")
            logger.info(f"🧠 Agent memory: {len(agent.memory.steps)} steps")

            # === @AGENT MENTION DETECTION ===
            cleaned_task, agent_mention = parse_agent_mention(current_task)
            if agent_mention:
                logger.info(f"🎯 Detected @agent mention: '{agent_mention}'")
                async for event in handle_agent_mention_routing(
                    agent_mention=agent_mention,
                    task=cleaned_task,
                    tool_provider=tool_provider,
                    skill_executor_service=self.skill_executor_service,
                    org_model=org_model,
                    images=images,
                ):
                    yield event
                return  # Agent mention handled

            # === @SKILL MENTION DETECTION ===
            skill_invocation = parse_skill_invocation(current_task)
            if skill_invocation:
                logger.info(f"🎯 Detected @skill mention: '{skill_invocation.skill_name}' with {len(skill_invocation.inputs)} inputs")
                async for event in handle_skill_mention_routing(
                    skill_invocation=skill_invocation,
                    tool_provider=tool_provider,
                    org_model=org_model,
                    original_message=current_task,
                ):
                    yield event
                return  # Skill mention handled

            # Stream agent execution with coordinator
            async for event in self._execute_with_streaming(
                agent=agent,
                smolagents_tools=smolagents_tools,
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
            ):
                yield event

        except Exception as e:
            async for event in self._handle_execution_error(e, agent if 'agent' in locals() else None, session_id, current_task if 'current_task' in locals() else None):
                yield event

        finally:
            # Reset error count on successful completion
            if session_id and 'error_info' not in locals():
                self.session_manager.reset_error_count(session_id)

    async def _create_agent_cold_path(
        self,
        tool_provider: ToolProvider,
        smolagents_tools: List[Any],
        org_model: Optional[str],
        has_images: bool,
        file_attachments: Optional[List],
        session_id: Optional[str],
        user_id: Optional[str],
        org_id: Optional[int],
        conversation_history: Optional[List[HistoryMessage]],
        workspace_path: Optional[Path] = None,
        workspace_id: Optional[str] = None,
        workspace_type: Optional[str] = None,
        workspace_org_id: Optional[int] = None,
    ) -> ChatAgent:
        """Create new agent and restore from history (COLD PATH).

        AIDEV-NOTE: This now creates a ChatAgent (dataclass) instead of smolagents
        ToolCallingAgent. Execution happens via DSPy ExecutorModule, not agent.run().
        The ChatAgent only stores managed_agents descriptors for prompt templates.
        """
        # Get builder descriptors (replaces smolagents agent creation)
        descriptors = get_builder_descriptors()
        logger.info(f"📋 Loaded {len(descriptors)} agent descriptors for prompt templates")

        # Create ChatAgent with descriptors
        agent = ChatAgent.create(
            managed_agents=descriptors,
            system_prompt="",  # Not used - DSPy handles prompts
        )

        logger.info(f"🧠 [MEMORY-DEBUG] New ChatAgent created, memory steps: {len(agent.memory.steps)}")

        # Restore agent memory from conversation history
        if conversation_history and len(conversation_history) > 0:
            logger.info(f"📚 [RESTORE-DEBUG] Restoring {len(conversation_history)} messages from history")
            restored_count = await self.session_manager.restore_agent_from_history(
                agent, conversation_history
            )
            logger.info(f"📚 [RESTORE-DEBUG] Restored {restored_count} messages to agent memory")
            logger.info(f"🧠 [MEMORY-DEBUG] After restoration, memory has {len(agent.memory.steps)} steps")

            for i, step in enumerate(agent.memory.steps[:5]):
                logger.info(f"🧠 [MEMORY-DEBUG] Step {i}: {type(step).__name__}")
        else:
            logger.info(f"📚 [RESTORE-DEBUG] No conversation history to restore")

        # Register agent in session manager
        if session_id:
            self.session_manager.register_agent(
                session_id=session_id,
                agent=agent,
                organization_id=org_id or 0,
                user_id=user_id or "",
                restored_from_history=bool(conversation_history),
                history_message_count=len(conversation_history) if conversation_history else 0,
                workspace_path=workspace_path,
                workspace_id=workspace_id,
                workspace_type=workspace_type,
                workspace_org_id=workspace_org_id,
            )

            if file_attachments:
                self.session_manager.add_attachments(session_id, file_attachments)
                logger.info(f"📎 Added {len(file_attachments)} attachments to session")

            # Restore file attachments from history
            if conversation_history:
                history_attachments = self.session_manager.extract_file_attachments_from_history(
                    conversation_history
                )
                if history_attachments:
                    self.session_manager.add_attachments(session_id, history_attachments)
                    logger.info(f"📎 Restored {len(history_attachments)} attachments from history")

        return agent

    async def _execute_with_streaming(
        self,
        agent: Any,
        smolagents_tools: List[Any],
        tool_provider: ToolProvider,
        current_task: str,
        images: List,
        session_id: Optional[str],
        org_model: Optional[str],
        agent_config: Optional['agent_worker_pb2.AgentConfig'],
        file_attachments: Optional[List],
        conversation_history: Optional[List[HistoryMessage]],
        workspace_path: Optional[Path] = None,
        user_id: Optional[str] = None,
        workspace_type: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> AsyncIterator[StreamResponseDict]:
        """Execute agent with streaming and coordinator integration."""
        step_index = 0
        final_answer_text = ""

        # Check for managed agent HITL state (state machine only used for managed agent HITL now)
        # Coordinator routing is handled by LangGraph graph interrupt/resume in stream_response()
        sm = self.session_manager.get_or_create_state_machine(session_id) if session_id else None
        skip_coordinator = False

        if sm and sm.phase == Phase.AWAITING_QUESTIONS:
            # Managed agent HITL response — skip coordinator and fall through to agent.run()
            input_type = "approval" if is_approval_response(current_task) else "feedback"
            logger.info(f"Processing managed agent HITL response: {input_type}")
            action = sm.handle_input(input_type, current_task)

            if action.action_type == ActionType.FALL_THROUGH:
                skip_coordinator = True
                if action.combined_task:
                    current_task = action.combined_task
                logger.info("HITL response, skipping coordinator - will resume managed agent")

        # Create Plan for tracking
        current_plan: Plan | None = None
        if agent.managed_agents and (not sm or sm.phase == Phase.IDLE):
            current_plan = create_plan(
                goal=current_task[:200] if len(current_task) > 200 else current_task,
                basic_instructions=current_task
            )
            logger.info(f"📋 Created plan {current_plan.id} for task: {current_plan.goal[:100]}...")

        # Set execution context
        session_attachments = self.session_manager.get_attachments(session_id) if session_id else []
        collected_nested_steps: List[Dict[str, Any]] = []

        def progress_callback(step_dict: Dict[str, Any]) -> None:
            step_dict['nested'] = True
            collected_nested_steps.append(step_dict)
            logger.info(f"📥 Collected nested step: {step_dict.get('step_name', 'unknown')}")

        context = ExecutionContext(
            mode=ExecutionMode.INTERACTIVE,
            task=current_task,
            available_tools=[],
            images=[],
            attachments=file_attachments or [],
            session_attachments=session_attachments,
            progress_callback=progress_callback,
            tool_mode=ToolMode.EXECUTION,
            organization_id=str(tool_provider.organization_id),
            tool_provider=tool_provider,
            workspace_path=workspace_path,
        )
        AgentExecutor.set_current_context(context)
        logger.info(f"📎 Set execution context: {len(file_attachments or [])} current, {len(session_attachments)} session files")

        # Get managed agents for coordinator
        managed_agents = []
        if hasattr(agent, 'managed_agents') and agent.managed_agents:
            managed_agents = list(agent.managed_agents.values())

        # AIDEV-NOTE: Skills removed from gRPC - discovered and executed dynamically via skill_crud tool
        # @skill:name invocations and stored plans are now handled by the skill_crud execute method
        # which fetches skill config via API at runtime
        stored_plan = None
        skill_inputs: Optional[Dict[str, str]] = None

        # Coordinator handles all execution paths
        should_fall_through = skip_coordinator
        if not skip_coordinator:
            async for event in self.coordinator_handler.stream_response(
                context=context,
                tools=smolagents_tools,
                task=current_task,
                session_id=session_id,
                org_model=org_model,
                managed_agents=managed_agents,
                stored_plan=stored_plan,
                conversation_history=conversation_history,
                capability_registry=self.capability_registry,
                user_id=user_id,
                workspace_type=workspace_type,
                workspace_id=workspace_id,
                runtime_skill_inputs=skill_inputs,
                images=images,
                has_images=len(images) > 0,
            ):
                if isinstance(event, dict):
                    yield event  # type: ignore[misc]  # Coordinator returns compatible dicts

        if not should_fall_through:
            return

        # DSPy direct execution fallback (for skip_coordinator case)
        # This replaces the smolagents ToolCallingAgent execution
        logger.info("🚀 DSPy fallback: Executing task directly with DSPy...")

        try:
            from ..reasoning.config import get_dspy_lm
            from ..reasoning.modules.executor import ExecutorModule
            from emery_agents.tools.factories import create_all_tools
            from ..services.analysis.llm_usage import record_from_lm

            import dspy

            # Create DSPy tools
            dspy_tools = create_all_tools(
                org_id=str(tool_provider.organization_id),
            )

            # Create executor
            executor = ExecutorModule(
                execution_tools=dspy_tools,
                max_iters=10,
            )

            # Get DSPy LM
            lm = get_dspy_lm(org_model=org_model)

            # Build context
            execution_context = {
                "task": current_task,
                "org_id": str(tool_provider.organization_id),
            }

            # Execute with DSPy
            with dspy.context(lm=lm):
                result = executor(
                    step_description=current_task,
                    context=json.dumps(execution_context),
                )
            record_from_lm(lm)

            result_str = str(result)
            logger.info(f"✅ DSPy execution completed: {len(result_str)} chars")

            # Yield progress and result
            yield {
                "type": "step_progress",
                "step_type": "ACTION",
                "step_name": "Direct Execution",
                "content": "Task executed with DSPy",
                "metadata": {},
                "step_index": 0
            }

            # Stream result in chunks
            async for chunk in self._stream_text_chunks(result_str):
                yield {
                    "type": "content_chunk",
                    "content": chunk
                }

        except Exception as e:
            logger.error(f"❌ DSPy fallback execution failed: {e}", exc_info=True)
            error_response: ErrorResponseDict = {
                "type": "error",
                "error": {
                    "error_code": "EXECUTION_FAILED",
                    "error_message": f"Failed to execute task: {e}",
                    "error_details": {
                        "severity": "error",
                    },
                    "hint": "Please try again or rephrase your request.",
                    "can_retry": True,
                    "auto_retry": False,
                    "session_reset": False,
                }
            }
            yield error_response

        # Clear execution context
        if file_attachments:
            AgentExecutor.set_current_context(None)
            logger.debug("📎 Cleared execution context")

        logger.info("✅ DSPy fallback completed")

    async def _handle_execution_error(
        self,
        e: Exception,
        agent: Any,
        session_id: Optional[str],
        current_task: Optional[str],
    ) -> AsyncIterator[StreamResponseDict]:
        """Handle execution errors including HITL interrupts."""
        # Check for HITL Interrupt
        if "interrupted" in str(e).lower():
            logger.info("⏸️ Agent interrupted for user approval (HITL workflow)")

            plan_content = None

            # Check parent agent memory
            if agent:
                for step in reversed(agent.memory.steps):
                    if hasattr(step, 'plan') and step.plan:
                        plan_content = step.plan
                        logger.info(f"📋 Found plan in parent agent memory ({len(plan_content)} chars)")
                        break

                # Check managed agents' memory
                if not plan_content and hasattr(agent, 'managed_agents'):
                    for name, managed_agent in agent.managed_agents.items():
                        if hasattr(managed_agent, 'memory') and managed_agent.memory:
                            for step in reversed(managed_agent.memory.steps):
                                if hasattr(step, 'plan') and step.plan:
                                    plan_content = step.plan
                                    logger.info(f"📋 Found plan in {name} agent memory ({len(plan_content)} chars)")
                                    break
                        if plan_content:
                            break

            awaiting_input_response: AwaitingInputResponseDict = {
                "type": "awaiting_input",
                "data": {
                    "input_type": "plan_approval",
                    "title": "Proposed Plan",
                    "content": plan_content or "Waiting for your approval to proceed.",
                    "options": [
                        {"id": "approve", "label": "Approve", "description": "Execute the plan as-is"}
                    ],
                    "plan_json": ""
                }
            }
            yield awaiting_input_response

            # Preserve state for managed agent HITL
            if session_id:
                sm = self.session_manager.get_state_machine(session_id)
                if sm and current_task:
                    sm.on_managed_agent_hitl(task=current_task)
                    logger.info(f"📊 Session {session_id}: Managed agent HITL, awaiting questions/approval")
            return

        # Comprehensive error recovery
        error_info = classify_error(e)

        logger.error(f"❌ Agent execution failed: {error_info.technical_details}", exc_info=True)
        logger.error(f"📊 Error classification: type={error_info.error_type}, "
                    f"severity={error_info.severity.value}, "
                    f"can_retry={error_info.can_retry}")

        session_was_reset = False

        if error_info.severity == ErrorSeverity.TRANSIENT:
            logger.info(f"⏳ Transient error detected: {error_info.error_type}")
            logger.info("💡 Session preserved for manual retry")

        elif error_info.severity == ErrorSeverity.RECOVERABLE:
            if session_id:
                logger.info(f"🔄 Recoverable error - preserving session {session_id} for continuation")
                self.session_manager.increment_error_count(session_id, error_info.error_type)

                if self.session_manager.should_remove_session_on_error(session_id, threshold=5):
                    logger.warning(f"🚨 Too many consecutive errors - removing session {session_id}")
                    await self.session_manager.remove_session_on_error(session_id, "error_threshold")
                    session_was_reset = True
            else:
                logger.warning("⚠️ No session_id provided - cannot track errors")

        elif error_info.severity == ErrorSeverity.FATAL:
            truly_fatal = error_info.error_type in ['AUTH_FAILURE', 'RESOURCE_NOT_FOUND', 'PERMISSION_DENIED']

            if truly_fatal and session_id:
                logger.error(f"💀 Truly fatal error - removing session {session_id}")
                await self.session_manager.remove_session_on_error(session_id, error_info.error_type)
                session_was_reset = True
                sm = self.session_manager.get_state_machine(session_id)
                if sm:
                    sm.on_error(error_info.error_type, fatal=True)
            elif session_id:
                logger.warning(f"⚠️ Error marked fatal but preserving session for retry: {error_info.error_type}")
                self.session_manager.increment_error_count(session_id, error_info.error_type)

        error_details: ErrorDetailsDict = {"severity": error_info.severity.value}
        error_data: ErrorDataDict = {
            "error_code": error_info.error_type,
            "error_message": error_info.user_message,
            "error_details": error_details,
            "hint": error_info.hint or "",
            "can_retry": error_info.can_retry,
            "auto_retry": False,
            "session_reset": session_was_reset
        }
        error_response: ErrorResponseDict = {
            "type": "error",
            "error": error_data
        }
        yield error_response

        logger.info(f"📨 Sent user-friendly error message (type={error_info.error_type})")

    def _convert_tools_to_smolagents(
        self,
        tools: List[ToolConfig],
        agent_config: Optional['agent_worker_pb2.AgentConfig'] = None,
        org_model: Optional[str] = None,
        org_id: Optional[int] = None,
        api_key: Optional[str] = None
    ) -> List[Any]:
        """Convert entity ToolConfig objects to smolagents tools."""
        if not self.tool_loader:
            logger.error("❌ Tool registry not available - tools cannot be loaded")
            return []

        # AIDEV-NOTE: Skills removed from gRPC - executed dynamically via skill_crud tool

        return self.tool_loader.load_tools_from_configs(
            tool_configs=tools,
            api_key=api_key,
            api_key_mode="user",
            organization_id=org_id,
        )

    # _get_or_create_inference_client removed - skills now executed dynamically via API

    async def _stream_text_chunks(self, text: str, chunk_size: int = 5) -> AsyncIterator[str]:
        """Stream text by word chunks to simulate streaming."""
        words = text.split()
        for i in range(0, len(words), chunk_size):
            chunk = ' '.join(words[i:i + chunk_size]) + ' '
            yield chunk
            await asyncio.sleep(0.05)
