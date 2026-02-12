"""
Attachment processor for skill execution.

Extracts images and text parts from skill_config.content.

AIDEV-NOTE: Part of Phase 2.5 refactoring (Feb 2026).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from PIL import Image

from emery_agents.entities.message import ImagePart, TextPart
from emery_agents.services.data.image_processor import ImageProcessor
from emery_agents.utils import run_async_in_thread

if TYPE_CHECKING:
    from emery_agents.entities.skill_config import SkillConfig

logger = logging.getLogger(__name__)


class AttachmentProcessor:
    """Processes attachments from skill_config.content.

    Extracts:
    - Images: Downloaded as PIL.Image objects
    - Text: Extracted as string parts

    Replaces SkillExecutorService._process_skill_attachments().
    """

    def process(
        self,
        skill_config: SkillConfig,
    ) -> tuple[list[Image.Image], list[str]]:
        """Process attachments from skill_config.content.

        Args:
            skill_config: Skill configuration with optional content attachments

        Returns:
            Tuple of (list of PIL images, list of text parts)
        """
        images: list[Image.Image] = []
        text_parts: list[str] = []

        if not skill_config.content:
            return images, text_parts

        logger.info(
            f"📎 Processing {len(skill_config.content)} attachments from skill config"
        )

        try:
            image_urls: list[str] = []
            for part in skill_config.content:
                if isinstance(part, TextPart):
                    text_parts.append(f"\n\n{part.text}")
                elif isinstance(part, ImagePart) and part.url:
                    image_urls.append(part.url)

            if image_urls:
                pil_images = run_async_in_thread(
                    ImageProcessor.download_images_from_urls(image_urls)
                )
                images.extend(pil_images)

            logger.info(
                f"✅ Processed: {len(images)} images, {len(text_parts)} text parts"
            )
        except Exception as e:
            logger.error(f"❌ Failed to process attachments: {e}")

        return images, text_parts

    def build_task_with_attachments(
        self,
        instructions: str,
        inputs: dict[str, Any],
        text_parts: list[str],
    ) -> str:
        """Build task string from instructions, inputs, and text attachments.

        Args:
            instructions: Base skill instructions
            inputs: Runtime input values
            text_parts: Text parts extracted from attachments

        Returns:
            Combined task string
        """
        task_parts = [instructions]

        if inputs:
            task_parts.append("\n\nInputs:")
            for key, value in inputs.items():
                task_parts.append(f"- {key}: {value}")

        # Add text parts from attachments
        task_parts.extend(text_parts)

        return "\n".join(task_parts)


# Singleton instance
_default_processor: AttachmentProcessor | None = None


def get_attachment_processor() -> AttachmentProcessor:
    """Get shared AttachmentProcessor instance."""
    global _default_processor
    if _default_processor is None:
        _default_processor = AttachmentProcessor()
    return _default_processor
