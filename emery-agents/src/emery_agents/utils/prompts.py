"""
Jinja2-based prompt utility system for agent prompts.

Provides clean, maintainable prompt templates with proper variable substitution
and consistent formatting across all agent types.
"""

import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging
try:
    from jinja2 import Environment, FileSystemLoader, Template
    JINJA2_AVAILABLE = True
except ImportError:
    # Gracefully handle missing jinja2
    Environment = None
    FileSystemLoader = None
    Template = None
    JINJA2_AVAILABLE = False

logger = logging.getLogger(__name__)


class PromptManager:
    """
    Central manager for Jinja2-based prompt templates.
    
    Handles template loading, rendering, and caching for all agent prompt types.
    """
    
    def __init__(self):
        if not JINJA2_AVAILABLE:
            raise RuntimeError("Jinja2 is required for PromptManager. Use FallbackPromptManager instead.")
        self.templates_dir = Path(__file__).parent / "templates"
        self._env = None
        self._templates_cache = {}
        self._setup_jinja_environment()
        logger.info("PromptManager initialized")
    
    def _setup_jinja_environment(self):
        """Set up Jinja2 environment with custom filters and settings."""
        # Create templates directory if it doesn't exist
        self.templates_dir.mkdir(exist_ok=True)
        
        # Set up Jinja2 environment
        self._env = Environment(
            loader=FileSystemLoader(str(self.templates_dir)),
            trim_blocks=True,
            lstrip_blocks=True,
            autoescape=False,  # We're generating text prompts, not HTML
        )
        
        # Add custom filters
        self._env.filters['truncate_smart'] = self._truncate_smart
        self._env.filters['format_list'] = self._format_list
        self._env.filters['indent'] = self._indent_text
        
        logger.debug("Jinja2 environment configured")
    
    def _truncate_smart(self, text: str, max_length: int = 100) -> str:
        """Smart truncation that preserves word boundaries."""
        if len(text) <= max_length:
            return text
        return text[:max_length - 3].rsplit(' ', 1)[0] + "..."
    
    def _format_list(self, items: List[str], bullet: str = "-") -> str:
        """Format a list of items with bullets."""
        return "\n".join(f"{bullet} {item}" for item in items)
    
    def _indent_text(self, text: str, spaces: int = 4) -> str:
        """Indent text by specified number of spaces."""
        indent = " " * spaces
        return "\n".join(f"{indent}{line}" if line.strip() else line for line in text.split("\n"))
    
    def get_template(self, template_name: str) -> Template:
        """
        Get a template by name, with caching.
        
        Args:
            template_name: Name of the template file (e.g., "task_executor.j2")
            
        Returns:
            Jinja2 Template instance
        """
        if template_name not in self._templates_cache:
            try:
                self._templates_cache[template_name] = self._env.get_template(template_name)
                logger.debug(f"Loaded template: {template_name}")
            except Exception as e:
                logger.error(f"Failed to load template {template_name}: {e}")
                raise
        
        return self._templates_cache[template_name]
    
    def render_template(self, template_name: str, **kwargs) -> str:
        """
        Render a template with the provided variables.
        
        Args:
            template_name: Name of the template file
            **kwargs: Template variables
            
        Returns:
            Rendered prompt string
        """
        try:
            template = self.get_template(template_name)
            rendered = template.render(**kwargs)
            logger.debug(f"Rendered template: {template_name}")
            return rendered.strip()
        except Exception as e:
            logger.error(f"Failed to render template {template_name}: {e}")
            raise
    
    def render_task_executor_selection(
        self,
        instructions: str,
        capabilities: List[Dict[str, str]],
        **kwargs
    ) -> str:
        """
        Render prompt for TaskExecutorAgent capability selection.
        
        Args:
            instructions: User task instructions
            capabilities: List of {name, description} dicts
            **kwargs: Additional template variables
            
        Returns:
            Rendered selection prompt
        """
        return self.render_template(
            "task_executor_selection.j2",
            instructions=instructions,
            capabilities=capabilities,
            **kwargs
        )
    
    def render_capability_execution(
        self,
        capability_name: str,
        capability_description: str,
        instructions: str,
        context: Dict[str, Any],
        **kwargs
    ) -> str:
        """
        Render prompt for CapabilityAgent execution.
        
        Args:
            capability_name: Name of the capability
            capability_description: Description of the capability
            instructions: Task instructions
            context: Execution context
            **kwargs: Additional template variables
            
        Returns:
            Rendered execution prompt
        """
        return self.render_template(
            "capability_execution.j2",
            capability_name=capability_name,
            capability_description=capability_description,
            instructions=instructions,
            context=context,
            **kwargs
        )
    
    def render_default_execution(
        self,
        instructions: str,
        context: Dict[str, Any],
        available_tools: Optional[List[str]] = None,
        **kwargs
    ) -> str:
        """
        Render prompt for DefaultTaskExecutorAgent execution.
        
        Args:
            instructions: Task instructions
            context: Execution context
            available_tools: List of available tools (optional)
            **kwargs: Additional template variables
            
        Returns:
            Rendered execution prompt
        """
        return self.render_template(
            "default_execution.j2",
            instructions=instructions,
            context=context,
            available_tools=available_tools or [],
            **kwargs
        )


# Global prompt manager instance
_prompt_manager = None


def get_prompt_manager() -> PromptManager:
    """Get the global PromptManager instance."""
    global _prompt_manager
    if _prompt_manager is None:
        if JINJA2_AVAILABLE:
            _prompt_manager = PromptManager()
        else:
            _prompt_manager = FallbackPromptManager()
    return _prompt_manager


class FallbackPromptManager:
    """Fallback prompt manager when Jinja2 is not available."""
    
    def render_task_executor_selection(self, instructions: str, capabilities: List[Dict[str, str]], **kwargs) -> str:
        """Simple fallback for task executor selection."""
        caps_text = "\n".join([f"- {cap['name']}: {cap['description']}" for cap in capabilities])
        return f"""Task: {instructions}

Available capabilities:
{caps_text}

Select the best capability for this task or 'DEFAULT' for general execution."""
    
    def render_capability_execution(self, capability_name: str, capability_description: str, 
                                   instructions: str, context: Dict[str, Any], **kwargs) -> str:
        """Simple fallback for capability execution."""
        return f"""Capability: {capability_name}
Description: {capability_description}

Task: {instructions}

Context: {context}

Execute this task using the specified capability."""
    
    def render_default_execution(self, instructions: str, context: Dict[str, Any], 
                                available_tools: Optional[List[str]] = None, **kwargs) -> str:
        """Simple fallback for default execution."""
        tools_text = f"\nAvailable tools: {', '.join(available_tools)}" if available_tools else ""
        return f"""Task: {instructions}

Context: {context}{tools_text}

Execute this task directly."""


# Convenience functions for common prompt types
def render_task_executor_selection(
    instructions: str,
    capabilities: List[Dict[str, str]],
    **kwargs
) -> str:
    """Convenience function for TaskExecutorAgent selection prompt."""
    return get_prompt_manager().render_task_executor_selection(
        instructions, capabilities, **kwargs
    )


def render_capability_execution(
    capability_name: str,
    capability_description: str,
    instructions: str,
    context: Dict[str, Any],
    **kwargs
) -> str:
    """Convenience function for CapabilityAgent execution prompt."""
    return get_prompt_manager().render_capability_execution(
        capability_name, capability_description, instructions, context, **kwargs
    )


def render_default_execution(
    instructions: str,
    context: Dict[str, Any],
    available_tools: Optional[List[str]] = None,
    **kwargs
) -> str:
    """Convenience function for DefaultTaskExecutorAgent execution prompt."""
    return get_prompt_manager().render_default_execution(
        instructions, context, available_tools, **kwargs
    )


# AIDEV-NOTE: Jinja2-based prompt system for clean, maintainable agent prompts
# AIDEV-TODO: Add prompt validation to ensure required variables are provided
# AIDEV-TODO: Add prompt metrics and logging for optimization