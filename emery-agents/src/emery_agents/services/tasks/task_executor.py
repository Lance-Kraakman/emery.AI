"""
Unified Task Executor.

Core task execution logic shared between:
- ExecuteTask gRPC (background/automation tasks)
- ProcessMessage gRPC (chat with task_id)

AIDEV-NOTE: Extracted from server.py:ExecuteTask to avoid duplication.
Both gRPC handlers now use this shared executor.

Credential resolution:
- Org-level task (agent_id is None): Use invoking user's credentials
- Agent task (agent_id is set): Use agent's stored credentials

Workspace locking:
- Agent tasks acquire workspace lock before execution
- Lock released after task completes (success or failure)
- Prevents user sync during agent execution
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, TypedDict

from emery_agents.api import AgentAPIService, SkillAPIService
from emery_agents.services.tasks import workspace_lock
from emery_agents.entities.skill_config import SkillConfig
from emery_agents.tools.execution.dynamic_execution import fetch_skill_execution_config
from emery_agents.tools.provider import ToolProvider

from ...entities.execution_context import ExecutionContext
from ...entities.task import TaskRequest
from ...types import ExecutionMode
from ..credentials import ResolvedCredentials
from ..executors.adapters import context_to_request
from ..executors.router import ExecutionRouter, get_execution_router


logger = logging.getLogger(__name__)


# =============================================================================
# Type Definitions
# =============================================================================


class TaskProgressDict(TypedDict, total=False):
    """Progress event yielded during task execution."""

    status: str  # "in_progress", "completed", "failed"
    output: str  # JSON-encoded output data
    error_message: str
    timestamp_ms: int
    progress_percent: float
    task_id: str  # Added by TaskExecutor
    token_usage: dict[str, int] | None


class TaskInstructionsDict(TypedDict, total=False):
    """Task instructions structure."""

    task: str
    images: list[dict[str, str]] | None
    tools: list[dict[str, object]] | None
    metadata: dict[str, object] | None


@dataclass
class TaskData:
    """
    Task data for execution.

    Can be built from:
    - TaskRequest proto (background execution)
    - ProcessMessageRequest with task_id (chat execution)
    """

    task_id: str
    organization_id: int

    # Assignment - None = org-level task
    agent_id: int | None = None
    skill_id: int | None = None

    # Execution details
    instructions: TaskInstructionsDict = field(
        default_factory=lambda: TaskInstructionsDict(task="")
    )
    skill_inputs: dict[str, object] = field(default_factory=dict)

    # Metadata
    created_by: str | None = None
    trigger_type: Literal["manual", "automation", "chat", "api", "webhook"] = "manual"

    # Model selection
    agent_model: str | None = None
    org_model: str | None = None

    # Workspace
    workspace_path: Path | None = None

    # API key for tool auth (passed via proto, agent key for agent tasks)
    user_api_key: str | None = None

    # Original TaskRequest (for full context building via AgentExecutor)
    # Used for background tasks where we need full proto context
    _task_request: TaskRequest | None = None


class TaskExecutor:
    """
    Unified task executor for all execution paths.

    Handles:
    - Credential resolution (org-level vs agent-level)
    - Execution context building
    - Streaming progress with task_id
    - Routing via ExecutionRouter to appropriate executor

    Two execution modes:
    - execute(): For background tasks with full TaskRequest proto
    - execute_with_context(): For chat tasks with pre-built ExecutionContext

    Usage:
        executor = TaskExecutor(api_service)

        # Background task (ExecuteTask gRPC)
        async for progress in executor.execute(task_data):
            yield progress

        # Chat task (ProcessMessage with task_id)
        async for progress in executor.execute_with_context(task_id, context):
            yield progress
    """

    def __init__(
        self,
        api_service: AgentAPIService | None = None,
        execution_router: ExecutionRouter | None = None,
    ):
        """
        Initialize task executor.

        Args:
            api_service: API service for credential/agent lookups
            execution_router: ExecutionRouter for routing to appropriate executor
        """
        self.api_service = api_service
        self.execution_router = execution_router

    async def execute(
        self,
        task_data: TaskData,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Execute a task and stream progress.

        For background tasks (ExecuteTask gRPC) - uses stored TaskRequest for
        full context building via AgentExecutor.determine_execution_context.

        Args:
            task_data: Task configuration and metadata (with _task_request if from proto)

        Yields:
            Progress events with task_id included
        """
        start_time = time.time()
        task_id = task_data.task_id
        lock_acquired = False

        logger.info(
            f"[TASK-{task_id[:8]}] Starting execution - "
            f"agent_id={task_data.agent_id}, skill_id={task_data.skill_id}, "
            f"trigger={task_data.trigger_type}"
        )

        try:
            # Acquire workspace lock if agent has a workspace
            if task_data.workspace_path and task_data.agent_id:
                lock_acquired = await workspace_lock.acquire_lock(
                    workspace_path=task_data.workspace_path,
                    task_id=task_id,
                    agent_id=task_data.agent_id,
                )
                if lock_acquired:
                    logger.info(f"[TASK-{task_id[:8]}] Workspace lock acquired")
            # 1. Resolve credentials based on task assignment
            credentials = await self._resolve_credentials(task_data)
            logger.info(
                f"[TASK-{task_id[:8]}] Credentials resolved from: {credentials.source}"
            )

            # 2. Build agent context headers for audit trail
            # These flow through ToolProvider → CRUD tools → make_request() → TS API routes
            agent_headers = self._build_agent_headers(task_data)

            # 3. Create ToolProvider with resolved credentials + agent context headers
            tool_provider = ToolProvider(
                api_key=credentials.api_key,
                organization_id=credentials.organization_id,
                extra_headers=agent_headers,
            )
            logger.info(
                f"[TASK-{task_id[:8]}] Created ToolProvider with {credentials.source} credentials"
            )

            # 4. Pre-fetch skill config from API if task executes a skill
            # Skills are no longer sent via gRPC proto — fetch from API with resolved credentials
            pre_fetched_skill = None
            if (
                task_data._task_request is not None
                and task_data._task_request.skill_name
            ):
                pre_fetched_skill = await self._fetch_skill_for_task(
                    skill_id=task_data._task_request.skill_id,
                    skill_name=task_data._task_request.skill_name,
                    api_key=credentials.api_key,
                    org_id=str(task_data.organization_id),
                )
                logger.info(
                    f"[TASK-{task_id[:8]}] Pre-fetched skill config: "
                    f"{pre_fetched_skill.name if pre_fetched_skill else 'NOT FOUND'}"
                )

            # 5. Build execution context
            context = self._build_execution_context(task_data, credentials)

            # 6. Inject ToolProvider into context for credential isolation
            context.tool_provider = tool_provider

            # 7. Add workspace path for bash tool access
            if task_data.workspace_path:
                context.workspace_path = task_data.workspace_path

            # 8. Inject pre-fetched skill if available
            if pre_fetched_skill:
                context.skill = pre_fetched_skill

            # 9. Execute via ExecutionRouter
            logger.info(f"[TASK-{task_id[:8]}] Using ExecutionRouter")
            async for progress in self._execute_via_router(context):
                progress["task_id"] = task_id
                yield progress

            # Log completion
            elapsed = time.time() - start_time
            logger.info(f"[TASK-{task_id[:8]}] Completed in {elapsed:.2f}s")

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[TASK-{task_id[:8]}] Failed after {elapsed:.2f}s: {e}")

            # Yield error progress
            yield {
                "task_id": task_id,
                "status": "failed",
                "error_message": str(e),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 0.0,
            }

        finally:
            # Release workspace lock if acquired
            if lock_acquired and task_data.workspace_path:
                released = await workspace_lock.release_lock(
                    workspace_path=task_data.workspace_path,
                    task_id=task_id,
                )
                if released:
                    logger.info(f"[TASK-{task_id[:8]}] Workspace lock released")

    async def execute_with_context(
        self,
        task_id: str,
        context: ExecutionContext,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Execute with a pre-built ExecutionContext.

        For chat tasks (ProcessMessage with task_id) where the context
        is built by ChatProcessingService.

        Args:
            task_id: Task ID for tracking
            context: Pre-built execution context

        Yields:
            Progress events with task_id included
        """
        start_time = time.time()

        logger.info(f"[TASK-{task_id[:8]}] Starting chat-based execution")

        try:
            # Execute via ExecutionRouter
            logger.info(f"[TASK-{task_id[:8]}] Using ExecutionRouter")
            async for progress in self._execute_via_router(context):
                progress["task_id"] = task_id
                yield progress

            elapsed = time.time() - start_time
            logger.info(f"[TASK-{task_id[:8]}] Completed in {elapsed:.2f}s")

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[TASK-{task_id[:8]}] Failed after {elapsed:.2f}s: {e}")

            yield {
                "task_id": task_id,
                "status": "failed",
                "error_message": str(e),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 0.0,
            }

    async def _execute_via_router(
        self,
        context: ExecutionContext,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Execute via the new ExecutionRouter.

        Converts ExecutionContext to typed request and routes to appropriate executor.

        Args:
            context: ExecutionContext to execute

        Yields:
            Progress dicts compatible with TaskProgressDict
        """
        from emery_agents.entities.configs import (
            CoordinatorRequest,
            InteractiveRequest,
            SkillRequest,
            WorkflowRequest,
        )
        from emery_agents.types import SkillExecutionResult

        router = self.execution_router or get_execution_router()
        request = context_to_request(context)

        logger.info(f"Routing via ExecutionRouter: {type(request).__name__}")

        # Route based on request type
        if isinstance(request, InteractiveRequest):
            async for progress in router.execute_interactive(request):
                yield dict(progress)

        elif isinstance(request, CoordinatorRequest):
            async for progress in router.execute_coordinator(request):
                yield dict(progress)

        elif isinstance(request, WorkflowRequest):
            async for progress in router.execute_workflow(request):
                yield dict(progress)

        elif isinstance(request, SkillRequest):
            # SkillRequest uses sync path - convert to async
            if request.skill.is_workflow():
                # Route to workflow executor
                workflow_request = WorkflowRequest(
                    steps=list(request.skill.steps),
                    initial_inputs=request.inputs,
                    auth=request.auth,
                    available_skills={s.id: s for s in request.available_skills},
                    skill_model=request.skill_model,
                )
                async for progress in router.execute_workflow(workflow_request):
                    yield dict(progress)
            else:
                # Run sync skill execution and yield result
                result = router.execute_skill(request)
                # Handle both str and SkillExecutionResult return types
                if isinstance(result, SkillExecutionResult):
                    output = result.result
                else:
                    output = str(result)
                yield {
                    "status": "completed",
                    "output": output,
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 1.0,
                }

    @staticmethod
    def _build_agent_headers(task_data: TaskData) -> dict[str, str] | None:
        """
        Build HTTP headers for agent context audit trail.

        These headers are sent with every CRUD tool request back to the
        TypeScript API, where they are extracted to set the audit actor
        and trigger metadata.
        """
        req = task_data._task_request
        if req is None:
            return None

        headers: dict[str, str] = {}

        if task_data.agent_id is not None:
            headers["X-Agent-ID"] = str(task_data.agent_id)
        if req.name:
            headers["X-Agent-Name"] = req.name
        headers["X-Task-ID"] = task_data.task_id
        if req.trigger_type:
            headers["X-Trigger-Type"] = req.trigger_type
        if req.triggered_by_user_id:
            headers["X-Triggered-By-User-Id"] = req.triggered_by_user_id
        if req.triggered_by_user_name:
            headers["X-Triggered-By-User-Name"] = req.triggered_by_user_name

        return headers if headers else None

    async def _resolve_credentials(
        self,
        task_data: TaskData,
    ) -> ResolvedCredentials:
        """
        Resolve credentials based on task assignment.

        Rules:
        - Org-level task (agent_id is None): Use invoking user's credentials
        - Agent task (agent_id is set): Use agent's stored credentials
        """
        # If user_api_key was passed via proto (fresh agent key from TS), use it directly
        if task_data.user_api_key:
            logger.info(
                f"[TASK-{task_data.task_id[:8]}] Using user_api_key from proto "
                f"(prefix={task_data.user_api_key[:8]}...)"
            )
            return ResolvedCredentials(
                api_key=task_data.user_api_key,
                organization_id=task_data.organization_id,
                source="agent" if task_data.agent_id else "user",
            )

        if task_data.agent_id is None:
            # Org-level task - use user credentials
            logger.debug(
                f"[TASK-{task_data.task_id[:8]}] Org-level task, using user credentials"
            )
            return await self._load_user_credentials(
                task_data.created_by,
                task_data.organization_id,
            )
        else:
            # Agent task - use agent's credentials
            logger.debug(
                f"[TASK-{task_data.task_id[:8]}] Agent task (agent_id={task_data.agent_id}), "
                "using agent credentials"
            )
            return await self._load_agent_credentials(
                task_data.agent_id,
                task_data.organization_id,
            )

    async def _load_user_credentials(
        self,
        user_id: str | None,
        organization_id: int,
    ) -> ResolvedCredentials:
        """
        Load credentials for user context (org-level tasks).

        For now, uses the API service's credentials.
        Future: Could look up user-specific API keys.
        """
        if self.api_service:
            return ResolvedCredentials(
                api_key=self.api_service.api_key,
                organization_id=organization_id,
                source="user",
            )

        # Fallback to environment
        api_key = os.getenv("HF_TOKEN", "")
        return ResolvedCredentials(
            api_key=api_key,
            organization_id=organization_id,
            source="user",
        )

    async def _load_agent_credentials(
        self,
        agent_id: int,
        organization_id: int,
    ) -> ResolvedCredentials:
        """
        Load stored credentials for an agent.

        Credentials are stored in agent's tool configs.
        """
        if not self.api_service:
            # Fallback to environment
            api_key = os.getenv("HF_TOKEN", "")
            return ResolvedCredentials(
                api_key=api_key,
                organization_id=organization_id,
                source="agent",
            )

        try:
            # Fetch agent to get its tool configs
            agent_data = await self.api_service.fetch_agent_by_id(agent_id)
            if not agent_data:
                logger.warning(
                    f"Agent {agent_id} not found, falling back to service credentials"
                )
                return ResolvedCredentials(
                    api_key=self.api_service.api_key,
                    organization_id=organization_id,
                    source="agent",
                )

            # Extract api_key from agent's tool configs
            extracted_api_key = self._extract_api_key_from_agent(agent_data.raw)
            if not extracted_api_key:
                logger.warning(
                    f"Agent {agent_id} has no stored api_key, using service credentials"
                )
                final_api_key = self.api_service.api_key
            else:
                final_api_key = extracted_api_key

            return ResolvedCredentials(
                api_key=final_api_key,
                organization_id=organization_id,
                source="agent",
            )

        except Exception as e:
            logger.error(f"Failed to load agent credentials: {e}")
            # Fall back to service credentials
            return ResolvedCredentials(
                api_key=self.api_service.api_key,
                organization_id=organization_id,
                source="agent",
            )

    def _extract_api_key_from_agent(self, agent_data: dict[str, object]) -> str | None:
        """Extract api_key from agent's tool configurations."""
        tools = agent_data.get("tools", [])
        if not isinstance(tools, list):
            return None
        for tool in tools:
            if not isinstance(tool, dict):
                continue
            config = tool.get("config", {})
            if isinstance(config, dict) and "api_key" in config:
                api_key = config["api_key"]
                return str(api_key) if api_key else None
        return None

    async def _fetch_skill_for_task(
        self,
        skill_id: int | None,
        skill_name: str,
        api_key: str,
        org_id: str,
    ) -> SkillConfig | None:
        """
        Fetch full skill config from API for task execution.

        Uses skill_id directly when available (sent via proto), falling back
        to name-based lookup for backwards compatibility with older clients.
        """
        try:
            resolved_skill_id = skill_id

            # Fallback: if no skill_id, look up by name
            if not resolved_skill_id:
                service = SkillAPIService(api_key=api_key, organization_id=int(org_id))
                skill_data = await service.fetch_skill_by_name(skill_name)
                if not skill_data:
                    logger.warning(f"Skill '{skill_name}' not found via API")
                    return None
                resolved_skill_id = int(skill_data.id)

            # Fetch full execution config (includes steps with agenticConfig.plan)
            result = fetch_skill_execution_config(resolved_skill_id, api_key, org_id)
            if result.get("success") is False:
                logger.warning(
                    f"Failed to fetch execution config for skill '{skill_name}': "
                    f"{result.get('error', 'unknown error')}"
                )
                return None

            # Extract skill DTO from response (may be at data.skill or data directly)
            data = result.get("data", {})
            skill_dto = data.get("skill", data) if isinstance(data, dict) else {}
            if isinstance(skill_dto, dict) and skill_dto:
                return SkillConfig.from_api_response(skill_dto)

            logger.warning(f"Empty skill data in execution config for '{skill_name}'")
            return None

        except Exception as e:
            logger.error(f"Error fetching skill config for task: {e}")
            return None

    def _build_execution_context(
        self,
        task_data: TaskData,
        credentials: ResolvedCredentials,
    ) -> ExecutionContext:
        """
        Build ExecutionContext for AgentExecutor.

        This reuses the same context structure that server.py:ExecuteTask uses.
        """
        # Determine execution mode
        if task_data.skill_id:
            mode = ExecutionMode.AUTONOMOUS
        elif task_data.agent_id:
            mode = ExecutionMode.INTERACTIVE
        else:
            mode = ExecutionMode.INTERACTIVE

        # Build context
        context = ExecutionContext(
            mode=mode,
            task=task_data.instructions.get("task", ""),
            available_tools=[],
            agent_id=task_data.agent_id,
            organization_id=str(task_data.organization_id),
            skill_name=None,  # Will be resolved from skill_id if needed
            skill_inputs=task_data.skill_inputs,
            agent_model=task_data.agent_model,
            org_model=task_data.org_model,
            workspace_path=task_data.workspace_path,
        )

        return context

    @staticmethod
    def from_task_request(
        task_request: TaskRequest,
    ) -> TaskData:
        """
        Build TaskData from entity TaskRequest.

        Used by ExecuteTask gRPC handler. Proto→entity conversion
        happens at the gRPC boundary before calling this method.
        """
        # Extract task instruction from instruction_config
        task_text = ""
        if task_request.instruction_config:
            task_text = task_request.instruction_config.task or ""

        # Build typed instructions dict
        instructions: TaskInstructionsDict = {"task": task_text}

        # Extract skill inputs from trigger_data
        skill_inputs: dict[str, object] = {}
        if task_request.trigger_data and task_request.trigger_data.skill_inputs:
            for input_val in task_request.trigger_data.skill_inputs:
                skill_inputs[input_val.name] = input_val.value

        # Convert organization_id to int (may be str from proto)
        org_id = task_request.organization_id
        org_id_int = int(org_id) if org_id else 0

        return TaskData(
            task_id=task_request.task_id,
            organization_id=org_id_int,
            agent_id=task_request.agent_id,
            skill_id=task_request.skill_id,
            instructions=instructions,
            skill_inputs=skill_inputs,
            created_by=None,  # Not available in TaskRequest
            trigger_type="automation",
            agent_model=task_request.agent_model,
            org_model=task_request.organization_model,
            user_api_key=task_request.user_api_key,
            # Store original request for full context building
            _task_request=task_request,
        )
