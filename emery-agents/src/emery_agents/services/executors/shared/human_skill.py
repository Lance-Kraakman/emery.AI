"""
Unified human skill event emission.

Consolidates duplicated human skill handling from:
- AgentExecutor._handle_human_skill_execution() [async]
- SkillExecutorService._handle_human_skill() [sync]

AIDEV-NOTE: Part of Phase 1.2 refactoring (Feb 2026).
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator, Callable
from typing import Any

from emery_agents.entities.skill_config import SkillConfig
from emery_agents.types import SkillExecutionResult

logger = logging.getLogger(__name__)


class HumanSkillHandler:
    """Unified human skill event emission.

    Human skills pause execution and wait for a human to complete the work.
    This handler provides both async (for AgentExecutor) and sync (for
    SkillExecutorService) paths for emitting the awaiting_human_skill event.

    Replaces duplicated logic in:
    - AgentExecutor._handle_human_skill_execution() [async, yields dict]
    - SkillExecutorService._handle_human_skill() [sync, returns SkillExecutionResult]
    """

    def build_awaiting_event(
        self,
        skill: SkillConfig,
        runtime_inputs: dict[str, Any],
        step_id: str = "",
    ) -> dict[str, Any]:
        """Build awaiting_human_skill event payload.

        Args:
            skill: Human skill configuration
            runtime_inputs: Context provided to the human
            step_id: Step ID for nested skill calls (empty for top-level)

        Returns:
            Event dict with type, skill_id, instructions, inputs, output_schema
        """
        human_config = skill.human_skill_config
        instructions = (
            human_config.instructions if human_config else skill.instructions
        )

        # Build input definitions lookup for field types
        input_defs_by_name = {inp.name: inp for inp in skill.inputs}

        # Build inputs with field type info for rich rendering
        inputs_with_types = []
        for name, value in runtime_inputs.items():
            input_def = input_defs_by_name.get(name)
            input_item = {
                "name": name,
                "type": input_def.type if input_def else "string",
                "value": value,
            }
            # Include fieldType if specified for rich rendering
            if input_def and input_def.field_type:
                input_item["fieldType"] = input_def.field_type
            inputs_with_types.append(input_item)

        # Build output schema from skill outputs with field type
        output_schema = []
        for out in skill.outputs:
            output_item = {
                "name": out.name,
                "type": out.type,
            }
            if out.description:
                output_item["description"] = out.description
            # Include fieldType if specified for rich rendering
            if out.field_type:
                output_item["fieldType"] = out.field_type
            # Extract relatedTableId from output mapping for relation fields
            if out.field_type == "relation" and out.output_mapping:
                for tm in out.output_mapping.table_mappings:
                    for fm in tm.mappings:
                        if fm.target_field_metadata:
                            related_table_id = fm.target_field_metadata.get("relatedTableId")
                            if related_table_id:
                                output_item["relatedTableId"] = related_table_id
                                break
                    if "relatedTableId" in output_item:
                        break
            output_schema.append(output_item)

        # Resolve assignee
        assigned_to = ""
        if human_config:
            if human_config.assignee_type == "specific_user" and human_config.assignee_id:
                assigned_to = human_config.assignee_id
            elif human_config.assignee_type == "role" and human_config.assignee_role:
                assigned_to = f"role:{human_config.assignee_role}"
            # For "owner", the task layer resolves the actual user

        return {
            "type": "awaiting_human_skill",
            "skill_id": skill.id,
            "skill_name": skill.name,
            "step_id": step_id,
            "instructions": instructions,
            "inputs": inputs_with_types,
            "output_schema": output_schema,
            "assigned_to": assigned_to,
            "external_links": [],
        }

    def build_progress_dict(
        self,
        event: dict[str, Any],
    ) -> dict[str, Any]:
        """Build progress dict for async yielding.

        Args:
            event: Event payload from build_awaiting_event()

        Returns:
            Progress dict with status="awaiting_human"
        """
        return {
            "status": "awaiting_human",
            "output": json.dumps(event),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 0.0,
        }

    async def emit_and_pause(
        self,
        skill: SkillConfig,
        runtime_inputs: dict[str, Any],
        step_id: str = "",
    ) -> AsyncIterator[dict[str, Any]]:
        """Emit awaiting event and pause (async path for AgentExecutor).

        Yields:
            Single progress dict with status="awaiting_human"
        """
        logger.info(f"👤 Human skill '{skill.name}' paused for human input")

        event = self.build_awaiting_event(skill, runtime_inputs, step_id)
        yield self.build_progress_dict(event)

    def emit_sync(
        self,
        skill: SkillConfig,
        runtime_inputs: dict[str, Any],
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
        capture_outputs: bool = False,
        step_id: str = "",
    ) -> str | SkillExecutionResult:
        """Emit awaiting event and return pause result (sync path for SkillExecutorService).

        Args:
            skill: Human skill config
            runtime_inputs: Context provided to the human
            progress_callback: Optional callback for streaming the event
            capture_outputs: If True, return SkillExecutionResult
            step_id: Step ID for nested skill calls

        Returns:
            SkillExecutionResult if capture_outputs=True, else str
        """
        logger.info(f"👤 Human skill detected: {skill.name}")

        event = self.build_awaiting_event(skill, runtime_inputs, step_id)

        # Emit event via progress callback if available
        if progress_callback:
            progress_callback(event)
            logger.info(f"📤 Emitted awaiting_human_skill event for {skill.name}")

        # Return result indicating skill is awaiting human
        result_msg = f"Awaiting human: {skill.name}"
        if capture_outputs:
            return SkillExecutionResult(
                result=result_msg,
                captured_outputs=None,
                status="awaiting_human",
            )
        return result_msg


# Singleton instance for convenience
_default_handler: HumanSkillHandler | None = None


def get_human_skill_handler() -> HumanSkillHandler:
    """Get shared HumanSkillHandler instance."""
    global _default_handler
    if _default_handler is None:
        _default_handler = HumanSkillHandler()
    return _default_handler
