"""
Prompt Template Resolver

Resolves Jinja2 prompt templates with runtime context for autonomous skill execution.
Templates can reference skill inputs, discovered context, and previous step results.

Variable Syntax in Templates:
- Skill inputs: {{ request }}, {{ document_id }}, {{ table_id }}
- Discovered context: {{ docs_table_id }}, {{ docs_field_id }}
- Previous results: {{ steps.step_1.result }}
"""

import logging
from typing import Dict, Any, List, Optional

from jinja2 import Environment, BaseLoader, UndefinedError, meta

logger = logging.getLogger(__name__)


class PromptTemplateResolver:
    """
    Resolves Jinja2 prompt templates with runtime context.

    Used during autonomous skill execution to render pre-generated
    prompt templates with values discovered/provided at runtime.
    """

    def __init__(self):
        """Initialize the Jinja2 environment."""
        self.env = Environment(
            loader=BaseLoader(),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        # Add custom filters if needed
        self.env.filters['tojson'] = lambda x: __import__('json').dumps(x, indent=2)

    def resolve(
        self,
        template: str,
        skill_inputs: Optional[Dict[str, Any]] = None,
        discovered_context: Optional[Dict[str, Any]] = None,
        previous_results: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Render prompt template with runtime context.

        Args:
            template: Jinja2 template string from step.prompt_template
            skill_inputs: Runtime inputs from skill execution (request, table_id, etc.)
            discovered_context: Tables/fields found by context gathering
            previous_results: Results from earlier steps in the plan

        Returns:
            Fully rendered prompt ready for LLM execution
        """
        if not template:
            return ""

        # Build context for template rendering
        context = {
            # Skill inputs are top-level for easy access
            **(skill_inputs or {}),
            # Discovered context (tables, fields)
            **(discovered_context or {}),
            # Previous step results namespaced
            "steps": previous_results or {},
        }

        try:
            jinja_template = self.env.from_string(template)
            rendered = jinja_template.render(**context)

            logger.info(f"📝 Rendered prompt template ({len(rendered)} chars)")
            logger.debug(f"📝 Template context keys: {list(context.keys())}")

            return rendered

        except UndefinedError as e:
            # Variable not available - return template with note
            logger.warning(f"⚠️ Missing variable in template: {e}")
            return f"[Note: Variable '{e}' not available at runtime]\n\n{template}"
        except Exception as e:
            logger.error(f"❌ Template rendering failed: {e}")
            return template  # Return original template as fallback

    def get_required_variables(self, template: str) -> List[str]:
        """
        Extract variable names from a Jinja2 template.

        Useful for validating that all required context will be available.

        Args:
            template: Jinja2 template string

        Returns:
            List of variable names used in the template
        """
        if not template:
            return []

        try:
            ast = self.env.parse(template)
            return list(meta.find_undeclared_variables(ast))
        except Exception as e:
            logger.warning(f"⚠️ Failed to parse template for variables: {e}")
            return []

    def validate_template(
        self,
        template: str,
        available_variables: List[str],
    ) -> tuple[bool, List[str]]:
        """
        Validate that all required variables are available.

        Args:
            template: Jinja2 template string
            available_variables: List of variable names that will be provided

        Returns:
            Tuple of (is_valid, missing_variables)
        """
        required = set(self.get_required_variables(template))
        available = set(available_variables)
        # 'steps' is always available for previous results
        available.add('steps')

        missing = required - available
        return (len(missing) == 0, list(missing))


# Module-level singleton for convenience
_resolver: Optional[PromptTemplateResolver] = None


def get_resolver() -> PromptTemplateResolver:
    """Get the global PromptTemplateResolver instance."""
    global _resolver
    if _resolver is None:
        _resolver = PromptTemplateResolver()
    return _resolver


def resolve_prompt_template(
    template: str,
    skill_inputs: Optional[Dict[str, Any]] = None,
    discovered_context: Optional[Dict[str, Any]] = None,
    previous_results: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Convenience function to resolve a prompt template.

    Args:
        template: Jinja2 template string
        skill_inputs: Runtime inputs from skill execution
        discovered_context: Tables/fields found by context gathering
        previous_results: Results from earlier steps

    Returns:
        Rendered prompt string
    """
    return get_resolver().resolve(
        template=template,
        skill_inputs=skill_inputs,
        discovered_context=discovered_context,
        previous_results=previous_results,
    )
