"""
Prompt Template System

Load and compose Jinja2 templates for agent instructions.
Supports template inheritance and composition via {% include %}.

AIDEV-NOTE: Templates are stored in subdirectories:
- shared/: Core templates (identity, rules, tool usage)
- agents/: Agent-specific templates (skill_builder, chat_agent, etc.)
- components/: Reusable components (hitl_approval, planning, etc.)
- planning/: Plan generation templates
- execution/: Plan execution templates

Usage:
    from emery_agents.prompts import render_template, compose_templates, build_agent_instructions

    # Render a single template
    instructions = render_template("agents/skill_builder.j2", tools=tool_list)

    # Compose multiple templates
    instructions = compose_templates([
        "shared/identity.j2",
        "shared/critical_rules.j2"
    ], knowledge_cutoff="January 2025")

    # Build instructions for an agent type
    instructions = build_agent_instructions(tools=tools, agent_type="skill_builder")
"""

import logging
import os
from pathlib import Path
from typing import Optional, Any, List, Dict

from jinja2 import Environment, FileSystemLoader

from ..utils.session_logger import get_session_logger

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

# Cached base instructions (identity + rules + goals) - saves ~2KB per agent
_cached_base_instructions: Optional[str] = None


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


def compose_layers(
    layers: List[str],
    separator: str = "\n\n",
    **variables: Any
) -> str:
    """
    Compose prompt layers by category for focused, modular prompts.

    Layers are specified as category/name (without .j2 extension):
    - "shared/identity" -> shared/identity.j2
    - "behaviors/planner" -> behaviors/planner.j2
    - "modes/interactive" -> modes/interactive.j2

    Args:
        layers: List of layer paths (category/name format)
        separator: String between layers (default: double newline)
        **variables: Template variables passed to all layers

    Returns:
        Combined prompt string

    Example:
        # Build a focused planning prompt (~65 lines vs 451)
        instructions = compose_layers([
            "shared/identity",
            "shared/critical_rules",
            "behaviors/planner",
            "modes/interactive",
        ], research_questions=["What tables exist?"])
    """
    # Convert layer names to full template paths
    template_paths = [f"{layer}.j2" for layer in layers]
    return get_loader().compose(template_paths, separator=separator, **variables)


def get_cached_base_instructions(**kwargs: Any) -> str:
    """
    Get cached base instructions (identity + rules + goal persistence).

    Base templates are static and don't need to be re-rendered for each agent.
    This cache saves ~2KB of template rendering per agent instantiation.

    Args:
        **kwargs: Template variables (passed on first render only)

    Returns:
        Cached base instructions string
    """
    global _cached_base_instructions

    if _cached_base_instructions is None:
        _cached_base_instructions = compose_templates([
            "shared/identity.j2",
            "shared/critical_rules.j2",
            "components/goal_persistence.j2",
        ], **kwargs)
        logger.debug(f"📝 Cached base instructions ({len(_cached_base_instructions)} chars)")

    return _cached_base_instructions


def list_templates(pattern: str = "**/*.j2") -> List[str]:
    """
    List all available templates.

    Args:
        pattern: Glob pattern for template files

    Returns:
        List of template paths
    """
    return get_loader().list_templates(pattern)


def render_capabilities(agent_type: str) -> str:
    """
    Render just the capabilities block from an agent template.

    Agent templates can define a {% block capabilities %}...{% endblock %}
    section that summarizes the agent's key abilities for planner context.

    Args:
        agent_type: Agent type (e.g., "schema_builder", "skill_builder")

    Returns:
        Rendered capabilities string, or empty string if not found
    """
    template_name = f"agents/{agent_type}.j2"
    try:
        loader = get_loader()
        template = loader.env.get_template(template_name)

        # Access the capabilities block if it exists
        if "capabilities" in template.blocks:
            # Render the block with an empty context
            ctx = template.new_context()
            content = "".join(template.blocks["capabilities"](ctx))
            return content.strip()

        logger.debug(f"📝 No capabilities block in {template_name}")
        return ""
    except Exception as e:
        logger.warning(f"⚠️ Could not load capabilities for {agent_type}: {e}")
        return ""


def get_managed_agent_templates() -> Dict[str, str]:
    """
    Get managed agent task/report templates for smolagents.

    Returns raw Jinja2 template strings that smolagents will render
    with {{name}}, {{task}}, {{final_answer}} variables.

    Returns:
        Dict with 'task' and 'report' keys containing template strings
    """
    return {
        "task": render_template("shared/managed_agent_task.j2"),
        "report": render_template("shared/managed_agent_report.j2")
    }


def get_planning_templates() -> Dict[str, str]:
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


def get_hitl_templates() -> Dict[str, str]:
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
    """Write prompt content to /tmp for debugging.

    Also logs to the current session logger if available (set EMERY_DEBUG_PROMPTS=1).
    """
    try:
        os.makedirs('/tmp/emery_prompts', exist_ok=True)
        filepath = f'/tmp/emery_prompts/{name}.txt'
        with open(filepath, 'w') as f:
            f.write(content)
        logger.info(f"📋 Wrote debug prompt to {filepath}")

        # Also log to session logger if available
        session_logger = get_session_logger()
        if session_logger:
            session_logger.log_prompt_full(
                agent_name=name,
                prompt=content,
                phase="prompt_rendered"
            )
    except Exception as e:
        logger.warning(f"⚠️ Failed to write debug prompt: {e}")


def render_available_files(attachments: List[Any]) -> str:
    """
    Render available files list for chat agent context.

    Creates display names with index suffixes for duplicate filenames:
    - First occurrence: "audio.mp3"
    - Second occurrence: "audio.mp3 (2)"
    - Third occurrence: "audio.mp3 (3)"

    Args:
        attachments: List of FileAttachment objects (proto) with filename, mime_type, url

    Returns:
        Rendered available files section, or empty string if no files
    """
    if not attachments:
        return ""

    # Track filename occurrences for duplicate handling
    filename_counts: dict[str, int] = {}
    files_for_template = []

    for attachment in attachments:
        # Extract filename from attachment (proto or dict)
        if hasattr(attachment, 'filename'):
            filename = attachment.filename or 'Unnamed file'
            mime_type = getattr(attachment, 'mime_type', '') or ''
        elif isinstance(attachment, dict):
            filename = attachment.get('filename', 'Unnamed file')
            mime_type = attachment.get('mime_type', '')
        else:
            continue

        # Determine file type from MIME type
        if mime_type.startswith('audio/'):
            file_type = 'audio'
        elif mime_type.startswith('image/'):
            file_type = 'image'
        elif mime_type.startswith('video/'):
            file_type = 'video'
        elif 'pdf' in mime_type:
            file_type = 'PDF'
        elif 'document' in mime_type or 'word' in mime_type:
            file_type = 'document'
        elif 'spreadsheet' in mime_type or 'excel' in mime_type:
            file_type = 'spreadsheet'
        elif mime_type.startswith('text/'):
            file_type = 'text'
        else:
            file_type = 'file'

        # Handle duplicate filenames with index suffix
        if filename in filename_counts:
            filename_counts[filename] += 1
            display_name = f"{filename} ({filename_counts[filename]})"
        else:
            filename_counts[filename] = 1
            display_name = filename

        files_for_template.append({
            'display_name': display_name,
            'filename': filename,
            'type': file_type,
            'mime_type': mime_type,
        })

    if not files_for_template:
        return ""

    return render_template("components/available_files.j2", files=files_for_template)


def render_output_instructions(
    skill_outputs: List[Any],
    target_field_metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Render output capture instructions for agent mode skills.

    When a skill has outputs with mappings, this template instructs the LLM
    to call submit_result() with the expected outputs. Includes type-aware
    guidance based on target field metadata when available.

    Args:
        skill_outputs: List of skill output objects (proto or dict format)
                      Each should have 'name', 'type', and optional 'description'
        target_field_metadata: Optional dict mapping output_name → target field info
                              (field_type, options, max_selections, field_name)

    Returns:
        Rendered output instructions string
    """
    if not skill_outputs:
        return ""

    target_metadata = target_field_metadata or {}

    # Convert protobuf outputs to dicts for template rendering
    outputs_for_template = []
    for output in skill_outputs:
        if hasattr(output, 'name'):
            # Proto object
            name = output.name
            output_type = getattr(output, 'type', 'text') or 'text'
            description = getattr(output, 'description', '') or ''
        elif isinstance(output, dict):
            # Already a dict
            name = output.get('name', '')
            output_type = output.get('type', 'text') or 'text'
            description = output.get('description', '') or ''
        else:
            continue

        # Get target field metadata if available
        target_meta = target_metadata.get(name, {})

        outputs_for_template.append({
            'name': name,
            'type': output_type,
            'description': description,
            'target': target_meta  # Includes field_type, options, max_selections
        })

    if not outputs_for_template:
        return ""

    rendered = render_template("components/output_capture.j2", outputs=outputs_for_template)

    # Write to debug file for inspection
    _write_debug_prompt("output_capture_instructions", rendered)

    return rendered


def build_agent_instructions(
    tools: Optional[List[Any]] = None,
    agent_type: str = "default",
    execution_mode: Optional[str] = None,
    phase: Optional[str] = None,
    skill_outputs: Optional[List[Any]] = None,
    session_attachments: Optional[List[Any]] = None,
    context_type: Optional[str] = None,  # DEPRECATED: Use execution_mode instead
    **kwargs: Any
) -> str:
    """
    Build agent instructions from Jinja2 templates.

    Centralized function for building instructions for all agent types.
    Ensures consistent base rules + agent-specific content + tool instructions.

    Args:
        tools: List of tool objects (for dynamic tool instructions)
        agent_type: Type of agent ("default", "document_builder", "skill_builder", "skill_executor")
        execution_mode: Execution mode ("interactive" or "autonomous")
        phase: Optional execution phase ("planning" or "execution")
        skill_outputs: Optional list of skill outputs for output capture instructions
        session_attachments: Optional list of session file attachments (for chat agent visibility)
        context_type: DEPRECATED - use execution_mode instead
        **kwargs: Template variables (e.g., restricted_tools)

    Returns:
        Rendered instructions string
    """
    from .tools import get_tool_instructions

    # Handle backward compatibility: context_type -> execution_mode
    if execution_mode is None:
        execution_mode = context_type or "interactive"

    try:
        # Base templates (always included for all agents) - cached for performance
        base_instructions = get_cached_base_instructions(**kwargs)

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

        # Mode-specific behavior (interactive vs autonomous) - separate template files
        try:
            mode_content = render_template(f"modes/{execution_mode}.j2")
            if mode_content.strip():
                base_instructions = f"{base_instructions}\n\n{mode_content}"
                logger.debug(f"📝 Added mode template: modes/{execution_mode}.j2")
        except Exception as e:
            logger.debug(f"📝 Mode template not rendered: {e}")

        # Phase-specific behavior (planning vs execution) - optional
        if phase:
            try:
                phase_content = render_template(f"phases/{phase}.j2")
                if phase_content.strip():
                    base_instructions = f"{base_instructions}\n\n{phase_content}"
                    logger.debug(f"📝 Added phase template: phases/{phase}.j2")
            except Exception as e:
                logger.debug(f"📝 Phase template not rendered: {e}")

        # Tool-specific instructions (dynamic based on available tools)
        if tools:
            tool_instructions = get_tool_instructions(tools)
            if tool_instructions:
                base_instructions = f"{base_instructions}\n\n{tool_instructions}"
                logger.debug(f"📝 Added tool instructions ({len(tool_instructions)} chars)")

        # Available files in session (for chat agent visibility only)
        # Sub-agents/skills don't need this - they reference files by name when calling skills
        if session_attachments and agent_type in ("chat_agent", "chat_planner"):
            files_section = render_available_files(session_attachments)
            if files_section:
                base_instructions = f"{base_instructions}\n\n{files_section}"
                logger.debug(f"📝 Added available files section ({len(files_section)} chars, {len(session_attachments)} files)")

        # Output capture instructions (for skills with output mappings)
        if skill_outputs:
            # Extract target field metadata for type-aware guidance
            from ..tools.output_tool import build_target_field_metadata_from_mappings
            target_metadata = build_target_field_metadata_from_mappings(skill_outputs)
            target_meta_dict = {
                name: {
                    'field_type': meta.field_type,
                    'options': meta.options,
                    'max_selections': meta.max_selections
                }
                for name, meta in target_metadata.items()
            }
            output_instructions = render_output_instructions(
                skill_outputs,
                target_field_metadata=target_meta_dict
            )
            if output_instructions:
                base_instructions = f"{base_instructions}\n\n{output_instructions}"
                logger.debug(f"📝 Added output capture instructions ({len(output_instructions)} chars)")

        # Log final size
        logger.info(f"📋 Instructions for {agent_type}: {len(base_instructions)} chars")

        # Always write to /tmp for debugging
        _write_debug_prompt(f"{agent_type}_instructions", base_instructions)

        return base_instructions
    except Exception as e:
        logger.error(f"❌ Failed to load templates: {e}")
        raise RuntimeError(f"Failed to build agent instructions: {e}") from e
