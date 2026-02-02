"""
Background Flush Worker for Delta Lake Write Buffer

Runs as a daemon thread, periodically flushing buffered writes
to Delta Lake. Uses RENAME for atomic buffer rotation so new
writes are never blocked during a flush.

Flush triggers (whichever comes first):
  - Time: 60s since last flush per table (BUFFER_FLUSH_INTERVAL_SECONDS)
  - Size: Buffer exceeds threshold per table (BUFFER_FLUSH_SIZE_MB)
"""

import logging
import os
import threading
import time
from typing import Callable, Dict, List, Any

import pyarrow as pa
import polars as pl
from deltalake import DeltaTable

from .write_buffer import WriteBuffer
from .operations import write_with_schema_evolution, write_with_merge_operation
from .delta_cache import invalidate_delta_cache, get_delta_table_cached
from .schema import get_delta_schema_as_pyarrow, arrow_to_polars_type
from .transform import convert_dataframe_to_arrow

logger = logging.getLogger(__name__)


class FlushWorker:
    """Background thread that periodically flushes write buffer to Delta Lake."""

    def __init__(
        self,
        write_buffer: WriteBuffer,
        storage_options_fn: Callable[[], Dict[str, str]],
        flush_interval: int = 60,
        flush_size_mb: float = 5.0,
        poll_interval: int = 5,
    ) -> None:
        self._buffer = write_buffer
        self._get_storage_options = storage_options_fn
        self._flush_interval = flush_interval
        self._flush_size_bytes = int(flush_size_mb * 1024 * 1024)
        self._poll_interval = poll_interval
        self._running = False
        self._thread: threading.Thread | None = None
        self._last_flush: Dict[str, float] = {}

    def start(self) -> None:
        if not self._buffer.enabled:
            logger.info("[FlushWorker] Write buffer disabled (no Redis), skipping start")
            return

        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="flush-worker")
        self._thread.start()
        logger.info(
            f"[FlushWorker] Started (poll={self._poll_interval}s, "
            f"flush_interval={self._flush_interval}s, "
            f"flush_size={self._flush_size_bytes / 1024 / 1024:.1f}MB)"
        )

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
            logger.info("[FlushWorker] Stopped")

    def _run_loop(self) -> None:
        # On startup, retry any incomplete flushes from prior crash
        self._retry_incomplete_flushes()

        while self._running:
            try:
                self._check_and_flush()
            except Exception as e:
                logger.error(f"[FlushWorker] Flush cycle error: {e}", exc_info=True)

            time.sleep(self._poll_interval)

    def _retry_incomplete_flushes(self) -> None:
        """Retry any :flushing keys left from a prior crash."""
        incomplete = self._buffer.get_incomplete_flushes()
        for s3_uri in incomplete:
            logger.info(f"[FlushWorker] Retrying incomplete flush for {s3_uri}")
            ops = self._buffer.get_flushing_ops(s3_uri)
            if ops:
                self._flush_ops(s3_uri, ops)
                self._buffer.complete_flush(s3_uri)

    def _check_and_flush(self) -> None:
        """Check each active table against time and size thresholds."""
        active_tables = self._buffer.get_active_tables()

        for s3_uri in active_tables:
            now = time.time()
            last = self._last_flush.get(s3_uri, 0)
            time_elapsed = now - last
            buffer_size = self._buffer.get_buffer_size_bytes(s3_uri)

            should_flush = (
                time_elapsed >= self._flush_interval
                or buffer_size >= self._flush_size_bytes
            )

            if not should_flush:
                continue

            ops = self._buffer.rotate_for_flush(s3_uri)
            if not ops:
                continue

            reason = "time" if time_elapsed >= self._flush_interval else f"size ({buffer_size / 1024:.1f}KB)"
            logger.info(f"[FlushWorker] Flushing {s3_uri} ({len(ops)} ops, trigger={reason})")

            try:
                self._flush_ops(s3_uri, ops)
                self._buffer.complete_flush(s3_uri)
                self._last_flush[s3_uri] = time.time()
            except Exception as e:
                logger.error(f"[FlushWorker] Failed to flush {s3_uri}: {e}", exc_info=True)
                # :flushing key preserved for retry on next cycle

    def _flush_ops(self, s3_uri: str, ops: Dict[str, Dict[str, Any]]) -> None:
        """Flush buffered operations to Delta Lake."""
        storage_options = self._get_storage_options()

        # Partition operations
        inserts: List[Dict[str, Any]] = []
        updates: List[Dict[str, Any]] = []
        delete_ids: List[str] = []

        for row_id, entry in ops.items():
            op = entry["op"]
            if op == "insert":
                inserts.append(entry["data"])
            elif op == "update":
                updates.append(entry["data"])
            elif op == "delete":
                delete_ids.append(row_id)

        # Get Delta table for schema
        delta_table = get_delta_table_cached(s3_uri, storage_options)

        # Batch inserts
        if inserts:
            arrow_table = _rows_to_arrow(inserts, delta_table)
            write_with_schema_evolution(s3_uri, arrow_table, "append", storage_options)
            logger.info(f"[FlushWorker] Flushed {len(inserts)} inserts to {s3_uri}")

        # Batch updates (merge)
        if updates:
            arrow_table = _rows_to_arrow(updates, delta_table)
            write_with_merge_operation(s3_uri, arrow_table, storage_options)
            logger.info(f"[FlushWorker] Flushed {len(updates)} updates to {s3_uri}")

        # Batch deletes
        if delete_ids:
            escaped_ids = [rid.replace("'", "''") for rid in delete_ids]
            row_ids_str = "', '".join(escaped_ids)
            predicate = f"id IN ('{row_ids_str}')"
            dt = DeltaTable(s3_uri, storage_options=storage_options)
            dt.delete(predicate)
            logger.info(f"[FlushWorker] Flushed {len(delete_ids)} deletes to {s3_uri}")

        # Invalidate delta cache so next read sees fresh data
        invalidate_delta_cache(s3_uri)


def _rows_to_arrow(rows: List[Dict[str, Any]], delta_table: DeltaTable) -> pa.Table:
    """Convert buffered row dicts to a PyArrow table aligned to Delta Lake schema."""
    schema = get_delta_schema_as_pyarrow(delta_table)

    # Build Polars schema from Delta Lake schema
    polars_schema: Dict[str, Any] = {}
    for field in schema:
        polars_schema[field.name] = arrow_to_polars_type(field.type)

    # Only include columns that exist in the Delta schema
    delta_field_names = {f.name for f in schema}
    cleaned_rows = []
    for row in rows:
        cleaned = {k: v for k, v in row.items() if k in delta_field_names}
        cleaned_rows.append(cleaned)

    df = pl.DataFrame(cleaned_rows, schema=polars_schema)
    arrow_table = convert_dataframe_to_arrow(df, normalize_strings=True)
    return arrow_table
