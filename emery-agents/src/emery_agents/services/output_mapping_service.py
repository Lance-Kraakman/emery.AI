"""
OutputMappingService - Shared HTTP operations for output mappings

Consolidates row creation/update logic used by both:
- agent_executor.py (operation mode and agent mode)
- skill_tool.py (delegation mode)

AIDEV-NOTE: Created to eliminate code duplication (2025-01)
"""

import os
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from ..entities.output_mapping import (
    OutputMappingConfig,
    FieldMapping,
    build_row_data,
    get_extension_for_mime
)

logger = logging.getLogger(__name__)


@dataclass
class MappingContext:
    """Context for applying output mappings."""
    api_key: str
    organization_id: str
    api_base_url: str = ""

    def __post_init__(self):
        if not self.api_base_url:
            nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
            self.api_base_url = f"{nextjs_base}/api"

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "X-Organization-ID": str(self.organization_id),
            "Content-Type": "application/json"
        }


class OutputMappingService:
    """Service for applying output mappings to database tables."""

    @staticmethod
    async def apply_mapping(
        ctx: MappingContext,
        config: OutputMappingConfig,
        data: Any,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Apply output mapping based on mode.

        Args:
            ctx: Mapping context with auth and API URL
            config: Output mapping configuration
            data: Result data to map (dict, list, or simple value)
            context: Additional context (source row info, etc.)

        Returns:
            True if mapping was applied successfully
        """
        if config.is_single_row:
            return await OutputMappingService._apply_single_row(ctx, config, data, context)
        elif config.is_multi_row:
            return await OutputMappingService._apply_multi_row(ctx, config, data, context)
        return False

    @staticmethod
    async def _apply_single_row(
        ctx: MappingContext,
        config: OutputMappingConfig,
        data: Any,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Apply single-row mapping (top result only)."""
        # Get first item if data is a list
        item = data[0] if isinstance(data, list) and data else data

        # Wrap simple values for field extraction
        if not isinstance(item, dict):
            item = {"value": item}

        row_data = build_row_data(item, config.mappings, context)

        if not row_data:
            logger.warning("No data to map for single-row mode")
            return False

        table_id = config.get_target_table_id()
        if not table_id:
            logger.warning("No target table ID in mappings")
            return False

        async with httpx.AsyncClient(timeout=30.0) as client:
            if config.is_create:
                return await OutputMappingService._create_row(client, ctx, table_id, row_data)
            elif config.is_update and config.row_id:
                return await OutputMappingService._update_row(client, ctx, table_id, config.row_id, row_data)
            else:
                logger.warning("Update mode requires row_id")
                return False

    @staticmethod
    async def _apply_multi_row(
        ctx: MappingContext,
        config: OutputMappingConfig,
        data: Any,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Apply multi-row mapping (one row per item)."""
        items = data if isinstance(data, list) else [data]
        table_id = config.get_target_table_id()

        if not table_id:
            logger.warning("No target table ID in mappings")
            return False

        success_count = 0
        async with httpx.AsyncClient(timeout=30.0) as client:
            for i, item in enumerate(items):
                # Wrap simple values
                if not isinstance(item, dict):
                    item = {"value": item}

                row_data = build_row_data(item, config.mappings, context)
                logger.info(f"📋 Item {i}: {item}, mappings: {[(m.source_field, m.target_field_id) for m in config.mappings]}, row_data: {row_data}")

                if row_data:
                    if await OutputMappingService._create_row(client, ctx, table_id, row_data):
                        success_count += 1
                else:
                    logger.warning(f"No data to map for item {i} - item={item}, mappings={[(m.source_field, m.target_field_id) for m in config.mappings]}")

        logger.info(f"Multi-row mapping: created {success_count}/{len(items)} rows")
        return success_count > 0

    @staticmethod
    async def _create_row(
        client: httpx.AsyncClient,
        ctx: MappingContext,
        table_id: int,
        row_data: Dict[str, Any]
    ) -> bool:
        """Create a row via API."""
        url = f"{ctx.api_base_url}/rows"
        # AIDEV-NOTE: dataKeyType='id' tells API that keys are field IDs, not field names
        payload = {"tableId": table_id, "data": row_data, "dataKeyType": "id"}

        try:
            response = await client.post(url, headers=ctx.headers, json=payload)
            if response.status_code >= 400:
                logger.error(f"Failed to create row: {response.status_code} - {response.text}")
                return False
            logger.info(f"✅ Created row in table {table_id}")
            return True
        except Exception as e:
            logger.error(f"Error creating row: {e}")
            return False

    @staticmethod
    async def _update_row(
        client: httpx.AsyncClient,
        ctx: MappingContext,
        table_id: int,
        row_id: str,
        row_data: Dict[str, Any]
    ) -> bool:
        """Update a row via API."""
        url = f"{ctx.api_base_url}/rows"
        # AIDEV-NOTE: dataKeyType='id' tells API that keys are field IDs, not field names
        payload = {"tableId": table_id, "rowId": row_id, "data": row_data, "dataKeyType": "id"}

        try:
            response = await client.put(url, headers=ctx.headers, json=payload)
            if response.status_code >= 400:
                logger.error(f"Failed to update row: {response.status_code} - {response.text}")
                return False
            logger.info(f"✅ Updated row {row_id} in table {table_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating row: {e}")
            return False

    @staticmethod
    async def upload_binary_to_s3(
        ctx: MappingContext,
        binary_data: bytes,
        mime_type: str,
        filename_prefix: str = "output"
    ) -> Optional[str]:
        """
        Upload binary data to S3 and return the URL.

        Args:
            ctx: Mapping context with auth
            binary_data: Raw binary data to upload
            mime_type: MIME type of the data
            filename_prefix: Prefix for the generated filename

        Returns:
            S3 URL of the uploaded file, or None on failure
        """
        ext = get_extension_for_mime(mime_type)
        filename = f"{filename_prefix}.{ext}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            # Get presigned URL
            presign_url = f"{ctx.api_base_url}/files/presign"
            presign_payload = {
                "filename": filename,
                "contentType": mime_type
            }

            try:
                presign_response = await client.post(
                    presign_url,
                    headers=ctx.headers,
                    json=presign_payload
                )
                if presign_response.status_code >= 400:
                    logger.error(f"Failed to get presigned URL: {presign_response.status_code}")
                    return None

                presign_data = presign_response.json()
                upload_url = presign_data.get("uploadUrl")
                file_url = presign_data.get("fileUrl")

                if not upload_url or not file_url:
                    logger.error("Missing upload URL or file URL in presign response")
                    return None

                # Upload to S3
                upload_response = await client.put(
                    upload_url,
                    content=binary_data,
                    headers={"Content-Type": mime_type}
                )

                if upload_response.status_code >= 400:
                    logger.error(f"Failed to upload to S3: {upload_response.status_code}")
                    return None

                logger.info(f"✅ Uploaded {filename} to S3")
                return file_url

            except Exception as e:
                logger.error(f"Error uploading to S3: {e}")
                return None
