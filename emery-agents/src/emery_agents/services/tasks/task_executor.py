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
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator, Dict, Optional, TYPE_CHECKING

from ..agents.api import AgentAPIService

if TYPE_CHECKING:
    from ..agents.executor import AgentExecutor
    from ...entities.execution_context import ExecutionContext
    from ...grpc.generated import agent_worker_pb2

logger = logging.getLogger(__name__)


@dataclass
class ResolvedCredentials:
    """Credentials resolved for task execution."""

    api_key: str
    organization_id: int
    source: str  # "user", "agent"

    def __post_init__(self) -> None:
        if not self.api_key:
            logger.warning("ResolvedCredentials created with empty api_key")


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
    agent_id: Optional[int] = None
    skill_id: Optional[int] = None

    # Execution details
    instructions: Dict[str, Any] = None
    skill_inputs: Dict[str, Any] = None

    # Metadata
    created_by: Optional[str] = None
    trigger_type: str = "manual"

    # Model selection
    agent_model: Optional[str] = None
    org_model: Optional[str] = None

    # Workspace
    workspace_path: Optional[Path] = None

    def __post_init__(self) -> None:
        if self.instructions is None:
            self.instructions = {}
        if self.skill_inputs is None:
            self.skill_inputs = {}


class TaskExecutor:
    """
    Unified task executor for all execution paths.

    Handles:
    - Credential resolution (org-level vs agent-level)
    - Execution context building
    - Streaming progress with task_id

    Usage:
        executor = TaskExecutor(agent_executor, api_service)

        async for progress in executor.execute(task_id, task_data):
            yield progress  # Forward to gRPC response
    """

    def __init__(
        self,
        agent_executor: "AgentExecutor",
        api_service: Optional[AgentAPIService] = None,
    ):
        """
        Initialize task executor.

        Args:
            agent_executor: AgentExecutor for actual task execution
            api_service: API service for credential/agent lookups
        """
        self.agent_executor = agent_executor
        self.api_service = api_service

    async def execute(
        self,
        task_data: TaskData,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute a task and stream progress.

        Args:
            task_data: Task configuration and metadata

        Yields:
            Progress events with task_id included
        """
        start_time = time.time()
        task_id = task_data.task_id

        logger.info(
            f"[TASK-{task_id[:8]}] Starting execution - "
            f"agent_id={task_data.agent_id}, skill_id={task_data.skill_id}, "
            f"trigger={task_data.trigger_type}"
        )

        try:
            # 1. Resolve credentials based on task assignment
            credentials = await self._resolve_credentials(task_data)
            logger.info(
                f"[TASK-{task_id[:8]}] Credentials resolved from: {credentials.source}"
            )

            # 2. Build execution context
            context = self._build_execution_context(task_data, credentials)

            # 3. Execute via AgentExecutor (reuse existing logic)
            async for progress in self.agent_executor.execute_task(context):
                # Add task_id to all progress events
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
        if task_data.agent_id is None:
            # Org-level task - use user credentials
            logger.debug(f"[TASK-{task_data.task_id[:8]}] Org-level task, using user credentials")
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
        user_id: Optional[str],
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
        import os
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
            import os
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
            api_key = self._extract_api_key_from_agent(agent_data.raw)
            if not api_key:
                logger.warning(
                    f"Agent {agent_id} has no stored api_key, using service credentials"
                )
                api_key = self.api_service.api_key

            return ResolvedCredentials(
                api_key=api_key,
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

    def _extract_api_key_from_agent(self, agent_data: Dict[str, Any]) -> Optional[str]:
        """Extract api_key from agent's tool configurations."""
        tools = agent_data.get("tools", [])
        for tool in tools:
            config = tool.get("config", {})
            if "api_key" in config:
                return config["api_key"]
        return None

    def _build_execution_context(
        self,
        task_data: TaskData,
        credentials: ResolvedCredentials,
    ) -> "ExecutionContext":
        """
        Build ExecutionContext for AgentExecutor.

        This reuses the same context structure that server.py:ExecuteTask uses.
        """
        from ...entities.execution_context import ExecutionContext
        from ...types import ExecutionMode

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
        request: "agent_worker_pb2.TaskRequest",
        proto_mapper: Any,
    ) -> TaskData:
        """
        Build TaskData from TaskRequest proto.

        Used by ExecuteTask gRPC handler.
        """
        task_request = proto_mapper.task_request_from_proto(request)

        return TaskData(
            task_id=task_request.task_id,
            organization_id=task_request.organization_id or 0,
            agent_id=task_request.agent_id,
            skill_id=None,  # Will be resolved from skill_name
            instructions={"task": task_request.instructions},
            skill_inputs=dict(task_request.skill_inputs) if task_request.skill_inputs else {},
            created_by=None,  # Not available in TaskRequest
            trigger_type="automation",
            agent_model=task_request.agent_model,
            org_model=task_request.organization_model,
        )
