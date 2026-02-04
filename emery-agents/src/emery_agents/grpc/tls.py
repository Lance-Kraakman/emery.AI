"""
gRPC TLS credential loader for Python servers.

Loads mTLS certificates from environment variables for secure
server-side gRPC communication.

Env vars:
- GRPC_CA_CERT: PEM-encoded CA certificate (for client cert verification)
- GRPC_SERVER_CERT: PEM-encoded server certificate
- GRPC_SERVER_KEY: PEM-encoded server private key

Behavior:
- Production: requires all 3 env vars, raises on missing
- Development: returns None (caller uses insecure port)
- Partial config (some set, some not): always raises
"""

import os
import logging
from typing import Optional

import grpc

logger = logging.getLogger(__name__)


def get_server_credentials() -> Optional[grpc.ServerCredentials]:
    """
    Load mTLS server credentials from environment variables.

    Returns ServerCredentials for secure port, or None in development
    when no certs are configured (caller should fall back to insecure port).
    """
    ca_cert = os.getenv("GRPC_CA_CERT")
    server_cert = os.getenv("GRPC_SERVER_CERT")
    server_key = os.getenv("GRPC_SERVER_KEY")

    is_dev = os.getenv("NODE_ENV", "") == "development" or os.getenv(
        "ENVIRONMENT", ""
    ) == "development"

    # No certs configured
    if not ca_cert and not server_cert and not server_key:
        if is_dev:
            logger.warning(
                "No gRPC TLS certs configured. Running INSECURE (development only)."
            )
            return None
        raise RuntimeError(
            "gRPC TLS credentials required in production. "
            "Set GRPC_CA_CERT, GRPC_SERVER_CERT, GRPC_SERVER_KEY env vars."
        )

    # Partial config is always an error
    if not ca_cert or not server_cert or not server_key:
        raise RuntimeError(
            "Incomplete gRPC TLS config. All three required: "
            "GRPC_CA_CERT, GRPC_SERVER_CERT, GRPC_SERVER_KEY"
        )

    server_credentials = grpc.ssl_server_credentials(
        private_key_certificate_chain_pairs=[
            (
                server_key.encode("utf-8"),
                server_cert.encode("utf-8"),
            )
        ],
        root_certificates=ca_cert.encode("utf-8"),
        require_client_auth=True,
    )

    logger.info("gRPC server configured with mTLS credentials")
    return server_credentials
