#!/bin/bash
# Start the simple gRPC agent worker server for testing

cd emery-agents

echo "🚀 Starting simple gRPC agent worker server..."
echo "   Port: 50051"
echo "   Organization: test_org"
echo "   Press Ctrl+C to stop"
echo ""

# Start the server
PYTHONPATH=$(pwd)/src uv run python src/emery_agents/grpc/server_simple.py 50051 test_org