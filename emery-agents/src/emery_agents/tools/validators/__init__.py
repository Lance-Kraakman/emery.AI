"""
Validators package for tool input/output validation.

Provides validation utilities for:
- Puck templateData (page_crud)
- Field schemas (field_crud)
- Other tool-specific validation

Schema is auto-generated from TypeScript. Run `pnpm generate:blocks-schema` to update.
"""

from .puck_validator import (
    PuckValidator,
    PuckValidationError,
    validate_page_template,
    get_block_schema,
    get_blocks_schema,
    render_block_reference,
    get_all_block_names,
)

__all__ = [
    "PuckValidator",
    "PuckValidationError",
    "validate_page_template",
    # Context helpers for prompts
    "get_block_schema",
    "get_blocks_schema",
    "render_block_reference",
    "get_all_block_names",
]
