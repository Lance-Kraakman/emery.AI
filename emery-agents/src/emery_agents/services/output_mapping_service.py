"""
OutputMappingService - Shared HTTP operations for output mappings

Consolidates row creation/update logic used by both:
- agent_executor.py (operation mode and agent mode)
- skill_tool.py (delegation mode)

AIDEV-NOTE: Redesigned for multi-table output mapping with typed references (2025-01)
"""

import os
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ..entities.output_mapping import (
    OutputMappingConfig,
    FieldMapping,
    FieldSource,
    TableMapping,
    TableMappingResult,
    RowAction,
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

    # =========================================================================
    # Multi-Table Output Mapping (typed references, ordered execution)
    # =========================================================================

    @staticmethod
    async def apply_multi_table_mapping(
        ctx: MappingContext,
        config: OutputMappingConfig,
        skill_outputs: Dict[str, Any]
    ) -> List[TableMappingResult]:
        """
        Execute table mappings in order, passing results to subsequent operations.

        Args:
            ctx: Mapping context with auth and API URL
            config: Output mapping configuration with table_mappings
            skill_outputs: Captured skill output values (name → value)

        Returns:
            List of TableMappingResult for all executed operations
        """
        results: List[TableMappingResult] = []
        results_by_order: Dict[int, TableMappingResult] = {}

        # Sort table mappings by order
        sorted_mappings = sorted(config.table_mappings, key=lambda m: m.order)

        logger.info(f"📊 Executing {len(sorted_mappings)} table mappings")

        async with httpx.AsyncClient(timeout=30.0) as client:
            for table_mapping in sorted_mappings:
                logger.info(f"📋 Processing table mapping #{table_mapping.order}: "
                           f"table={table_mapping.target_table_id}, action={table_mapping.row_action}")

                # Resolve field values using typed sources
                row_data = OutputMappingService._resolve_field_values(
                    table_mapping.mappings,
                    skill_outputs,
                    results_by_order
                )

                if not row_data:
                    logger.warning(f"No data to map for table mapping #{table_mapping.order}")
                    continue

                # Execute the mapping (create/update row)
                row_id, created_data = await OutputMappingService._execute_table_mapping(
                    client, ctx, table_mapping, row_data
                )

                if row_id:
                    # Store result for subsequent mappings
                    result = TableMappingResult(
                        order=table_mapping.order,
                        table_id=table_mapping.target_table_id,
                        row_id=row_id,
                        row_data=created_data
                    )
                    results.append(result)
                    results_by_order[table_mapping.order] = result
                    logger.info(f"✅ Table mapping #{table_mapping.order} completed: row_id={row_id}")
                else:
                    logger.error(f"❌ Table mapping #{table_mapping.order} failed")

        logger.info(f"📊 Multi-table mapping complete: {len(results)}/{len(sorted_mappings)} succeeded")
        return results

    @staticmethod
    def _resolve_field_values(
        mappings: List[FieldMapping],
        skill_outputs: Dict[str, Any],
        previous_results: Dict[int, TableMappingResult]
    ) -> Dict[str, Any]:
        """
        Resolve typed field sources to actual values.

        Args:
            mappings: List of field mappings with typed sources
            skill_outputs: Skill output values (name → value)
            previous_results: Results from previous table operations (order → result)

        Returns:
            Dict mapping field_id (as string) to resolved value
        """
        resolved: Dict[str, Any] = {}

        for mapping in mappings:
            source = mapping.source
            value = None

            if source.type == 'skill_output':
                # Direct skill output
                value = skill_outputs.get(source.name)
                logger.debug(f"Resolved skill_output '{source.name}' = {value}")

            elif source.type == 'table_ref':
                # Reference to previous table result
                if source.order in previous_results:
                    result = previous_results[source.order]
                    if source.field == 'row_id':
                        value = result.row_id
                    else:
                        # Look up field value from created row data
                        value = result.row_data.get(source.field)
                    logger.debug(f"Resolved table_ref order={source.order} field='{source.field}' = {value}")
                else:
                    logger.warning(f"Table ref order={source.order} not found in previous results")

            if value is not None:
                resolved[str(mapping.target_field_id)] = value

        return resolved

    @staticmethod
    async def _fetch_row(
        client: httpx.AsyncClient,
        ctx: MappingContext,
        table_id: int,
        row_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch existing row data from the API.

        Args:
            client: HTTP client
            ctx: Mapping context with auth
            table_id: Table ID
            row_id: Row ID to fetch

        Returns:
            Row data dict with field values, or None if not found
        """
        url = f"{ctx.api_base_url}/rows"
        params = {"tableId": str(table_id), "rowId": row_id}

        try:
            response = await client.get(url, headers=ctx.headers, params=params)
            if response.status_code >= 400:
                logger.warning(f"Failed to fetch row {row_id}: {response.status_code}")
                return None

            data = response.json()
            # API returns { rows: [...], ... } format
            rows = data.get('data', {}).get('rows', [])
            if rows:
                return rows[0]
            return None
        except Exception as e:
            logger.error(f"Error fetching row {row_id}: {e}")
            return None

    @staticmethod
    def _merge_relation_values(
        existing: List[Dict[str, Any]],
        new_values: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Merge relation values, deduplicating by ID.

        Args:
            existing: Current relation values [{ id, value }, ...]
            new_values: New relation values to append

        Returns:
            Merged list with duplicates removed (new values take precedence)
        """
        # Build map of existing by ID for deduplication
        result_map: Dict[str, Dict[str, Any]] = {}

        # Add existing values first
        for item in existing:
            item_id = str(item.get('id', ''))
            if item_id:
                result_map[item_id] = item

        # Add/update with new values (overwrites if same ID)
        for item in new_values:
            item_id = str(item.get('id', ''))
            if item_id:
                result_map[item_id] = item

        return list(result_map.values())

    @staticmethod
    async def _execute_table_mapping(
        client: httpx.AsyncClient,
        ctx: MappingContext,
        table_mapping: TableMapping,
        row_data: Dict[str, Any]
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        """
        Execute a single table mapping operation.

        Args:
            client: HTTP client
            ctx: Mapping context
            table_mapping: Table mapping configuration
            row_data: Resolved field values to write

        Returns:
            Tuple of (row_id, created_data) or (None, {}) on failure
        """
        table_id = table_mapping.target_table_id

        if table_mapping.row_action == RowAction.CREATE:
            return await OutputMappingService._create_row_with_result(
                client, ctx, table_id, row_data
            )
        elif table_mapping.row_action == RowAction.UPDATE and table_mapping.row_id:
            final_row_data = row_data.copy()

            # Handle append mode for relation fields
            append_mappings = [m for m in table_mapping.mappings if m.append_mode]

            if append_mappings:
                # Fetch existing row data to merge with
                existing_row = await OutputMappingService._fetch_row(
                    client, ctx, table_id, table_mapping.row_id
                )

                if existing_row:
                    for mapping in append_mappings:
                        field_id = str(mapping.target_field_id)
                        new_val = row_data.get(field_id)
                        existing_val = existing_row.get(field_id, [])

                        if new_val is not None:
                            # Normalize to list format
                            new_list = new_val if isinstance(new_val, list) else [new_val]
                            existing_list = existing_val if isinstance(existing_val, list) else (
                                [existing_val] if existing_val else []
                            )

                            # Merge and deduplicate
                            merged = OutputMappingService._merge_relation_values(
                                existing_list, new_list
                            )
                            final_row_data[field_id] = merged
                            logger.debug(
                                f"Merged relation field {field_id}: "
                                f"{len(existing_list)} existing + {len(new_list)} new = {len(merged)} merged"
                            )

            success = await OutputMappingService._update_row(
                client, ctx, table_id, table_mapping.row_id, final_row_data
            )
            if success:
                return table_mapping.row_id, final_row_data
            return None, {}
        else:
            logger.warning("Update mode requires row_id")
            return None, {}

    @staticmethod
    async def _create_row_with_result(
        client: httpx.AsyncClient,
        ctx: MappingContext,
        table_id: int,
        row_data: Dict[str, Any]
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        """
        Create a row via API and return the created row_id and data.

        Args:
            client: HTTP client
            ctx: Mapping context
            table_id: Target table ID
            row_data: Field data to create

        Returns:
            Tuple of (row_id, created_data) or (None, {}) on failure
        """
        url = f"{ctx.api_base_url}/rows"
        # AIDEV-NOTE: dataKeyType='id' tells API that keys are field IDs, not field names
        payload = {"tableId": table_id, "data": row_data, "dataKeyType": "id"}

        try:
            response = await client.post(url, headers=ctx.headers, json=payload)
            if response.status_code >= 400:
                logger.error(f"Failed to create row: {response.status_code} - {response.text}")
                return None, {}

            # Parse response to get created row_id
            response_data = response.json()
            created_row = response_data.get("row", {})
            row_id = created_row.get("id")

            if not row_id:
                logger.error(f"Created row but no row_id in response: {response_data}")
                return None, {}

            logger.info(f"✅ Created row {row_id} in table {table_id}")
            return row_id, row_data

        except Exception as e:
            logger.error(f"Error creating row: {e}")
            return None, {}

    @staticmethod
    def _build_relation_value(row_id: str, display_value: str) -> Dict[str, Any]:
        """
        Build relation field value with ID and display value.

        Args:
            row_id: ID of the related row
            display_value: Display text for the relation

        Returns:
            Dict with 'id' and 'value' keys for relation field storage
        """
        return {"id": row_id, "value": display_value}
