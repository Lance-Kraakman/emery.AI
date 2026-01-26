"""
Agent Factory - DSPy Module Creation.

Creates DSPy modules for agent execution. Replaces smolagents ToolCallingAgent
with dspy.ReAct via ExecutorModule.

AIDEV-NOTE: DSPy modules use signatures and ChainOfThought/ReAct strategies
instead of Jinja2 templates. Instructions are now part of signature docstrings.
"""

from __future__ import annotations

import logging
from typing import Any, Callable
from dataclasses import dataclass

import dspy

from .model_provider import SmolagentsModelProvider
from ..dspy_modules.modules import ExecutorModule, DelegatingExecutorModule

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Configuration for creating a DSPy execution module."""

    tools: list[Any]
    model_id: str | None = None  # Explicit model override
    agent_model: str | None = None  # Agent default model
    org_model: str | None = None  # Organization default model
    skill_model: str | None = None  # Skill model override
    has_images: bool = False  # Whether input contains images (for vision model)
    max_iters: int = 10  # Max ReAct iterations
    agent_name: str = "executor"
    agent_description: str = "DSPy ReAct executor with tools"
    enable_caching: bool = False
    agent_modules: dict[str, dspy.Module] | None = None  # Specialized agent modules for delegation
    use_code_execution: bool = False  # Use ProgramOfThought instead of ReAct


class AgentFactory:
    """
    Factory for creating DSPy execution modules.

    Creates ExecutorModule (dspy.ReAct) for tool-calling tasks
    and DelegatingExecutorModule for multi-agent routing.
    """

    def __init__(self, model_provider: SmolagentsModelProvider) -> None:
        """
        Initialize agent factory.

        Args:
            model_provider: Model provider for getting DSPy LM
        """
        self.model_provider = model_provider
        self._module_cache: dict[str, dspy.Module] = {}

    def create_agent(self, config: AgentConfig) -> dspy.Module:
        """
        Create a DSPy execution module.

        Args:
            config: Agent configuration

        Returns:
            Configured DSPy module (ExecutorModule or DelegatingExecutorModule)
        """
        # Check cache if enabled
        if config.enable_caching:
            cache_key = self._get_cache_key(config)
            if cache_key in self._module_cache:
                logger.info(f"♻️ Returning cached module: {cache_key}")
                return self._module_cache[cache_key]

        # Resolve and configure model
        model_id = self._resolve_model(config)
        logger.info(f"🤖 Creating DSPy module with model: {model_id}")

        # Configure DSPy with the resolved model
        self.model_provider.configure_dspy(model_id)

        # Create appropriate module type
        if config.agent_modules:
            # Use delegating executor for multi-agent routing
            base_executor = ExecutorModule(
                execution_tools=config.tools,
                max_iters=config.max_iters,
            )
            module = DelegatingExecutorModule(
                agent_modules=config.agent_modules,
                default_executor=base_executor,
            )
            logger.info(f"🔀 Created DelegatingExecutorModule with {len(config.agent_modules)} agents")
        else:
            # Standard executor with ReAct
            module = ExecutorModule(
                execution_tools=config.tools,
                max_iters=config.max_iters,
            )
            logger.info(f"⚡ Created ExecutorModule with {len(config.tools)} tools")

        # Cache if enabled
        if config.enable_caching:
            cache_key = self._get_cache_key(config)
            self._module_cache[cache_key] = module
            logger.info(f"💾 Cached module: {cache_key}")

        return module

    def create_executor(
        self,
        tools: list[Callable[..., Any]],
        max_iters: int = 10,
        model_id: str | None = None,
    ) -> ExecutorModule:
        """
        Create an ExecutorModule directly (convenience method).

        Args:
            tools: List of callable tools
            max_iters: Maximum ReAct iterations
            model_id: Optional model override

        Returns:
            Configured ExecutorModule
        """
        if model_id:
            self.model_provider.configure_dspy(model_id)

        return ExecutorModule(
            execution_tools=tools,
            max_iters=max_iters,
        )

    def _resolve_model(self, config: AgentConfig) -> str:
        """
        Resolve which model to use based on configuration.

        Args:
            config: Agent configuration

        Returns:
            Model ID to use
        """
        if config.model_id:
            logger.info(f"📌 Using explicit model override: {config.model_id}")
            return config.model_id

        return self.model_provider.resolve_model_selection(
            skill_model=config.skill_model,
            agent_model=config.agent_model,
            org_model=config.org_model,
            has_images=config.has_images,
        )

    def _get_cache_key(self, config: AgentConfig) -> str:
        """Generate cache key for module configuration."""
        model_id = self._resolve_model(config)
        tool_names = sorted([
            getattr(tool, "name", getattr(tool, "__name__", str(tool)))
            for tool in config.tools
        ])
        return f"{model_id}_{','.join(tool_names)}_{config.max_iters}"

    def clear_cache(self) -> None:
        """Clear the module cache."""
        self._module_cache.clear()
        logger.info("🧹 Module cache cleared")
