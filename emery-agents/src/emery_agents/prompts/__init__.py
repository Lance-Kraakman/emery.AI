"""
Prompt Template System

Load and compose Jinja2 templates for agent instructions.
Supports template inheritance and composition via {% include %}.

AIDEV-NOTE: Templates are stored in subdirectories:
- base/: Core templates (identity, rules, tool usage)
- agents/: Agent-specific templates (skill_builder, chat_agent, etc.)
- components/: Reusable components (hitl_approval, planning, etc.)

Usage:
    from emery_agents.prompts import render_template, compose_templates

    # Render a single template
    instructions = render_template("agents/skill_builder.j2", tools=tool_list)

    # Compose multiple templates
    instructions = compose_templates([
        "base/identity.j2",
        "base/critical_rules.j2"
    ], knowledge_cutoff="January 2025")
"""

import logging
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
