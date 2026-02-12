"""
Interactive Executor for direct chat commands.

Handles single-turn instruction execution with tools, without skill context.
Extracted from AgentExecutor as part of Phase 2.1 refactoring.

AIDEV-NOTE: Part of Phase 2.1 refactoring (Feb 2026).
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

import dspy
from PIL import Image

from emery_agents.tools.loader import UnifiedToolLoader

from ..agents.factory import AgentConfig, AgentFactory
from ..data import ImageProcessor
from ..models import ModelProvider

if TYPE_CHECKING:
    from emery_agents.entities.configs import InteractiveRequest
    from emery_agents.entities.message import ImageAttachment

logger = logging.getLogger(__name__)


class InteractiveExecutor:
    """Executes direct chat commands with tools.

    Handles single-turn instruction execution:
    1. Load tools from request
    2. Create DSPy executor module
    3. Execute task and stream progress
    4. Return result

    Replaces AgentExecutor's interactive execution path.
    """

    def __init__(
        self,
        tool_loader: UnifiedToolLoader | None = None,
        agent_factory: AgentFactory | None = None,
    ):
        """Initialize with optional dependencies.

        Args:
            tool_loader: UnifiedToolLoader for loading tools. Creates default if not provided.
            agent_factory: AgentFactory for creating DSPy modules. Lazy-created if not provided.
        """
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self._agent_factory = agent_factory

    @property
    def agent_factory(self) -> AgentFactory:
        """Lazy-initialize AgentFactory with ModelProvider."""
        if self._agent_factory is None:
            self._agent_factory = AgentFactory(ModelProvider())
        return self._agent_factory

    async def execute(
        self,
        request: InteractiveRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        """Execute an interactive request.

        Args:
            request: InteractiveRequest with task, tools, auth, etc.

        Yields:
            Progress dicts with status, output, timestamp_ms, progress_percent
        """
        start_time = time.time()

        logger.info(f"🎯 Interactive execution: {request.task[:100]}...")

        yield {
            "status": "in_progress",
            "output": json.dumps({"message": "Starting execution"}),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 10.0,
        }

        try:
            # 1. Create executor agent with tools
            agent = await self._create_agent(request)

            # 2. Download images if any
            pil_images = await self._download_images(request.images)

            yield {
                "status": "in_progress",
                "output": json.dumps(
                    {"message": "Executing task", "images_loaded": len(pil_images)}
                ),
                "error_message": "",
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 50.0,
            }

            # 3. Execute task using DSPy module
            context_str = json.dumps({
                "task": request.task,
                "has_images": len(pil_images) > 0,
                "image_count": len(pil_images),
            })

            with dspy.context(lm=agent._lm):
                result = agent.forward(
                    step_description=request.task,
                    context=context_str,
                )

            elapsed = time.time() - start_time
            logger.info(f"✅ Interactive execution completed in {elapsed:.2f}s")

            yield {
                "status": "completed",
                "output": json.dumps({"result": str(result)}),
                "error_message": "",
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 100.0,
            }

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"❌ Interactive execution failed after {elapsed:.2f}s: {e}")

            yield {
                "status": "failed",
                "output": "",
                "error_message": str(e),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 100.0,
            }

    async def _create_agent(
        self,
        request: InteractiveRequest,
    ) -> dspy.Module:
        """Create DSPy executor module for the request.

        Args:
            request: InteractiveRequest with tools and auth

        Returns:
            DSPy module ready for execution
        """
        tools = []

        # Load tools from request configs
        if request.tools:
            tools = self.tool_loader.load_tools_from_configs(
                tool_configs=request.tools,
                api_key=request.auth.api_key,
                api_key_mode="user",
                organization_id=request.auth.org_id,
            )
            logger.info(f"🔧 Loaded {len(tools)} tools for interactive execution")

        # Create DSPy executor module
        agent_config = AgentConfig(
            tools=tools,
            agent_model=request.agent_model,
            org_model=request.auth.org_model,
            max_iters=request.max_steps,
            agent_name="interactive_executor",
            agent_description="Interactive tool execution agent",
            enable_caching=False,
        )

        return self.agent_factory.create_agent(agent_config)

    async def _download_images(
        self,
        images: list[ImageAttachment],
    ) -> list[Image.Image]:
        """Download images for multimodal execution.

        Args:
            images: List of ImageAttachment with URLs

        Returns:
            List of PIL.Image objects
        """
        if not images:
            return []
        return await ImageProcessor.download_images_from_attachments(images)


# Singleton instance for convenience
_default_executor: InteractiveExecutor | None = None


def get_interactive_executor() -> InteractiveExecutor:
    """Get shared InteractiveExecutor instance."""
    global _default_executor
    if _default_executor is None:
        _default_executor = InteractiveExecutor()
    return _default_executor
