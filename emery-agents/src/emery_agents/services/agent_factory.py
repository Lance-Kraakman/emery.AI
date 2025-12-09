"""
Agent Factory Utility

Consolidates ToolCallingAgent creation functionality used across:
- agent_executor.py (_create_direct_execution_agent, _create_skill_agent)
- chat_processing_service.py (_create_agent_with_model_provider)

Provides standardized agent creation with model selection and caching support.
"""

import logging
from typing import List, Any, Optional, Dict
from dataclasses import dataclass

from smolagents import ToolCallingAgent
from .model_provider import SmolagentsModelProvider
from ..agents.interrupt_aware_agent import InterruptAwareToolCallingAgent

logger = logging.getLogger(__name__)


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
    instructions: Optional[str] = None  # Custom instructions inserted into system prompt


# Default instructions for all agents
# AIDEV-NOTE: These instructions are critical for reliable agent behavior
DEFAULT_AGENT_INSTRUCTIONS = """## Critical Rules

1. **NEVER use arbitrary or placeholder values** - If you don't know a value (like an ID), you MUST either:
   - Ask the user to provide it
   - Use a tool to look it up first
   - Report that you cannot proceed without the information

2. **Report failures clearly** - If a tool fails or returns an error, inform the user immediately with:
   - What you were trying to do
   - What went wrong
   - Suggested next steps (if any)

3. **List before reading** - When working with resources (skills, agents, tables, etc.), always list available items first to find the correct ID before attempting to read or modify.
"""


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

        # Build instructions: default rules + any custom instructions
        instructions = DEFAULT_AGENT_INSTRUCTIONS
        if config.instructions:
            instructions = f"{DEFAULT_AGENT_INSTRUCTIONS}\n\n{config.instructions}"

        # Create agent with optional managed agents for multi-agent routing
        # AIDEV-NOTE: Use InterruptAwareToolCallingAgent to propagate interrupts from managed agents
        # This enables HITL workflows where managed agents can pause for user approval
        agent = InterruptAwareToolCallingAgent(
            tools=config.tools,
            model=model,
            max_steps=config.max_steps,
            managed_agents=config.managed_agents or [],
            instructions=instructions
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

    def get_cache_size(self) -> int:
        """Get current cache size."""
        return len(self.agent_cache)
