"""
Unified output handling: extract → coerce → write.

Consolidates duplicated output extraction logic from:
- SkillExecutorService._execute_agent()
- SkillExecutorService._post_dag_output_pipeline()
- AgentExecutor.execute_task()

AIDEV-NOTE: Part of Phase 1.1 refactoring (Feb 2026).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import dspy

from emery_agents.reasoning.config import get_dspy_lm
from emery_agents.reasoning.modules.extractor import OutputExtractorModule
from emery_agents.reasoning.signatures.extraction import TargetFieldMeta

if TYPE_CHECKING:
    from emery_agents.entities.skill_config import OutputDefinition

logger = logging.getLogger(__name__)


class OutputPipeline:
    """Unified output handling: extract → coerce → write.

    Replaces duplicated logic in:
    - SkillExecutorService._execute_agent() lines 852-876
    - SkillExecutorService._post_dag_output_pipeline() lines 488-524
    - _coerce_extracted_values() module-level function

    Usage:
        pipeline = OutputPipeline()
        extracted = pipeline.extract_outputs(content, skill_outputs, skill_model, org_model)
        coerced = pipeline.coerce_values(extracted, field_metadata)
    """

    def extract_outputs(
        self,
        content: str,
        skill_outputs: list[OutputDefinition],
        skill_model: str | None = None,
        org_model: str | None = None,
        target_field_metadata: dict[str, TargetFieldMeta] | None = None,
    ) -> dict[str, Any]:
        """Extract structured values from text content using LLM.

        Args:
            content: Text to extract from (agent result string)
            skill_outputs: List of OutputDefinition with name, type, description
            skill_model: Skill-specific model override
            org_model: Organization default model
            target_field_metadata: Optional field constraints (select options)

        Returns:
            Dict mapping output name to extracted value (or None if not found)
        """
        if not skill_outputs:
            return {}

        extractor = OutputExtractorModule(
            skill_outputs=[
                {"name": o.name, "type": o.type, "description": o.description}
                for o in skill_outputs
            ],
            target_field_metadata=target_field_metadata,
        )

        lm = get_dspy_lm(skill_model=skill_model, org_model=org_model)
        with dspy.context(lm=lm):
            extracted = extractor.extract(content=content)

        if extracted:
            extracted_count = sum(1 for v in extracted.values() if v is not None)
            logger.info(f"🔍 Extracted {extracted_count}/{len(skill_outputs)} outputs")

        return extracted or {}

    def coerce_values(
        self,
        values: dict[str, Any],
        field_metadata: dict[str, TargetFieldMeta],
    ) -> dict[str, Any]:
        """Normalize extracted values to match target field constraints.

        Deterministic coercion based on field type:
        - single-select: case-insensitive match to valid options
        - multi-select: same, per item
        - boolean: normalize string representations ("true", "yes", "1")

        Args:
            values: Dict of extracted values
            field_metadata: Dict mapping output name to TargetFieldMeta

        Returns:
            Dict with coerced values
        """
        if not values or not field_metadata:
            return values

        coerced: dict[str, Any] = {}
        for name, value in values.items():
            if value is None:
                coerced[name] = value
                continue

            meta = field_metadata.get(name)
            if meta is None:
                coerced[name] = value
                continue

            if meta.type == "single-select" and meta.options:
                lookup = {o.lower(): o for o in meta.options}
                coerced[name] = lookup.get(str(value).strip().lower())
            elif meta.type == "multi-select" and meta.options:
                lookup = {o.lower(): o for o in meta.options}
                if isinstance(value, list):
                    coerced[name] = [
                        v
                        for v in (lookup.get(str(v).strip().lower()) for v in value)
                        if v is not None
                    ]
                else:
                    coerced[name] = value
            elif meta.type == "boolean":
                if isinstance(value, str):
                    coerced[name] = value.strip().lower() in ("true", "yes", "1")
                else:
                    coerced[name] = bool(value)
            else:
                coerced[name] = value

        return coerced

    def extract_and_coerce(
        self,
        content: str,
        skill_outputs: list[OutputDefinition],
        skill_model: str | None = None,
        org_model: str | None = None,
        target_field_metadata: dict[str, TargetFieldMeta] | None = None,
    ) -> dict[str, Any]:
        """Combined extract + coerce for convenience.

        Args:
            content: Text to extract from
            skill_outputs: Output definitions
            skill_model: Skill-specific model override
            org_model: Organization default model
            target_field_metadata: Field constraints for coercion

        Returns:
            Dict with extracted and coerced values
        """
        extracted = self.extract_outputs(
            content=content,
            skill_outputs=skill_outputs,
            skill_model=skill_model,
            org_model=org_model,
            target_field_metadata=target_field_metadata,
        )

        if extracted and target_field_metadata:
            return self.coerce_values(extracted, target_field_metadata)

        return extracted

    def check_extraction_success(
        self,
        extracted: dict[str, Any],
    ) -> bool:
        """Check if extraction produced any non-null values.

        Args:
            extracted: Dict of extracted values

        Returns:
            True if at least one value is not None
        """
        if not extracted:
            return False
        return any(v is not None for v in extracted.values())


# Singleton instance for convenience
_default_pipeline: OutputPipeline | None = None


def get_output_pipeline() -> OutputPipeline:
    """Get shared OutputPipeline instance."""
    global _default_pipeline
    if _default_pipeline is None:
        _default_pipeline = OutputPipeline()
    return _default_pipeline
