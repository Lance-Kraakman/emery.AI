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
    logger.info("Starting gRPC worker server")
    
    # Only log critical environment variables
    hf_token = os.environ.get('HF_TOKEN')
    worker_address = os.environ.get('WORKER_ADDRESS', 'localhost:50051')
    logger.info(f"HF_TOKEN: {'✓ Available' if hf_token else '✗ Missing'}")
    logger.info(f"Worker address: {worker_address}")

    # Extract port from WORKER_ADDRESS
    if ':' in worker_address:
        # Extract port from address like "localhost:50053"
        port = int(worker_address.split(':')[1])
    else:
        port = 50051  # Default port
    
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
