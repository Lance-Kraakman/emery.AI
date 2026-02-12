"""
Tests for HumanSkillHandler event building logic.

Tests pure deterministic logic - no LLM calls or mocks needed.
"""

import json
import pytest

from emery_agents.entities.skill_config import (
    HumanSkillConfig,
    OutputDefinition,
    SkillConfig,
)
from emery_agents.services.executors.shared.human_skill import HumanSkillHandler


def make_skill(
    skill_id: int = 1,
    name: str = "test_skill",
    instructions: str = "Do the thing",
    outputs: list[OutputDefinition] | None = None,
    human_config: HumanSkillConfig | None = None,
) -> SkillConfig:
    """Create a SkillConfig for testing."""
    return SkillConfig(
        id=skill_id,
        name=name,
        instructions=instructions,
        outputs=outputs or [],
        human_skill_config=human_config,
    )


class TestBuildAwaitingEvent:
    """Test HumanSkillHandler.build_awaiting_event() logic."""

    def setup_method(self):
        self.handler = HumanSkillHandler()

    def test_builds_event_structure(self):
        """Event contains required fields."""
        skill = make_skill(
            skill_id=42,
            name="review_document",
            instructions="Please review",
        )

        event = self.handler.build_awaiting_event(skill, {"doc_id": 123})

        assert event["type"] == "awaiting_human_skill"
        assert event["skill_id"] == 42
        assert event["skill_name"] == "review_document"
        assert event["instructions"] == "Please review"
        assert event["inputs"] == {"doc_id": 123}

    def test_output_schema_from_skill_outputs(self):
        """Output schema extracts name/type from skill outputs."""
        outputs = [
            OutputDefinition(name="approved", type="boolean"),
            OutputDefinition(name="comments", type="text"),
        ]
        skill = make_skill(outputs=outputs)

        event = self.handler.build_awaiting_event(skill, {})

        assert event["output_schema"] == [
            {"name": "approved", "type": "boolean"},
            {"name": "comments", "type": "text"},
        ]

    def test_empty_output_schema(self):
        """Empty outputs produces empty schema."""
        skill = make_skill(outputs=[])

        event = self.handler.build_awaiting_event(skill, {})

        assert event["output_schema"] == []

    def test_assigns_to_specific_user(self):
        """Specific user assignee returns user ID."""
        human_config = HumanSkillConfig(
            instructions="Review this",
            assignee_type="specific_user",
            assignee_id="user_12345",
        )
        skill = make_skill(human_config=human_config)

        event = self.handler.build_awaiting_event(skill, {})

        assert event["assigned_to"] == "user_12345"

    def test_assigns_to_role(self):
        """Role assignee returns 'role:role_name' format."""
        human_config = HumanSkillConfig(
            instructions="Approve budget",
            assignee_type="role",
            assignee_role="finance_manager",
        )
        skill = make_skill(human_config=human_config)

        event = self.handler.build_awaiting_event(skill, {})

        assert event["assigned_to"] == "role:finance_manager"

    def test_owner_assignee_returns_empty(self):
        """Owner assignee type returns empty string (resolved by task layer)."""
        human_config = HumanSkillConfig(
            instructions="Do something",
            assignee_type="owner",
        )
        skill = make_skill(human_config=human_config)

        event = self.handler.build_awaiting_event(skill, {})

        assert event["assigned_to"] == ""

    def test_no_human_config_uses_skill_instructions(self):
        """Without human_config, uses skill's instructions."""
        skill = make_skill(
            instructions="Skill-level instructions",
            human_config=None,
        )

        event = self.handler.build_awaiting_event(skill, {})

        assert event["instructions"] == "Skill-level instructions"

    def test_human_config_overrides_instructions(self):
        """Human config instructions override skill instructions."""
        human_config = HumanSkillConfig(
            instructions="Human-specific instructions",
        )
        skill = make_skill(
            instructions="Skill-level instructions",
            human_config=human_config,
        )

        event = self.handler.build_awaiting_event(skill, {})

        assert event["instructions"] == "Human-specific instructions"

    def test_step_id_included(self):
        """Step ID is included in event."""
        skill = make_skill()

        event = self.handler.build_awaiting_event(skill, {}, step_id="step_abc")

        assert event["step_id"] == "step_abc"

    def test_step_id_empty_by_default(self):
        """Step ID is empty string by default."""
        skill = make_skill()

        event = self.handler.build_awaiting_event(skill, {})

        assert event["step_id"] == ""

    def test_external_links_always_empty_list(self):
        """External links is always empty list (for future use)."""
        skill = make_skill()

        event = self.handler.build_awaiting_event(skill, {})

        assert event["external_links"] == []


class TestBuildProgressDict:
    """Test HumanSkillHandler.build_progress_dict() logic."""

    def setup_method(self):
        self.handler = HumanSkillHandler()

    def test_wraps_event_in_progress_format(self):
        """Progress dict wraps event with correct structure."""
        event = {
            "type": "awaiting_human_skill",
            "skill_id": 1,
            "skill_name": "test",
        }

        progress = self.handler.build_progress_dict(event)

        assert progress["status"] == "awaiting_human"
        assert progress["error_message"] == ""
        assert progress["progress_percent"] == 0.0
        assert "timestamp_ms" in progress

    def test_output_is_json_serialized_event(self):
        """Output field contains JSON-serialized event."""
        event = {"type": "awaiting_human_skill", "skill_id": 42}

        progress = self.handler.build_progress_dict(event)

        parsed = json.loads(progress["output"])
        assert parsed == event

    def test_timestamp_is_positive_integer(self):
        """Timestamp is a positive integer (milliseconds)."""
        event = {"type": "test"}

        progress = self.handler.build_progress_dict(event)

        assert isinstance(progress["timestamp_ms"], int)
        assert progress["timestamp_ms"] > 0
