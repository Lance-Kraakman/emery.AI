"""
DSPy Schema Builder Module.

This module handles database schema creation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import dspy

from emery_agents.dspy_modules.signatures.agents import (
    BuildSchema,
    ExistingTable,
    TableSchema,
)

if TYPE_CHECKING:
    pass


class SchemaBuilderModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for building database schemas.

    Uses ChainOfThought for schema design, optionally with ReAct
    for creating the schema using tools.
    """

    def __init__(
        self,
        tools: list[Any] | None = None,
        auto_create: bool = False,
    ) -> None:
        """
        Initialize the schema builder module.

        Args:
            tools: Tools for creating tables/fields (e.g., table_crud, field_crud)
            auto_create: Whether to automatically create the schema after designing
        """
        super().__init__()
        self.designer = dspy.ChainOfThought(BuildSchema)
        self.tools = tools or []
        self.auto_create = auto_create

        if auto_create and tools:
            self.creator = dspy.ReAct(
                "schema -> created_tables",
                tools=tools,
                max_iters=5,
            )
        else:
            self.creator = None

    def forward(
        self,
        requirements: str,
        existing_tables: list[ExistingTable] | list[dict[str, Any]],
        workspace_patterns: str = "",
    ) -> TableSchema:
        """
        Build a database schema from requirements.

        Args:
            requirements: Description of what the table should store
            existing_tables: List of existing tables (as ExistingTable or dicts)
            workspace_patterns: Common patterns in this workspace

        Returns:
            TableSchema definition
        """
        # Convert dicts to ExistingTable if needed
        tables = [
            ExistingTable(**t) if isinstance(t, dict) else t
            for t in existing_tables
        ]

        # Design the schema
        result = self.designer(
            requirements=requirements,
            existing_tables=tables,
            workspace_patterns=workspace_patterns,
        )

        schema = result.schema

        # Optionally create using tools
        if self.auto_create and self.creator:
            self.creator(schema=schema.model_dump_json())

        return schema  # type: ignore[no-any-return]
