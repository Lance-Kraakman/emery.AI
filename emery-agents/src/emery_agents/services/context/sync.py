"""
Context Sync Service

Handles bidirectional sync between local workspace (parquet) and dynamic tables.
"""

import logging
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

from emery_agents.entities.models.context_mapping import (
    ContextMapping,
    ResolvedContext,
)
from emery_agents.infrastructure.workspace import (
    ContextCache,
    TableMetadata,
    WorkspaceConfig,
)

logger = logging.getLogger(__name__)


class ContextSyncService:
    """
    Handles bidirectional sync between local workspace and dynamic tables.

    Sync flow:
    1. Before execution: sync_to_local() pulls tables to parquet files
    2. During execution: agent reads/writes to local parquet via ContextCache
    3. After execution: sync_to_remote() pushes modified tables back
    """

    def __init__(
        self,
        workspace: WorkspaceConfig,
        grpc_client=None,
    ):
        """
        Initialize context sync service.

        Args:
            workspace: Workspace configuration
            grpc_client: Optional gRPC client for table data sync
        """
        self.workspace = workspace
        self.grpc_client = grpc_client

    async def sync_to_local(
        self,
        mappings: list[ContextMapping],
    ) -> ContextCache:
        """
        Sync remote tables to local parquet files.

        Called before agent execution to prepare context.

        Args:
            mappings: List of context mappings to sync

        Returns:
            ContextCache with synced tables
        """
        cache = ContextCache(self.workspace)

        for mapping in mappings:
            if not mapping.can_read():
                continue

            if not mapping.should_sync_on_access():
                continue

            try:
                await self._sync_table_to_local(cache, mapping)
            except Exception as e:
                logger.error(f"Failed to sync table {mapping.table_name} to local: {e}")
                # Continue with other tables even if one fails

        return cache

    async def _sync_table_to_local(
        self,
        cache: ContextCache,
        mapping: ContextMapping,
    ) -> None:
        """Sync a single table to local parquet."""
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, skipping sync for {mapping.table_name}"
            )
            return

        # Fetch table data via gRPC
        response = await self.grpc_client.fetch_table_data(
            table_id=mapping.table_id,
            include_embeddings=True,
        )

        # Convert to DataFrame
        df = self._proto_to_dataframe(response)

        # Create metadata
        metadata = TableMetadata(
            table_id=mapping.table_id,
            table_name=mapping.table_name,
            synced_at=datetime.utcnow(),
            row_count=len(df),
            field_names=list(df.columns),
            has_embeddings=any(f.type == "embedding" for f in response.fields)
            if hasattr(response, "fields")
            else False,
        )

        # Write to local cache
        cache.write_table(mapping.table_name, df, metadata)

        logger.info(f"Synced table {mapping.table_name} to local: {len(df)} rows")

    async def sync_to_remote(
        self,
        cache: ContextCache,
        mappings: list[ContextMapping],
    ) -> None:
        """
        Sync modified local tables back to dynamic tables.

        Called after agent execution to persist changes.

        Args:
            cache: ContextCache with potentially modified tables
            mappings: List of context mappings
        """
        modified_tables = cache.get_modified_tables()

        if not modified_tables:
            logger.debug("No modified tables to sync")
            return

        for mapping in mappings:
            if not mapping.can_write():
                continue

            if mapping.table_name not in modified_tables:
                continue

            try:
                await self._sync_table_to_remote(cache, mapping)
            except Exception as e:
                logger.error(
                    f"Failed to sync table {mapping.table_name} to remote: {e}"
                )
                # Continue with other tables even if one fails

    async def _sync_table_to_remote(
        self,
        cache: ContextCache,
        mapping: ContextMapping,
    ) -> None:
        """Sync a single modified table back to remote."""
        if not self.grpc_client:
            logger.warning(
                f"No gRPC client available, skipping remote sync for {mapping.table_name}"
            )
            return

        # Read modified data
        df = cache.read_table(mapping.table_name)

        # Convert to proto format
        rows = self._dataframe_to_proto_rows(df)

        # Sync back via gRPC
        response = await self.grpc_client.upsert_rows(
            table_id=mapping.table_id,
            rows=rows,
            key_field="id",  # Assume 'id' is the key field
        )

        if response.success:
            cache.clear_modified_flag(mapping.table_name)
            logger.info(
                f"Synced table {mapping.table_name} to remote: "
                f"{response.inserted_count} inserted, {response.updated_count} updated"
            )
        else:
            logger.error(f"Failed to sync table {mapping.table_name}: {response.error}")

    def _proto_to_dataframe(self, response) -> pd.DataFrame:
        """
        Convert gRPC table response to DataFrame.

        Handles various field types including embeddings.
        """
        if not hasattr(response, "rows") or not response.rows:
            return pd.DataFrame()

        rows = []
        field_map = (
            {f.id: f for f in response.fields} if hasattr(response, "fields") else {}
        )

        for row in response.rows:
            row_dict = {"id": row.id}

            if hasattr(row, "values"):
                for field_id, value in row.values.items():
                    field = field_map.get(field_id)
                    if not field:
                        continue

                    field_name = field.name

                    # Handle different value types
                    if hasattr(value, "embedding_value") and value.embedding_value:
                        # Convert bytes to numpy array
                        row_dict[field_name] = np.frombuffer(
                            value.embedding_value, dtype=np.float32
                        )
                    elif hasattr(value, "string_value"):
                        row_dict[field_name] = value.string_value
                    elif hasattr(value, "int_value"):
                        row_dict[field_name] = value.int_value
                    elif hasattr(value, "float_value"):
                        row_dict[field_name] = value.float_value
                    elif hasattr(value, "bool_value"):
                        row_dict[field_name] = value.bool_value
                    elif hasattr(value, "json_value"):
                        row_dict[field_name] = value.json_value
                    else:
                        row_dict[field_name] = None

            rows.append(row_dict)

        return pd.DataFrame(rows)

    def _dataframe_to_proto_rows(self, df: pd.DataFrame) -> list[dict[str, Any]]:
        """
        Convert DataFrame to proto-compatible row format.

        Returns list of dicts that can be serialized for gRPC.
        """
        rows = []

        for _, row in df.iterrows():
            row_dict = {}
            for col in df.columns:
                value = row[col]

                # Handle numpy arrays (embeddings)
                if isinstance(value, np.ndarray):
                    row_dict[col] = value.tobytes()
                elif pd.isna(value):
                    row_dict[col] = None
                else:
                    row_dict[col] = value

            rows.append(row_dict)

        return rows

    async def sync_for_execution(
        self,
        resolved_context: ResolvedContext,
    ) -> ContextCache:
        """
        Convenience method to sync all context for execution.

        Args:
            resolved_context: Resolved context mappings

        Returns:
            ContextCache ready for agent use
        """
        return await self.sync_to_local(resolved_context.mappings)

    async def sync_after_execution(
        self,
        cache: ContextCache,
        resolved_context: ResolvedContext,
    ) -> None:
        """
        Convenience method to sync all modified tables after execution.

        Args:
            cache: ContextCache with potentially modified tables
            resolved_context: Resolved context mappings
        """
        await self.sync_to_remote(cache, resolved_context.mappings)


class ContextSyncServiceFactory:
    """Factory for creating ContextSyncService instances."""

    def __init__(self, grpc_client=None):
        """
        Initialize factory.

        Args:
            grpc_client: gRPC client to use for all sync services
        """
        self.grpc_client = grpc_client

    def create_for_session(
        self,
        session_id: str,
        organization_id: int,
    ) -> ContextSyncService:
        """
        Create a ContextSyncService for a specific session.

        Args:
            session_id: Session identifier
            organization_id: Organization ID

        Returns:
            ContextSyncService configured for the session
        """
        workspace = WorkspaceConfig.from_session(session_id, organization_id)
        return ContextSyncService(
            workspace=workspace,
            grpc_client=self.grpc_client,
        )
