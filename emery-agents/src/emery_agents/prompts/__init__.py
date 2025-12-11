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
    """Get singleton template loader."""
    global _loader
    if _loader is None:
        _loader = PromptTemplateLoader()
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
