"""
Prompt Template System

Load and compose Jinja2 templates for agent instructions.
Supports template inheritance and composition via {% include %}.

AIDEV-NOTE: Templates are stored in subdirectories:
- base/: Core templates (identity, rules, tool usage)
- agents/: Agent-specific templates (skill_builder, chat_agent, etc.)
- components/: Reusable components (hitl_approval, planning, etc.)

Usage:
    from emery_agents.prompts import render_template, compose_templates, build_agent_instructions

    # Render a single template
    instructions = render_template("agents/skill_builder.j2", tools=tool_list)

    # Compose multiple templates
    instructions = compose_templates([
        "base/identity.j2",
        "base/critical_rules.j2"
    ], knowledge_cutoff="January 2025")

    # Build instructions for an agent type
    instructions = build_agent_instructions(tools=tools, agent_type="skill_builder")
"""

import logging
import os
from pathlib import Path
from typing import Optional, Any, List

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

# Template directory (relative to this file)
TEMPLATE_DIR = Path(__file__).parent


class PromptTemplateLoader:
    """Load and render Jinja2 prompt templates."""

    def __init__(self, template_dir: Optional[Path] = None):
        """
        Initialize template loader.

        Args:
            template_dir: Directory containing templates. Defaults to this package's directory.
        """
        self.template_dir = template_dir or TEMPLATE_DIR
        self.env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=False
        )
        logger.debug(f"📝 PromptTemplateLoader initialized with dir: {self.template_dir}")

    def render(
        self,
        template_name: str,
        **variables: Any
    ) -> str:
        """
        Render a single template with variables.

        Args:
            template_name: Template path relative to template_dir (e.g., "agents/skill_builder.j2")
            **variables: Template variables

        Returns:
            Rendered template string

        Raises:
            jinja2.TemplateNotFound: If template doesn't exist
        """
        template = self.env.get_template(template_name)
        rendered = template.render(**variables)
        logger.debug(f"📝 Rendered template '{template_name}' ({len(rendered)} chars)")
        return rendered

    def compose(
        self,
        templates: List[str],
        separator: str = "\n\n",
        **variables: Any
    ) -> str:
        """
        Compose multiple templates into a single prompt.

        Args:
            templates: List of template paths to combine (rendered in order)
            separator: String to join templates with (default: double newline)
            **variables: Shared template variables (passed to all templates)

        Returns:
            Combined rendered templates
        """
        parts = []
        for template_name in templates:
            rendered = self.render(template_name, **variables)
            if rendered.strip():  # Skip empty templates
                parts.append(rendered)

        combined = separator.join(parts)
        logger.debug(f"📝 Composed {len(templates)} templates ({len(combined)} chars)")
        return combined

    def list_templates(self, pattern: str = "**/*.j2") -> List[str]:
        """
        List all available templates matching pattern.

        Args:
            pattern: Glob pattern for template files

        Returns:
            List of template paths relative to template_dir
        """
        templates = []
        for path in self.template_dir.glob(pattern):
            if path.is_file():
                rel_path = path.relative_to(self.template_dir)
                templates.append(str(rel_path))
        return sorted(templates)


# Singleton instance for easy access
_loader: Optional[PromptTemplateLoader] = None


def get_loader() -> PromptTemplateLoader:
    """Get singleton template loader with registered globals."""
    global _loader
    if _loader is None:
        _loader = PromptTemplateLoader()
        # Register get_tool_instructions as a Jinja2 global
        # This allows templates to call {{ get_tool_instructions(tools) }} directly
        from .tools import get_tool_instructions
        _loader.env.globals['get_tool_instructions'] = get_tool_instructions
        logger.debug("📝 Registered get_tool_instructions as Jinja2 global")
    return _loader


def render_template(template_name: str, **variables: Any) -> str:
    """
    Convenience function to render a template.

    Args:
        template_name: Template path (e.g., "agents/skill_builder.j2")
        **variables: Template variables

    Returns:
        Rendered template string
    """
    return get_loader().render(template_name, **variables)


def compose_templates(templates: List[str], **variables: Any) -> str:
    """
    Convenience function to compose multiple templates.

    Args:
        templates: List of template paths to combine
        **variables: Shared template variables

    Returns:
        Combined rendered templates
    """
    return get_loader().compose(templates, **variables)


def list_templates(pattern: str = "**/*.j2") -> List[str]:
    """
    List all available templates.

    Args:
        pattern: Glob pattern for template files

    Returns:
        List of template paths
    """
    return get_loader().list_templates(pattern)


def get_managed_agent_templates() -> dict:
    """
    Get managed agent task/report templates for smolagents.

    Returns raw Jinja2 template strings that smolagents will render
    with {{name}}, {{task}}, {{final_answer}} variables.

    Returns:
        Dict with 'task' and 'report' keys containing template strings
    """
    return {
        "task": render_template("base/managed_agent_task.j2"),
        "report": render_template("base/managed_agent_report.j2")
    }


def get_planning_templates() -> dict:
    """
    Get planning templates for smolagents.

    smolagents expects these exact keys:
    - "initial_plan": Initial planning prompt
    - "update_plan_pre_messages": System prompt for plan updates
    - "update_plan_post_messages": User prompt after memory context

    Returns raw Jinja2 template strings that smolagents will render
    with {{task}}, {{remaining_steps}} variables.

    Returns:
        Dict with planning template keys
    """
    return {
        "initial_plan": render_template("planning/plan.j2"),
        "update_plan_pre_messages": render_template("planning/update_plan_pre_messages.j2"),
        "update_plan_post_messages": render_template("planning/update_plan_post_messages.j2"),
    }


def get_hitl_templates() -> dict:
    """
    Get Human-in-the-Loop resume templates.

    Used when resuming agent execution after user approval.

    Returns:
        Dict with 'resume_with_plan' and 'resume_fallback' keys
    """
    return {
        "resume_with_plan": render_template("hitl/resume_with_plan.j2"),
        "resume_fallback": render_template("hitl/resume_fallback.j2"),
    }


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


def build_agent_instructions(
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
        agent_type: Type of agent ("default", "document_builder", "skill_builder", "skill_executor")
        context_type: Execution context ("interactive" or "autonomous")
        **kwargs: Template variables (e.g., restricted_tools)

    Returns:
        Rendered instructions string
    """
    from .tools import get_tool_instructions

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

        # Always write to /tmp for debugging
        _write_debug_prompt(f"{agent_type}_instructions", base_instructions)

        return base_instructions
    except Exception as e:
        logger.error(f"❌ Failed to load templates: {e}")
        raise RuntimeError(f"Failed to build agent instructions: {e}") from e
