"""
Image Processing Utility

Consolidates image downloading and processing functionality used across:
- agent_executor.py
- chat_processing_service.py

Provides consistent image handling for vision model support.
"""

import logging
import aiohttp
from io import BytesIO
from typing import List, Optional
from PIL import Image

from smolagents.models import ChatMessage
from ..grpc.generated import agent_worker_pb2

logger = logging.getLogger(__name__)


class ImageProcessor:
    """Utility class for downloading and processing images for AI vision models."""

    @staticmethod
    async def download_images_from_urls(urls: List[str]) -> List[Image.Image]:
        """
        Download images from URLs and convert to PIL.Image objects.

        AIDEV-NOTE: Consolidates image downloading from:
        - agent_executor._download_images() for ImageAttachment objects
        - chat message_mapper.py for URL-based downloads

        Args:
            urls: List of image URLs (S3 pre-signed URLs, HTTP URLs, etc.)

        Returns:
            List of PIL.Image objects ready for agent.run(images=...)
        """
        if not urls:
            return []

        pil_images = []
        async with aiohttp.ClientSession() as session:
            for url in urls:
                try:
                    logger.info(f"Downloading image from: {url[:50]}...")
                    async with session.get(url) as response:
                        if response.status == 200:
                            image_data = await response.read()
                            pil_img = Image.open(BytesIO(image_data))
                            pil_images.append(pil_img)
                            logger.info(f"Successfully loaded image: {pil_img.size}")
                        else:
                            logger.warning(f"Failed to download image: HTTP {response.status}")
                except Exception as e:
                    logger.error(f"Error downloading image from {url}: {e}")
                    continue

        logger.info(f"Downloaded {len(pil_images)}/{len(urls)} images")
        return pil_images

    @staticmethod
    async def download_images_from_attachments(
        image_attachments: List[agent_worker_pb2.ImageAttachment]
    ) -> List[Image.Image]:
        """
        Download images from ImageAttachment protobuf objects.

        Args:
            image_attachments: List of ImageAttachment protobuf objects with URLs

        Returns:
            List of PIL.Image objects
        """
        urls = [img.url for img in image_attachments if img.url]
        return await ImageProcessor.download_images_from_urls(urls)

    @staticmethod
    def extract_images_from_message(message: ChatMessage) -> List[Image.Image]:
        """
        Extract PIL Image objects from ChatMessage content.

        Args:
            message: ChatMessage object with content as MessageContentList

        Returns:
            List of PIL.Image objects (empty if no images)

        AIDEV-NOTE: Used to pass images to agent.run() via the official images parameter.
        Smolagents expects list[PIL.Image], not URLs or base64 strings.
        Content is always MessageContentList (list of content parts).
        """
        if not message or not message.content:
            return []

        content = message.content

        # Extract all images from content parts
        images: List[Image.Image] = []
        for part in content:
            if part.get("type") == "image":
                images.append(part["image"])

        return images
