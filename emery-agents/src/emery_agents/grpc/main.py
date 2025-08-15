import logging
import asyncio
import os
import sys

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from .server import serve

def main():
    """
    Entry point for the production gRPC worker server.
    """
    print("PYTHON WORKER: Starting main() function")
    logger.info("PYTHON WORKER: Starting main() function")
    logger.info("--- Environment Variables ---")
    for key, value in os.environ.items():
        logger.info(f"{key}: {value}")
    logger.info("---------------------------")
    print("PYTHON WORKER: Environment variables logged")

    port = int(os.environ.get('WORKER_PORT', '50051'))
    organization_id = os.environ.get('ORGANIZATION_ID', 'default')
    
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    if len(sys.argv) > 2:
        organization_id = sys.argv[2]
    
    try:
        asyncio.run(serve(port, organization_id))
    except KeyboardInterrupt:
        logger.info("Worker shutdown by user")
    except Exception as e:
        logger.error(f"Worker failed to start: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
