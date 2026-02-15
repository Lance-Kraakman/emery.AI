"""Type definitions for the graph service."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def validate_identifier(name: str) -> str:
    """Validate and return a SQL-safe identifier.

    Args:
        name: The identifier to validate

    Returns:
        The validated identifier

    Raises:
        ValueError: If the identifier contains invalid characters
    """
    if not _IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return name


@dataclass(frozen=True, slots=True)
class S3Config:
    """S3/MinIO configuration for Delta Lake access."""

    access_key: str
    secret_key: str
    endpoint: str = ""
    region: str = "us-east-1"

    @classmethod
    def from_env(cls) -> S3Config:
        """Create S3Config from environment variables.

        Required env vars:
            AWS_ACCESS_KEY_ID
            AWS_SECRET_ACCESS_KEY

        Optional env vars:
            AWS_ENDPOINT_URL (for MinIO)
            AWS_REGION (default: us-east-1)
        """
        return cls(
            access_key=os.environ["AWS_ACCESS_KEY_ID"],
            secret_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            endpoint=os.environ.get("AWS_ENDPOINT_URL", ""),
            region=os.environ.get("AWS_REGION", "us-east-1"),
        )


@dataclass(frozen=True, slots=True)
class DeltaTableRef:
    """Reference to a Delta Lake table with S3 location."""

    table_id: str
    s3_path: str

    def __post_init__(self) -> None:
        if not self.s3_path.startswith("s3://"):
            raise ValueError(f"s3_path must start with s3://, got: {self.s3_path!r}")


@dataclass(frozen=True, slots=True)
class EdgeDef:
    """Edge definition between two tables (from FIELD_TYPE_RELATION)."""

    source_table: str
    target_table: str
    source_key: str
    target_key: str = "id"
