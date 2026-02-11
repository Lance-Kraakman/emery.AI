"""
Workspace Infrastructure for Context Sync

Manages local parquet files that sync with dynamic tables.
Provides read/write access and tracks modifications for sync.
"""

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


@dataclass
class WorkspaceConfig:
    """
    Configuration for an agent workspace.

    Each session gets its own workspace directory with:
    - context/: Synced context tables (parquet files)
    - results/: Offloaded large results
    """

    base_dir: Path
    session_id: str
    organization_id: int

    @classmethod
    def from_session(cls, session_id: str, org_id: int) -> "WorkspaceConfig":
        """Create workspace config from session ID."""
        base = Path.home() / ".emery" / "workspace" / session_id
        return cls(base_dir=base, session_id=session_id, organization_id=org_id)

    @property
    def context_dir(self) -> Path:
        """Directory for synced context tables."""
        return self.base_dir / "context"

    @property
    def results_dir(self) -> Path:
        """Directory for offloaded results."""
        return self.base_dir / "results"

    def ensure_dirs(self) -> None:
        """Create workspace directories if they don't exist."""
        self.context_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def cleanup(self) -> None:
        """Remove workspace directory (for session cleanup)."""
        import shutil

        if self.base_dir.exists():
            shutil.rmtree(self.base_dir)


@dataclass
class TableMetadata:
    """Metadata for a cached table."""

    table_id: int
    table_name: str
    synced_at: datetime
    row_count: int
    field_names: list[str]
    has_embeddings: bool = False


class ContextCache:
    """
    Local cache of context tables as parquet files.

    Provides read/write access and tracks modifications for sync.
    Tables are stored as parquet files for efficient columnar access.
    """

    def __init__(self, workspace: WorkspaceConfig):
        self.workspace = workspace
        self.workspace.ensure_dirs()
        self._modified_tables: set = set()
        self._table_metadata: dict[str, TableMetadata] = {}

    def table_path(self, table_name: str) -> Path:
        """Get path to parquet file for a table."""
        # Sanitize table name for filesystem
        safe_name = table_name.lower().replace(" ", "_").replace("-", "_")
        return self.workspace.context_dir / f"{safe_name}.parquet"

    def metadata_path(self, table_name: str) -> Path:
        """Get path to metadata file for a table."""
        safe_name = table_name.lower().replace(" ", "_").replace("-", "_")
        return self.workspace.context_dir / f"{safe_name}.meta.json"

    def write_table(
        self, table_name: str, data: pd.DataFrame, metadata: TableMetadata | None = None
    ) -> None:
        """
        Write table data to local parquet file.

        Args:
            table_name: Name of the table
            data: DataFrame with table data
            metadata: Optional metadata about the table
        """
        path = self.table_path(table_name)

        # Handle empty dataframes
        if data.empty:
            # Create empty parquet with schema
            table = pa.Table.from_pandas(data)
        else:
            table = pa.Table.from_pandas(data)

        pq.write_table(table, path)

        # Save metadata
        if metadata:
            self._table_metadata[table_name] = metadata
            meta_path = self.metadata_path(table_name)
            with open(meta_path, "w") as f:
                json.dump(
                    {
                        "table_id": metadata.table_id,
                        "table_name": metadata.table_name,
                        "synced_at": metadata.synced_at.isoformat(),
                        "row_count": metadata.row_count,
                        "field_names": metadata.field_names,
                        "has_embeddings": metadata.has_embeddings,
                    },
                    f,
                )

    def read_table(self, table_name: str) -> pd.DataFrame:
        """
        Read table from local parquet file.

        Args:
            table_name: Name of the table

        Returns:
            DataFrame with table data, or empty DataFrame if not found
        """
        path = self.table_path(table_name)
        if not path.exists():
            return pd.DataFrame()
        return pq.read_table(path).to_pandas()

    def read_metadata(self, table_name: str) -> TableMetadata | None:
        """Read metadata for a table."""
        if table_name in self._table_metadata:
            return self._table_metadata[table_name]

        meta_path = self.metadata_path(table_name)
        if not meta_path.exists():
            return None

        with open(meta_path) as f:
            data = json.load(f)
            return TableMetadata(
                table_id=data["table_id"],
                table_name=data["table_name"],
                synced_at=datetime.fromisoformat(data["synced_at"]),
                row_count=data["row_count"],
                field_names=data["field_names"],
                has_embeddings=data.get("has_embeddings", False),
            )

    def append_rows(self, table_name: str, rows: list[dict]) -> None:
        """
        Append rows to a table.

        Marks the table as modified for sync.

        Args:
            table_name: Name of the table
            rows: List of row dictionaries to append
        """
        df = self.read_table(table_name)
        new_df = pd.concat([df, pd.DataFrame(rows)], ignore_index=True)
        self.write_table(table_name, new_df)
        self._modified_tables.add(table_name)

    def update_rows(
        self, table_name: str, updates: list[dict], key_column: str = "id"
    ) -> None:
        """
        Update rows by key column.

        Marks the table as modified for sync.

        Args:
            table_name: Name of the table
            updates: List of update dictionaries (must include key column)
            key_column: Column to match for updates
        """
        df = self.read_table(table_name)

        for update in updates:
            if key_column not in update:
                raise ValueError(f"Update must include key column '{key_column}'")

            key_value = update[key_column]
            mask = df[key_column] == key_value

            for col, val in update.items():
                if col != key_column and col in df.columns:
                    df.loc[mask, col] = val

        self.write_table(table_name, df)
        self._modified_tables.add(table_name)

    def delete_rows(
        self, table_name: str, key_values: list[Any], key_column: str = "id"
    ) -> int:
        """
        Delete rows by key column.

        Marks the table as modified for sync.

        Args:
            table_name: Name of the table
            key_values: List of key values to delete
            key_column: Column to match for deletion

        Returns:
            Number of rows deleted
        """
        df = self.read_table(table_name)
        original_count = len(df)

        df = df[~df[key_column].isin(key_values)]

        self.write_table(table_name, df)
        self._modified_tables.add(table_name)

        return original_count - len(df)

    def semantic_search(
        self,
        table_name: str,
        query_embedding: np.ndarray,
        embedding_column: str = "embedding",
        top_k: int = 5,
    ) -> pd.DataFrame:
        """
        Search table by embedding similarity.

        Uses cosine similarity for vector matching.

        Args:
            table_name: Name of the table
            query_embedding: Query embedding vector
            embedding_column: Column containing embeddings
            top_k: Number of results to return

        Returns:
            DataFrame with top-k results and similarity scores
        """
        df = self.read_table(table_name)

        if df.empty or embedding_column not in df.columns:
            return pd.DataFrame()

        # Extract embeddings, handling potential None values
        valid_mask = df[embedding_column].notna()
        if not valid_mask.any():
            return pd.DataFrame()

        valid_df = df[valid_mask].copy()

        # Stack embeddings into numpy array
        embeddings = np.stack(valid_df[embedding_column].values)

        # Normalize query
        query_norm = query_embedding / np.linalg.norm(query_embedding)

        # Normalize embeddings
        embedding_norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        normalized_embeddings = embeddings / embedding_norms

        # Compute cosine similarity
        similarities = np.dot(normalized_embeddings, query_norm)

        # Get top-k indices
        top_indices = np.argsort(similarities)[-top_k:][::-1]

        result = valid_df.iloc[top_indices].copy()
        result["_similarity"] = similarities[top_indices]

        return result

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists in the cache."""
        return self.table_path(table_name).exists()

    def is_modified(self, table_name: str) -> bool:
        """Check if a table has been modified since last sync."""
        return table_name in self._modified_tables

    def get_modified_tables(self) -> list[str]:
        """Get list of all modified tables."""
        return list(self._modified_tables)

    def clear_modified_flag(self, table_name: str) -> None:
        """Clear the modified flag for a table (after sync)."""
        self._modified_tables.discard(table_name)

    def clear_all_modified_flags(self) -> None:
        """Clear all modified flags."""
        self._modified_tables.clear()

    def list_tables(self) -> list[str]:
        """List all cached tables."""
        tables = []
        for path in self.workspace.context_dir.glob("*.parquet"):
            # Convert filename back to table name
            table_name = path.stem.replace("_", " ").title()
            tables.append(table_name)
        return tables

    def get_table_stats(self, table_name: str) -> dict | None:
        """Get statistics for a cached table."""
        if not self.table_exists(table_name):
            return None

        df = self.read_table(table_name)
        path = self.table_path(table_name)

        return {
            "table_name": table_name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": list(df.columns),
            "file_size_bytes": path.stat().st_size,
            "is_modified": self.is_modified(table_name),
        }
