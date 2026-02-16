"""
Delta Lake S3 Path Utilities - Single source of truth for Delta table paths.

Environment Variables:
    S3_BUCKET_NAME: S3 bucket for Delta tables (default: enhancd-files)

Path Format:
    s3://{bucket}/org_{org_id}/db_{db_id}/table_{table_id}/
"""

from __future__ import annotations

import os


def get_delta_bucket() -> str:
    """Get the S3 bucket name for Delta Lake tables."""
    return os.environ.get("S3_BUCKET_NAME", "enhancd-files")


def build_table_s3_path(
    org_id: int | str,
    database_id: int | str,
    table_id: int | str,
    bucket: str | None = None,
) -> str:
    """Build full S3 path for a Delta Lake table.

    Args:
        org_id: Organization ID
        database_id: Database ID
        table_id: Table ID
        bucket: Optional bucket override (defaults to S3_BUCKET_NAME env var)

    Returns:
        Full S3 URI like 's3://enhancd-files/org_1/db_5/table_66/'
    """
    bucket = bucket or get_delta_bucket()
    return f"s3://{bucket}/org_{org_id}/db_{database_id}/table_{table_id}/"


def build_table_relative_path(
    org_id: int | str,
    database_id: int | str,
    table_id: int | str,
) -> str:
    """Build relative path for a Delta Lake table (without bucket).

    Args:
        org_id: Organization ID
        database_id: Database ID
        table_id: Table ID

    Returns:
        Relative path like 'org_1/db_5/table_66/'
    """
    return f"org_{org_id}/db_{database_id}/table_{table_id}/"
