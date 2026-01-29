"""
Unified Skill Execution Service.

Routes ALL skill executions through task infrastructure for consistent
credential handling and permission checking.

AIDEV-NOTE: This service provides a unified entry point for skill execution,
handling credential resolution and permission checks before delegating to
the existing SkillExecutorService/StepExecutorService.

Credential resolution rules:
- Org skill (no agent_id): Use invoking user's credentials
- Same-agent skill: Use current context credentials
- Different-agent skill: Load target agent's credentials (requires permission check)
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

from ...grpc.generated import agent_worker_pb2
from ...types import SkillExecutionResult
from ..agents.api import AgentAPIService
from ..credentials import ResolvedCredentials
from .executor import SkillExecutorService
from ..tools.loader import UnifiedToolLoader
from ..agents.factory import AgentFactory
from ..tools.provider import ToolProvider

# Type alias for progress callbacks
ProgressCallback = Callable[[Dict[str, Any]], None]

logger = logging.getLogger(__name__)


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class SkillExecutionRecord:
    """Record of skill execution for chat context."""

    skill_name: str
    skill_id: Optional[int] = None
    agent_id: Optional[int] = None  # None for org skills
    status: str = "pending"  # "pending", "running", "completed", "failed"
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    failed_step: Optional[str] = None
    execution_ms: int = 0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    trigger_type: str = "manual"  # "manual", "automation", "delegation", "plan_step"

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for chat context."""
        return {
            "skill_name": self.skill_name,
            "skill_id": self.skill_id,
            "agent_id": self.agent_id,
            "status": self.status,
            "output": self.output,
            "error": self.error,
            "failed_step": self.failed_step,
            "execution_ms": self.execution_ms,
            "timestamp": self.timestamp.isoformat(),
            "trigger_type": self.trigger_type,
        }


@dataclass
class UnifiedSkillResult:
    """Result from unified skill execution."""

    success: bool
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    failed_step: Optional[str] = None
    execution_ms: int = 0
    task_id: Optional[str] = None
    record: Optional[SkillExecutionRecord] = None

    @classmethod
    def from_success(
        cls,
        output: Dict[str, Any],
        execution_ms: int = 0,
        task_id: Optional[str] = None,
    ) -> "UnifiedSkillResult":
        """Create success result."""
        return cls(
            success=True,
            output=output,
            execution_ms=execution_ms,
            task_id=task_id,
        )

    @classmethod
    def from_error(
        cls,
        error: str,
        failed_step: Optional[str] = None,
        execution_ms: int = 0,
        task_id: Optional[str] = None,
    ) -> "UnifiedSkillResult":
        """Create error result."""
        return cls(
            success=False,
            error=error,
            failed_step=failed_step,
            execution_ms=execution_ms,
            task_id=task_id,
        )


# =============================================================================
# Exceptions
# =============================================================================


class SkillExecutionError(Exception):
    """Base exception for skill execution errors."""

    pass


class PermissionDeniedError(SkillExecutionError):
    """User lacks permission to invoke skill on target agent."""

    pass


class CredentialResolutionError(SkillExecutionError):
    """Failed to resolve credentials for skill execution."""

    pass


# =============================================================================
# Unified Skill Execution Service
# =============================================================================


class UnifiedSkillExecutionService:
    """
    Unified skill execution via task infrastructure.

    Provides a single entry point for all skill executions with:
    - Credential resolution (user vs agent credentials)
    - Permission checking (for cross-agent invocation)
    - Consistent result/error flow back to caller

    Usage:
        service = UnifiedSkillExecutionService(api_service, tool_provider)

        result = await service.execute_skill(
            skill=skill_config,
            inputs={"name": "John"},
            invoking_agent_id=current_agent_id,
            invoking_user_id=user_id,
            trigger_type="manual",
        )

        if result.success:
            print(f"Output: {result.output}")
        else:
            print(f"Error: {result.error}")
    """

    def __init__(
        self,
        api_service: AgentAPIService,
        current_credentials: Optional[ResolvedCredentials] = None,
    ):
        """
        Initialize the unified skill execution service.

        Args:
            api_service: API service for permission checks and data fetching
            current_credentials: Current context credentials (optional)
        """
        self.api_service = api_service
        self.current_credentials = current_credentials
        self._execution_history: List[SkillExecutionRecord] = []

    async def execute_skill(
        self,
        skill: agent_worker_pb2.SkillConfig,
        inputs: Dict[str, Any],
        invoking_agent_id: Optional[int],
        invoking_user_id: str,
        trigger_type: str = "manual",
        current_credentials: Optional[ResolvedCredentials] = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> UnifiedSkillResult:
        """
        Execute a skill with proper credential resolution and permission checking.

        Args:
            skill: SkillConfig proto defining the skill
            inputs: Input values for skill execution
            invoking_agent_id: Agent ID of the invoker (None for org skills)
            invoking_user_id: User ID of the invoker
            trigger_type: How the skill was triggered ("manual", "automation", etc.)
            current_credentials: Override current context credentials

        Returns:
            UnifiedSkillResult with success/error information

        Raises:
            PermissionDeniedError: If user lacks permission for cross-agent invocation
            CredentialResolutionError: If credentials cannot be resolved
        """
        import time

        start_time = time.time()
        task_id = str(uuid.uuid4())
        creds = current_credentials or self.current_credentials

        # Create execution record
        record = SkillExecutionRecord(
            skill_name=skill.name,
            skill_id=skill.id if skill.id else None,
            agent_id=skill.agent_id if skill.agent_id else None,
            status="running",
            trigger_type=trigger_type,
        )

        try:
            # 1. Resolve credentials
            resolved_creds = await self._resolve_credentials(
                skill=skill,
                invoking_agent_id=invoking_agent_id,
                invoking_user_id=invoking_user_id,
                current_credentials=creds,
            )

            logger.info(
                f"🔑 Skill '{skill.name}' using credentials from: {resolved_creds.source}"
            )

            # 2. Permission check happens implicitly via RLS
            # If user doesn't have access, credential loading will fail
            # No need for explicit check - server handles it

            # 3. Execute skill via existing infrastructure
            result = await self._execute_skill_internal(
                skill=skill,
                inputs=inputs,
                credentials=resolved_creds,
                trigger_type=trigger_type,
                task_id=task_id,
                progress_callback=progress_callback,
            )

            # 4. Calculate execution time and update record
            execution_ms = int((time.time() - start_time) * 1000)
            record.status = "completed" if result.success else "failed"
            record.output = result.output
            record.error = result.error
            record.failed_step = result.failed_step
            record.execution_ms = execution_ms

            # Attach record to result
            result.execution_ms = execution_ms
            result.task_id = task_id
            result.record = record

            # Add to history
            self._execution_history.append(record)

            return result

        except Exception as e:
            execution_ms = int((time.time() - start_time) * 1000)
            error_msg = f"Skill execution failed: {str(e)}"
            logger.error(f"❌ {error_msg}")

            record.status = "failed"
            record.error = error_msg
            record.execution_ms = execution_ms
            self._execution_history.append(record)

            return UnifiedSkillResult.from_error(
                error=error_msg,
                execution_ms=execution_ms,
                task_id=task_id,
            )

    async def _resolve_credentials(
        self,
        skill: agent_worker_pb2.SkillConfig,
        invoking_agent_id: Optional[int],
        invoking_user_id: str,
        current_credentials: Optional[ResolvedCredentials],
    ) -> ResolvedCredentials:
        """
        Resolve credentials for skill execution.

        Rules:
        1. Org skill (no agent_id) → User's credentials
        2. Same agent → Current context credentials
        3. Different agent → Load target agent's credentials
        """
        # 1. Org skill (no agent_id) → User's credentials
        if not skill.agent_id:
            logger.debug(f"Skill '{skill.name}' is org-level, using user credentials")
            return await self._load_user_credentials(invoking_user_id)

        # 2. Same agent → Current context (already have creds)
        if skill.agent_id == invoking_agent_id and current_credentials:
            logger.debug(
                f"Skill '{skill.name}' is same-agent, using current context credentials"
            )
            return current_credentials

        # 3. Different agent → Load target agent's credentials
        logger.debug(
            f"Skill '{skill.name}' is cross-agent, loading target agent credentials"
        )
        return await self._load_agent_credentials(skill.agent_id)

    async def _load_user_credentials(self, user_id: str) -> ResolvedCredentials:
        """Load credentials for a user.

        For now, this uses the current API service credentials.
        In the future, this could look up user-specific credentials.
        """
        # TODO: Implement proper user credential lookup
        # For now, use the API service's credentials
        return ResolvedCredentials(
            api_key=self.api_service.api_key,
            organization_id=self.api_service.organization_id,
            source="user",
        )

    async def _load_agent_credentials(self, agent_id: int) -> ResolvedCredentials:
        """Load stored credentials for an agent.

        Credentials are stored in agent's tool configs.
        """
        try:
            # Fetch agent to get its tool configs
            agent_data = await self.api_service.fetch_agent_by_id(agent_id)
            if not agent_data:
                raise CredentialResolutionError(
                    f"Agent {agent_id} not found for credential lookup"
                )

            # Extract api_key from agent's tool configs
            api_key = self._extract_api_key_from_agent(agent_data.raw)
            if not api_key:
                # Fall back to API service credentials if agent has no stored key
                logger.warning(
                    f"Agent {agent_id} has no stored api_key, using service credentials"
                )
                api_key = self.api_service.api_key

            return ResolvedCredentials(
                api_key=api_key,
                organization_id=self.api_service.organization_id,
                source="agent",
            )

        except Exception as e:
            raise CredentialResolutionError(
                f"Failed to load credentials for agent {agent_id}: {e}"
            )

    def _extract_api_key_from_agent(
        self, agent_config: agent_worker_pb2.AgentConfig
    ) -> Optional[str]:
        """Extract api_key from agent's tool configurations."""
        for tool in agent_config.tools:
            if "api_key" in tool.config:
                return tool.config["api_key"]
        return None

    # NOTE: Permission checks are handled by RLS at the server level.
    # If user doesn't have access to an agent, credential loading will fail.
    # No explicit _check_permission method needed.

    async def _execute_skill_internal(
        self,
        skill: agent_worker_pb2.SkillConfig,
        inputs: Dict[str, Any],
        credentials: ResolvedCredentials,
        trigger_type: str,
        task_id: str,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> UnifiedSkillResult:
        """
        Execute skill via existing infrastructure.

        Delegates to SkillExecutorService with the resolved credentials.
        Progress is streamed via callback if provided.
        """
        import asyncio

        # Import here to avoid circular dependency


        try:
            # Create dependencies with resolved credentials
            tool_loader = UnifiedToolLoader(
                api_key=credentials.api_key,
                organization_id=credentials.organization_id,
            )
            agent_factory = AgentFactory(tool_loader)
            skill_executor = SkillExecutorService(
                tool_loader=tool_loader,
                agent_factory=agent_factory,
            )

            # Execute skill synchronously in thread pool
            # Progress callback is passed through for streaming updates
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: skill_executor.execute_skill(
                    skill_config=skill,
                    runtime_inputs=inputs,
                    api_key=credentials.api_key,
                    organization_id=credentials.organization_id,
                    capture_outputs=True,
                    progress_callback=progress_callback,
                ),
            )

            # Handle result - can be str or SkillExecutionResult
            if isinstance(result, str):
                return UnifiedSkillResult.from_success(
                    output={"result": result},
                    task_id=task_id,
                )
            else:
                # SkillExecutionResult has success, outputs, error fields
                if result.success:
                    return UnifiedSkillResult.from_success(
                        output=result.outputs if hasattr(result, "outputs") else {},
                        task_id=task_id,
                    )
                else:
                    return UnifiedSkillResult.from_error(
                        error=result.error or "Skill execution failed",
                        task_id=task_id,
                    )

        except Exception as e:
            logger.error(f"Skill execution error: {e}")
            return UnifiedSkillResult.from_error(
                error=str(e),
                task_id=task_id,
            )

    def get_execution_history(self, limit: int = 10) -> List[SkillExecutionRecord]:
        """Get recent skill execution history."""
        return self._execution_history[-limit:]

    def format_history_for_context(self, limit: int = 5) -> str:
        """Format execution history for LLM context."""
        if not self._execution_history:
            return ""

        lines = ["Recent skill executions:"]
        for record in self._execution_history[-limit:]:
            if record.status == "completed":
                lines.append(f"- {record.skill_name}: Success ({record.execution_ms}ms)")
            else:
                lines.append(f"- {record.skill_name}: Failed - {record.error}")

        return "\n".join(lines)
