#!/bin/bash

# AIDEV-NOTE: Test container management script for fixed-version testing
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    echo "Usage: $0 {start|stop|restart|logs|test|build}"
    echo ""
    echo "Commands:"
    echo "  start    - Start the test container with fixed package versions"
    echo "  stop     - Stop the test container"
    echo "  restart  - Restart the test container"
    echo "  logs     - Show container logs"
    echo "  test     - Run integration tests against the container"
    echo "  build    - Build the test container with latest uv.lock"
    echo ""
    exit 1
}

build_test_container() {
    log_info "Building test container with fixed package versions from uv.lock..."
    cd "$PROJECT_ROOT"
    
    # Ensure uv.lock is up to date
    if [ -f "uv.lock" ]; then
        log_info "Using existing uv.lock ($(stat -f%Sm -t%Y-%m-%d uv.lock) last modified)"
    else
        log_warn "No uv.lock found, generating..."
        uv lock
    fi
    
    docker-compose -f docker-compose.test.yml build emery-agent-worker-test
    log_info "Test container built successfully with fixed versions"
}

start_container() {
    log_info "Starting test container..."
    cd "$PROJECT_ROOT"
    
    # Check if container is already running
    if docker-compose -f docker-compose.test.yml ps | grep -q "Up"; then
        log_warn "Test container already running"
        return 0
    fi
    
    # Export HF_TOKEN if available
    if [ -n "$HF_TOKEN" ]; then
        export HF_TOKEN
        log_info "Using HF_TOKEN from environment"
    else
        log_warn "No HF_TOKEN set - AI model tests may fail"
    fi
    
    docker-compose -f docker-compose.test.yml up -d emery-agent-worker-test
    
    # Wait for container to be healthy
    log_info "Waiting for container to be ready..."
    timeout=60
    counter=0
    while [ $counter -lt $timeout ]; do
        if docker-compose -f docker-compose.test.yml exec -T emery-agent-worker-test python -c "import grpc; from emery_agents.grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc; channel = grpc.insecure_channel('localhost:50051'); stub = agent_worker_pb2_grpc.AgentWorkerStub(channel); stub.GetWorkerInfo(agent_worker_pb2.Empty(), timeout=5)" &>/dev/null; then
            log_info "Container is ready and accepting gRPC connections"
            return 0
        fi
        counter=$((counter + 5))
        sleep 5
        echo -n "."
    done
    echo ""
    log_error "Container failed to start within $timeout seconds"
    docker-compose -f docker-compose.test.yml logs emery-agent-worker-test
    exit 1
}

stop_container() {
    log_info "Stopping test container..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.test.yml down
    log_info "Test container stopped"
}

show_logs() {
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.test.yml logs -f emery-agent-worker-test
}

run_tests() {
    log_info "Running integration tests against test container..."
    cd "$PROJECT_ROOT"
    
    # Ensure container is running
    if ! docker-compose -f docker-compose.test.yml ps | grep -q "Up"; then
        log_info "Starting container for testing..."
        start_container
    fi
    
    # Run tests inside container
    log_info "Executing tests..."
    docker-compose -f docker-compose.test.yml exec -T emery-agent-worker-test uv run pytest tests/ -v -m "integration or grpc" --tb=short
    
    # Also run a quick gRPC connectivity test
    log_info "Testing gRPC connectivity..."
    docker-compose -f docker-compose.test.yml exec -T emery-agent-worker-test python -c "
import grpc
import sys
from emery_agents.grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc

try:
    channel = grpc.insecure_channel('localhost:50051')
    stub = agent_worker_pb2_grpc.AgentWorkerStub(channel)
    response = stub.GetWorkerInfo(agent_worker_pb2.Empty(), timeout=10)
    print(f'✅ gRPC connection successful - Worker ID: {response.worker_id}, Status: {response.status}')
    sys.exit(0)
except Exception as e:
    print(f'❌ gRPC connection failed: {e}')
    sys.exit(1)
"
}

# Main script logic
case "${1:-}" in
    start)
        start_container
        ;;
    stop)
        stop_container
        ;;
    restart)
        stop_container
        start_container
        ;;
    logs)
        show_logs
        ;;
    test)
        run_tests
        ;;
    build)
        build_test_container
        ;;
    *)
        usage
        ;;
esac