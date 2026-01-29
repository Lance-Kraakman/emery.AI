"""
DSPy Skill Builder Module.

This module handles automation skill creation.
"""

from __future__ import annotations

from typing import Any

import dspy

from emery_agents.reasoning.signatures.agents import (
    BuildSkill,
    ExistingSkill,
    SkillDefinition,
)


class SkillBuilderModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for building automation skills.

    Uses ChainOfThought for skill design based on specifications
    and available integrations.
    """

    def __init__(
        self,
        tools: list[Any] | None = None,
        auto_create: bool = False,
    ) -> None:
        """
        Initialize the skill builder module.

        Args:
            tools: Tools for creating skills
            auto_create: Whether to automatically create the skill after designing
        """
        super().__init__()
        self.designer = dspy.ChainOfThought(BuildSkill)
        self.tools = tools or []
        self.auto_create = auto_create

        if auto_create and tools:
            self.creator = dspy.ReAct(
                "skill -> created_skill",
                tools=tools,
                max_iters=5,
            )
        else:
            self.creator = None

    def forward(
        self,
        spec: str,
        available_integrations: list[str],
        existing_skills: list[ExistingSkill] | list[dict[str, Any]] | None = None,
    ) -> SkillDefinition:
        """
        Build an automation skill from specification.

        Args:
            spec: Specification of what the skill should do
            available_integrations: Available integrations (e.g., 'gmail', 'slack')
            existing_skills: List of existing skills

        Returns:
            SkillDefinition
        """
        # Convert dicts to ExistingSkill if needed
        skills: list[ExistingSkill] = []
        if existing_skills:
            skills = [
                ExistingSkill(**s) if isinstance(s, dict) else s
                for s in existing_skills
            ]

        # Design the skill
        result = self.designer(
            spec=spec,
            available_integrations=available_integrations,
            existing_skills=skills,
        )

        skill = result.skill

        # Optionally create using tools
        if self.auto_create and self.creator:
            self.creator(skill=skill.model_dump_json())

        return skill  # type: ignore[no-any-return]
