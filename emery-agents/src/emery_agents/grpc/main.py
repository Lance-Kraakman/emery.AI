"""
Main entry point for emery-agents gRPC worker.

Simplified architecture - direct server startup without DDD overhead.
"""

import asyncio
import os
import sys
from .server import serve


def main():
    """Main entry point for gRPC server."""
    # Get configuration from environment
    port = int(os.getenv("WORKER_PORT", "50051"))
    organization_id = os.getenv("ORGANIZATION_ID", "default")

    # Verify required environment variables
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        print("❌ ERROR: HF_TOKEN environment variable is required", file=sys.stderr)
        sys.exit(1)

    print(f"🚀 Starting emery-agents gRPC worker")
    print(f"   Port: {port}")
    print(f"   Organization: {organization_id}")
    print(f"   HF_TOKEN: {'✅ Set' if hf_token else '❌ Missing'}")

    # Run the gRPC server
    try:
        asyncio.run(serve(port, organization_id))
    except KeyboardInterrupt:
        print("\n👋 Shutting down gracefully...")
    except Exception as e:
        print(f"❌ Server error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
