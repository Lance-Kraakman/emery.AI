"""
Agent Factory Utility

Consolidates ToolCallingAgent creation functionality used across:
- agent_executor.py (_create_direct_execution_agent, _create_skill_agent)
- chat_processing_service.py (_create_agent_with_model_provider)

Provides standardized agent creation with model selection and caching support.

AIDEV-NOTE: Uses Jinja2 templates from prompts/ directory for agent instructions.
Templates are modular and composable via {% include %} directives.
"""

import logging
import os
from typing import List, Any, Optional, Dict
from dataclasses import dataclass

from smolagents import ToolCallingAgent
from .model_provider import SmolagentsModelProvider
from ..agents.interrupt_aware_agent import InterruptAwareToolCallingAgent
from ..prompts import compose_templates, render_template
from ..prompts.tools import get_tool_instructions

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
    instructions: Optional[str] = None  # Additional custom instructions (appended to defaults)
    agent_type: str = "default"  # Agent type for instruction loading
    context_type: str = "interactive"  # Execution context (interactive/autonomous)


def get_default_instructions(
    tools: List[Any] = None,
    agent_type: str = "default",
    context_type: str = "interactive",
    **kwargs
) -> str:
    """
    Build agent instructions from Jinja2 templates.

    Centralized function for building instructions for all agent types.
    Ensures consistent base rules + agent-specific content + tool instructions.

    Args:
        tools: List of tool objects (for dynamic tool instructions)
        agent_type: Type of agent ("default", "document_builder", "skill_builder", "task_executor")
        context_type: Execution context ("interactive" or "autonomous")
        **kwargs: Template variables (e.g., restricted_tools)

    Returns:
        Rendered instructions string
    """
    try:
        # Base templates (always included for all agents)
        base_instructions = compose_templates([
            "base/identity.j2",
            "base/critical_rules.j2",
            "components/goal_persistence.j2",
        ], **kwargs)

        # Agent-specific additions (domain content)
        if agent_type != "default":
            try:
                agent_template = f"agents/{agent_type}.j2"
                agent_content = render_template(agent_template, tools=tools, **kwargs)
                if agent_content.strip():
                    base_instructions = f"{base_instructions}\n\n{agent_content}"
                    logger.debug(f"📝 Added agent template: {agent_template} ({len(agent_content)} chars)")
            except Exception as e:
                logger.warning(f"⚠️ Agent template {agent_type}.j2 not found: {e}")

        # Context mode (interactive vs autonomous)
        try:
            context_content = render_template("base/context.j2", context_type=context_type)
            if context_content.strip():
                base_instructions = f"{base_instructions}\n\n{context_content}"
        except Exception as e:
            logger.debug(f"📝 Context template not rendered: {e}")

        # Tool-specific instructions (dynamic based on available tools)
        if tools:
            tool_instructions = get_tool_instructions(tools)
            if tool_instructions:
                base_instructions = f"{base_instructions}\n\n{tool_instructions}"
                logger.debug(f"📝 Added tool instructions ({len(tool_instructions)} chars)")

        # Log final size
        logger.info(f"📋 Instructions for {agent_type}: {len(base_instructions)} chars")

        # Debug: Write to /tmp if EMERY_DEBUG_PROMPTS is set
        if os.environ.get("EMERY_DEBUG_PROMPTS"):
            _write_debug_prompt(f"{agent_type}_instructions", base_instructions)

        return base_instructions
    except Exception as e:
        # Fallback to hardcoded instructions if templates fail to load
        logger.warning(f"⚠️ Failed to load templates, using fallback: {e}")
        return _FALLBACK_INSTRUCTIONS


def _write_debug_prompt(name: str, content: str) -> None:
    """Write prompt content to /tmp for debugging."""
    try:
        os.makedirs('/tmp/emery_prompts', exist_ok=True)
        filepath = f'/tmp/emery_prompts/{name}.txt'
        with open(filepath, 'w') as f:
            f.write(content)
        logger.info(f"📋 Wrote debug prompt to {filepath}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to write debug prompt: {e}")


# Fallback instructions in case templates fail to load
# AIDEV-NOTE: Keep in sync with templates - this is a safety net only
_FALLBACK_INSTRUCTIONS = """## Critical Rules

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

        # Build instructions using centralized function with agent_type and context_type
        default_instructions = get_default_instructions(
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
