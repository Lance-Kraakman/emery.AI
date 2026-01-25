"""DSPy tool wrapper that provides smolagents-like attributes.

This wrapper allows plain Python functions to be used in contexts that expect
tools with `name`, `description`, and `inputs` attributes (like the old
smolagents-based code).

DSPy ReAct uses the function directly, but other parts of the system
(logging, tool lookup) need these attributes.
"""

from __future__ import annotations

import inspect
from typing import Any, Callable, get_type_hints


class DSPyToolWrapper:
    """Wraps a plain function to have smolagents-like attributes.

    This allows DSPy tool functions to be used anywhere the codebase expects
    a tool with `name`, `description`, and `inputs` attributes.

    Example:
        def my_tool(query: str, limit: int = 10) -> str:
            '''Search for items.

            Args:
                query: Search query
                limit: Max results
            '''
            return f"Found {limit} results for {query}"

        wrapped = DSPyToolWrapper(my_tool)
        wrapped.name  # "my_tool"
        wrapped.description  # "Search for items..."
        wrapped.inputs  # {"query": {...}, "limit": {...}}
        wrapped(query="test")  # "Found 10 results for test"
    """

    def __init__(
        self,
        func: Callable[..., str],
        name: str | None = None,
        description: str | None = None,
    ):
        """Initialize wrapper with function and optional overrides.

        Args:
            func: The tool function to wrap
            name: Override tool name (default: function name)
            description: Override description (default: function docstring)
        """
        self.func = func
        self.name = name or func.__name__
        self.description = description or self._extract_description(func)
        self.inputs = self._build_inputs_schema(func)
        self.output_type = "string"

    def __call__(self, **kwargs: Any) -> str:
        """Execute the wrapped function."""
        return self.func(**kwargs)

    def _extract_description(self, func: Callable) -> str:
        """Extract description from docstring (first paragraph only)."""
        doc = func.__doc__ or ""
        # Get first paragraph (before empty line or Args:)
        lines = []
        for line in doc.split("\n"):
            stripped = line.strip()
            if not stripped or stripped.startswith("Args:"):
                break
            lines.append(stripped)
        return " ".join(lines) if lines else f"Execute {func.__name__}"

    def _build_inputs_schema(self, func: Callable) -> dict[str, dict[str, str]]:
        """Build smolagents-style input schema from function signature.

        Returns:
            Dict mapping parameter name to {type, description}
        """
        schema: dict[str, dict[str, str]] = {}

        sig = inspect.signature(func)

        # Try to get type hints
        try:
            hints = get_type_hints(func)
        except Exception:
            hints = {}

        # Extract param descriptions from docstring
        param_docs = self._parse_param_docs(func.__doc__ or "")

        for param_name, param in sig.parameters.items():
            # Get type from hints or annotation
            type_hint = hints.get(param_name, param.annotation)
            type_str = self._type_to_str(type_hint)

            # Get description from docstring
            param_desc = param_docs.get(param_name, "")

            # Check if required (no default)
            is_required = param.default is inspect.Parameter.empty
            required_prefix = "(Required) " if is_required else "(Optional) "

            schema[param_name] = {
                "type": type_str,
                "description": f"{required_prefix}{param_desc}" if param_desc else required_prefix.strip(),
            }

        return schema

    def _type_to_str(self, type_hint: Any) -> str:
        """Convert type hint to smolagents type string."""
        if type_hint is inspect.Parameter.empty:
            return "string"

        # Handle string type hints
        if isinstance(type_hint, str):
            return type_hint.lower()

        # Get type name
        type_name = getattr(type_hint, "__name__", str(type_hint))

        # Map Python types to smolagents types
        type_map = {
            "str": "string",
            "int": "integer",
            "float": "number",
            "bool": "boolean",
            "dict": "object",
            "list": "array",
            "None": "null",
        }

        return type_map.get(type_name, "string")

    def _parse_param_docs(self, docstring: str) -> dict[str, str]:
        """Parse parameter descriptions from Google-style docstring.

        Handles format:
            Args:
                param_name: Description text
                    that may span multiple lines
        """
        param_docs: dict[str, str] = {}

        if not docstring:
            return param_docs

        lines = docstring.split("\n")
        in_args = False
        current_param: str | None = None
        current_desc: list[str] = []

        for line in lines:
            stripped = line.strip()

            # Start of Args section
            if stripped == "Args:":
                in_args = True
                continue

            # End of Args section (new section starts)
            if in_args and stripped and stripped.endswith(":") and not stripped.startswith(" "):
                if ":" not in stripped[:-1]:  # Not a param line
                    break

            if in_args:
                # Check for new parameter line: "param_name: description"
                if ": " in stripped and not line.startswith("        "):
                    # Save previous param
                    if current_param:
                        param_docs[current_param] = " ".join(current_desc).strip()

                    # Parse new param
                    parts = stripped.split(": ", 1)
                    current_param = parts[0].strip()
                    current_desc = [parts[1]] if len(parts) > 1 else []
                elif current_param and stripped:
                    # Continuation line
                    current_desc.append(stripped)

        # Save last param
        if current_param:
            param_docs[current_param] = " ".join(current_desc).strip()

        return param_docs


def wrap_tool(
    func: Callable[..., str],
    name: str | None = None,
    description: str | None = None,
) -> DSPyToolWrapper:
    """Convenience function to wrap a tool function.

    Args:
        func: The tool function to wrap
        name: Override tool name (default: function name)
        description: Override description (default: function docstring)

    Returns:
        DSPyToolWrapper instance
    """
    return DSPyToolWrapper(func, name, description)
