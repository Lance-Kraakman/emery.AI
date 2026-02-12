"""
Shared utilities for execution.

Contains:
- OutputPipeline: LLM-based output extraction and coercion
- HumanSkillHandler: Human skill event emission
- AttachmentProcessor: Extracts images and text from skill content

AIDEV-NOTE: Part of Phase 1 refactoring (Feb 2026).
"""

from .attachments import AttachmentProcessor, get_attachment_processor
from .human_skill import HumanSkillHandler, get_human_skill_handler
from .output_pipeline import OutputPipeline, get_output_pipeline

__all__ = [
    "AttachmentProcessor",
    "HumanSkillHandler",
    "OutputPipeline",
    "get_attachment_processor",
    "get_human_skill_handler",
    "get_output_pipeline",
]
