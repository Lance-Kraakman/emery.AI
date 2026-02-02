"""
Redis-Backed Write Buffer for Delta Lake

Buffers row create/update/delete operations in Redis Hashes,
merges buffered state into reads, and periodically flushes
batched writes to Delta Lake.

Buffer keys per table:
  buffer:{s3_uri}:ops       -- Hash: row_id -> JSON {op, data, ts}
  buffer:{s3_uri}:flushing  -- Hash: ops being flushed (transient)
  buffer:active_tables      -- Set: s3_uris with pending ops

Design notes:
  - Redis Hashes (not Streams) for O(1) row_id lookup and self-compacting updates
  - RENAME for atomic flush rotation (zero write blocking during flush)
  - Returns False/empty on Redis failure (graceful degradation to direct writes)
"""

import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Any

import polars as pl
import pyarrow as pa

from .redis_client import get_redis_client
from .schema import extract_protobuf_value, arrow_to_polars_type

logger = logging.getLogger(__name__)

BUFFER_OPS_KEY = "buffer:{}:ops"
BUFFER_FLUSHING_KEY = "buffer:{}:flushing"
BUFFER_SIZE_KEY = "buffer:{}:size_bytes"
ACTIVE_TABLES_KEY = "buffer:active_tables"


class WriteBuffer:
    """Redis-backed write buffer for Delta Lake operations."""

    def __init__(self) -> None:
        self._redis = get_redis_client()

    @property
    def enabled(self) -> bool:
        return self._redis is not None

    def buffer_creates(self, s3_uri: str, rows_data: Any) -> bool:
        """Buffer insert operations. Returns False if Redis unavailable."""
        if not self._redis:
            return False
        try:
            pipe = self._redis.pipeline()
            ops_key = BUFFER_OPS_KEY.format(s3_uri)
            total_bytes = 0
            count = 0

            for row_data in rows_data:
                count += 1
                row_id = row_data.id
                data_dict: Dict[str, Any] = {"id": row_id}
                for key, value in row_data.data.items():
                    data_dict[key] = extract_protobuf_value(value)

                entry = json.dumps(
                    {"op": "insert", "data": data_dict, "ts": _now_ms()},
                    default=lambda o: o.isoformat() if isinstance(o, datetime) else str(o),
                )
                total_bytes += len(entry)
                pipe.hset(ops_key, row_id, entry)

            pipe.sadd(ACTIVE_TABLES_KEY, s3_uri)
            pipe.incrby(BUFFER_SIZE_KEY.format(s3_uri), total_bytes)
            pipe.execute()

            logger.info(f"[WriteBuffer] Buffered {count} inserts for {s3_uri}")
            return True
        except Exception as e:
            logger.warning(f"[WriteBuffer] Failed to buffer creates: {e}")
            return False

    def buffer_updates(self, s3_uri: str, rows_data: Any) -> bool:
        """Buffer update operations. Returns False if Redis unavailable."""
        if not self._redis:
            return False
        try:
            pipe = self._redis.pipeline()
            ops_key = BUFFER_OPS_KEY.format(s3_uri)
            total_bytes = 0
            count = 0

            for row_data in rows_data:
                count += 1
                row_id = row_data.id
                data_dict: Dict[str, Any] = {"id": row_id}
                for key, value in row_data.data.items():
                    data_dict[key] = extract_protobuf_value(value)

                entry = json.dumps(
                    {"op": "update", "data": data_dict, "ts": _now_ms()},
                    default=lambda o: o.isoformat() if isinstance(o, datetime) else str(o),
                )
                total_bytes += len(entry)
                pipe.hset(ops_key, row_id, entry)

            pipe.sadd(ACTIVE_TABLES_KEY, s3_uri)
            pipe.incrby(BUFFER_SIZE_KEY.format(s3_uri), total_bytes)
            pipe.execute()

            logger.info(f"[WriteBuffer] Buffered {count} updates for {s3_uri}")
            return True
        except Exception as e:
            logger.warning(f"[WriteBuffer] Failed to buffer updates: {e}")
            return False

    def buffer_deletes(self, s3_uri: str, row_ids: List[str]) -> bool:
        """Buffer delete operations. Returns False if Redis unavailable."""
        if not self._redis:
            return False
        try:
            pipe = self._redis.pipeline()
            ops_key = BUFFER_OPS_KEY.format(s3_uri)
            total_bytes = 0

            for row_id in row_ids:
                entry = json.dumps({"op": "delete", "data": {"id": row_id}, "ts": _now_ms()})
                total_bytes += len(entry)
                pipe.hset(ops_key, row_id, entry)

            pipe.sadd(ACTIVE_TABLES_KEY, s3_uri)
            pipe.incrby(BUFFER_SIZE_KEY.format(s3_uri), total_bytes)
            pipe.execute()

            logger.info(f"[WriteBuffer] Buffered {len(row_ids)} deletes for {s3_uri}")
            return True
        except Exception as e:
            logger.warning(f"[WriteBuffer] Failed to buffer deletes: {e}")
            return False

    def get_buffered_ops(self, s3_uri: str) -> Dict[str, Dict[str, Any]]:
        """Get all buffered ops for a table. Returns empty dict if Redis unavailable."""
        if not self._redis:
            return {}
        try:
            raw: Dict[str, str] = self._redis.hgetall(BUFFER_OPS_KEY.format(s3_uri))  # type: ignore[assignment]
            return {row_id: json.loads(entry) for row_id, entry in raw.items()}
        except Exception as e:
            logger.warning(f"[WriteBuffer] Failed to get buffered ops: {e}")
            return {}

    def get_buffer_size_bytes(self, s3_uri: str) -> int:
        """Get approximate buffer size in bytes for a table."""
        if not self._redis:
            return 0
        try:
            size: Optional[str] = self._redis.get(BUFFER_SIZE_KEY.format(s3_uri))  # type: ignore[assignment]
            return int(size) if size else 0
        except Exception:
            return 0

    def rotate_for_flush(self, s3_uri: str) -> Dict[str, Dict[str, Any]]:
        """Atomically move :ops -> :flushing, return flushing ops.

        After RENAME, new writes go to a fresh :ops key.
        """
        if not self._redis:
            return {}
        try:
            ops_key = BUFFER_OPS_KEY.format(s3_uri)
            flushing_key = BUFFER_FLUSHING_KEY.format(s3_uri)

            # Atomic rename — new writes will create a fresh ops_key
            self._redis.rename(ops_key, flushing_key)
            # Reset size tracker
            self._redis.delete(BUFFER_SIZE_KEY.format(s3_uri))

            raw: Dict[str, str] = self._redis.hgetall(flushing_key)  # type: ignore[assignment]
            return {row_id: json.loads(entry) for row_id, entry in raw.items()}
        except Exception as e:
            # Key might not exist (empty buffer) — that's fine
            if "no such key" in str(e).lower():
                return {}
            logger.warning(f"[WriteBuffer] Failed to rotate for flush: {e}")
            return {}

    def get_flushing_ops(self, s3_uri: str) -> Dict[str, Dict[str, Any]]:
        """Get ops from a :flushing key (for crash recovery retries)."""
        if not self._redis:
            return {}
        try:
            raw: Dict[str, str] = self._redis.hgetall(BUFFER_FLUSHING_KEY.format(s3_uri))  # type: ignore[assignment]
            return {row_id: json.loads(entry) for row_id, entry in raw.items()}
        except Exception:
            return {}

    def complete_flush(self, s3_uri: str) -> None:
        """Delete :flushing key after successful flush."""
        if not self._redis:
            return
        try:
            self._redis.delete(BUFFER_FLUSHING_KEY.format(s3_uri))
            # Remove from active set if ops key is also empty
            if not self._redis.exists(BUFFER_OPS_KEY.format(s3_uri)):
                self._redis.srem(ACTIVE_TABLES_KEY, s3_uri)
        except Exception as e:
            logger.warning(f"[WriteBuffer] Failed to complete flush cleanup: {e}")

    def get_active_tables(self) -> set[str]:
        """Get all s3_uris with pending buffered ops."""
        if not self._redis:
            return set()
        try:
            result: set[str] = self._redis.smembers(ACTIVE_TABLES_KEY)  # type: ignore[assignment]
            return result
        except Exception:
            return set()

    def get_incomplete_flushes(self) -> List[str]:
        """Find :flushing keys from prior crashes."""
        if not self._redis:
            return []
        try:
            # Scan for flushing keys
            cursor = 0
            flushing_uris = []
            while True:
                cursor, keys = self._redis.scan(cursor, match="buffer:*:flushing", count=100)  # type: ignore[misc]
                for key in keys:
                    # Extract s3_uri from key pattern "buffer:{s3_uri}:flushing"
                    s3_uri = key.removeprefix("buffer:").removesuffix(":flushing")
                    flushing_uris.append(s3_uri)
                if cursor == 0:
                    break
            return flushing_uris
        except Exception as e:
            logger.warning(f"[WriteBuffer] Failed to scan for incomplete flushes: {e}")
            return []


def merge_buffer_into_dataframe(
    df: pl.DataFrame,
    buffered_ops: Dict[str, Dict[str, Any]],
    schema: pa.Schema,
) -> pl.DataFrame:
    """Merge buffered operations into a Delta Lake DataFrame.

    Must be called BEFORE filters, sorting, and pagination so all
    downstream query logic applies to the merged result.

    Args:
        df: DataFrame loaded from Delta Lake
        buffered_ops: Dict of {row_id: {op, data, ts}} from Redis
        schema: PyArrow schema from Delta Lake (for type alignment)

    Returns:
        Merged DataFrame with buffered ops applied
    """
    if not buffered_ops:
        return df

    delete_ids: List[str] = []
    upsert_rows: List[Dict[str, Any]] = []

    for row_id, entry in buffered_ops.items():
        op = entry["op"]
        if op == "delete":
            delete_ids.append(row_id)
        elif op in ("insert", "update"):
            upsert_rows.append(entry["data"])
            if op == "update":
                delete_ids.append(row_id)

    # 1. Remove deleted and updated rows
    if delete_ids:
        df = df.filter(~pl.col("id").is_in(delete_ids))

    # 2. Append inserts and updated rows (schema-aware)
    if upsert_rows:
        polars_schema = {f.name: arrow_to_polars_type(f.type) for f in schema}
        delta_field_names = {f.name for f in schema}
        datetime_cols = {name for name, dtype in polars_schema.items()
                         if isinstance(dtype, (pl.Datetime, pl.Date))}

        # Pre-process: parse ISO date strings back to datetime objects
        cleaned = []
        for row in upsert_rows:
            r = {k: v for k, v in row.items() if k in delta_field_names}
            for col in datetime_cols:
                if col in r and isinstance(r[col], str):
                    try:
                        r[col] = datetime.fromisoformat(r[col])
                    except ValueError:
                        r[col] = None
            cleaned.append(r)

        new_df = pl.DataFrame(cleaned, schema=polars_schema)
        df = pl.concat([df, new_df], how="vertical_relaxed")

    return df


def _now_ms() -> int:
    return int(time.time() * 1000)
