"""
Agent Factory Utility

Consolidates ToolCallingAgent creation functionality used across:
- agent_executor.py (_create_direct_execution_agent, _create_skill_agent)
- chat_processing_service.py (_create_agent_with_model_provider)

Provides standardized agent creation with model selection and caching support.

AIDEV-NOTE: Uses Jinja2 templates from prompts/ directory for agent instructions.
Templates are modular and composable via {% include %} directives.

SECURITY: CodeAgent uses ModalExecutor for sandboxed code execution.
This prevents LLM-generated code from accessing local resources.
"""

import logging
import os
from typing import List, Any, Optional, Dict
from dataclasses import dataclass

from smolagents import ToolCallingAgent, CodeAgent
from smolagents.monitoring import LogLevel
from .model_provider import SmolagentsModelProvider
from ..agents.interrupt_aware_agent import InterruptAwareToolCallingAgent
from ..prompts import build_agent_instructions

logger = logging.getLogger(__name__)


def _get_code_executor():
    """Get Modal executor for sandboxed CodeAgent execution.

    SECURITY: Always uses Modal for code execution isolation.
    Requires MODAL_TOKEN_ID and MODAL_TOKEN_SECRET env vars.
    """
    import modal
    from smolagents import ModalExecutor

    image = modal.Image.debian_slim().pip_install([
        "pandas", "numpy", "requests", "beautifulsoup4"
    ])

    logger.info("🔒 Using ModalExecutor for sandboxed CodeAgent execution")
    return ModalExecutor(image=image)


@dataclass
class AgentConfig:
    """Configuration for creating a ToolCallingAgent."""
    tools: List[Any]
    model_id: Optional[str] = None  # Explicit model override
    agent_model: Optional[str] = None  # Agent default model
    org_model: Optional[str] = None  # Organization default model
    skill_model: Optional[str] = None  # Skill model override
    has_images: bool = False  # Whether input contains images (for vision model)
    max_steps: int = 10
    agent_name: str = "tool_calling_agent"
    agent_description: str = "ToolCallingAgent with configured tools"
    enable_caching: bool = False
    managed_agents: Optional[List[Any]] = None  # Sub-agents for multi-agent routing
    instructions: Optional[str] = None  # Additional custom instructions (appended to defaults)
    agent_type: str = "default"  # Agent type for instruction loading
    context_type: str = "interactive"  # Execution context (interactive/autonomous)
    skill_agent_type: Optional[str] = None  # "tool_calling" (default) or "code_agent"


class AgentFactory:
    """
    Factory for creating ToolCallingAgent instances with standardized configuration.

    AIDEV-NOTE: Consolidates agent creation patterns from:
    - agent_executor: Creates agents for task execution with caching
    - chat_processing_service: Creates agents for chat with vision model support
    """

    def __init__(self, model_provider: SmolagentsModelProvider):
        """
        Initialize agent factory.

        Args:
            model_provider: Model provider for getting AI models
        """
        self.model_provider = model_provider
        self.agent_cache: Dict[str, ToolCallingAgent] = {}

    def create_agent(self, config: AgentConfig) -> ToolCallingAgent:
        """
        Create a ToolCallingAgent with standardized configuration.

        Args:
            config: Agent configuration

        Returns:
            Configured ToolCallingAgent instance
        """
        # Check cache if enabled
        if config.enable_caching:
            cache_key = self._get_cache_key(config)
            if cache_key in self.agent_cache:
                logger.info(f"♻️ Returning cached agent: {cache_key}")
                return self.agent_cache[cache_key]

        # Resolve model using hierarchy
        model_id = self._resolve_model(config)
        logger.info(f"🤖 Creating agent with model: {model_id}")

        # Get model instance
        model = self.model_provider.get_model(model_id=model_id)

        # Build instructions using centralized function with agent_type and context_type
        default_instructions = build_agent_instructions(
            tools=config.tools,
            agent_type=config.agent_type,
            context_type=config.context_type
        )
        # Append any additional custom instructions if provided
        if config.instructions:
            instructions = f"{default_instructions}\n\n{config.instructions}"
        else:
            instructions = default_instructions

        # Create agent with optional managed agents for multi-agent routing
        # AIDEV-NOTE: Use InterruptAwareToolCallingAgent to propagate interrupts from managed agents
        # This enables HITL workflows where managed agents can pause for user approval
        if config.skill_agent_type == "code_agent":
            # CodeAgent writes Python code to execute tools
            # Better for complex multi-step reasoning with conditionals and loops
            # SECURITY: Uses ModalExecutor for sandboxed execution when configured
            logger.info("🐍 Creating CodeAgent for skill execution")
            executor = _get_code_executor()
            agent = CodeAgent(
                tools=config.tools,
                model=model,
                max_steps=config.max_steps,
                additional_authorized_imports=["json", "re", "datetime", "math"],
                verbosity_level=LogLevel.OFF,
                executor=executor,  # None = local execution, ModalExecutor = sandboxed
            )
        else:
            # ToolCallingAgent uses structured function calls (default)
            # More reliable and predictable for simple tasks
            agent = InterruptAwareToolCallingAgent(
                tools=config.tools,
                model=model,
                max_steps=config.max_steps,
                managed_agents=config.managed_agents or [],
                instructions=instructions,
                verbosity_level=LogLevel.OFF,
            )

        agent.name = config.agent_name
        agent.description = config.agent_description

        # Cache if enabled
        if config.enable_caching:
            cache_key = self._get_cache_key(config)
            self.agent_cache[cache_key] = agent
            logger.info(f"💾 Cached agent: {cache_key}")

        return agent

    def _resolve_model(self, config: AgentConfig) -> str:
        """
        Resolve which model to use based on configuration.

        Uses model provider's resolve_model_selection with full hierarchy support.

        Args:
            config: Agent configuration

        Returns:
            Model ID to use
        """
        # Use explicit model_id if provided (highest priority)
        if config.model_id:
            logger.info(f"📌 Using explicit model override: {config.model_id}")
            return config.model_id

        # Otherwise use hierarchy: skill > agent > org > vision(if has_images) > default
        return self.model_provider.resolve_model_selection(
            skill_model=config.skill_model,
            agent_model=config.agent_model,
            org_model=config.org_model,
            has_images=config.has_images
        )

    def _get_cache_key(self, config: AgentConfig) -> str:
        """
        Generate cache key for agent configuration.

        Args:
            config: Agent configuration

        Returns:
            Cache key string
        """
        model_id = self._resolve_model(config)
        tool_names = sorted([tool.name for tool in config.tools if hasattr(tool, 'name')])
        return f"{model_id}_{','.join(tool_names)}_{config.max_steps}"

    def clear_cache(self):
        """Clear the agent cache."""
        self.agent_cache.clear()
        logger.info("🧹 Agent cache cleared")
