"""
DSPy App Builder Module.

This module handles application creation.
"""

from __future__ import annotations

from typing import Any

import dspy

from emery_agents.reasoning.signatures.agents import (
    AppDefinition,
    BuildApp,
    ExistingTable,
)


class AppBuilderModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for building applications.

    Uses ChainOfThought for app design based on specifications
    and existing tables.
    """

    def __init__(
        self,
        tools: list[Any] | None = None,
        auto_create: bool = False,
    ) -> None:
        """
        Initialize the app builder module.

        Args:
            tools: Tools for creating apps
            auto_create: Whether to automatically create the app after designing
        """
        super().__init__()
        self.designer = dspy.ChainOfThought(BuildApp)
        self.tools = tools or []
        self.auto_create = auto_create

        if auto_create and tools:
            self.creator = dspy.ReAct(
                "app -> created_app",
                tools=tools,
                max_iters=5,
            )
        else:
            self.creator = None

    def forward(
        self,
        spec: str,
        existing_tables: list[ExistingTable] | list[dict[str, Any]],
        existing_apps: list[str] | None = None,
    ) -> AppDefinition:
        """
        Build an application from specification.

        Args:
            spec: Specification of what the app should do
            existing_tables: List of existing tables to reference
            existing_apps: Names of existing apps

        Returns:
            AppDefinition
        """
        # Convert dicts to ExistingTable if needed
        tables = [
            ExistingTable(**t) if isinstance(t, dict) else t
            for t in existing_tables
        ]

        # Design the app
        result = self.designer(
            spec=spec,
            existing_tables=tables,
            existing_apps=existing_apps or [],
        )

        app = result.app

        # Optionally create using tools
        if self.auto_create and self.creator:
            self.creator(app=app.model_dump_json())

        return app  # type: ignore[no-any-return]
