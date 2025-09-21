#!/bin/bash

# AIDEV-NOTE: Test environment management using fixed version agent worker
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_build() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

usage() {
    echo "Usage: $0 {build|start|stop|restart|logs|test|clean} [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build        Build the fixed version agent worker image"
    echo "  start        Start the test environment"
    echo "  stop         Stop the test environment" 
    echo "  restart      Restart the test environment"
    echo "  logs         Show logs from test services"
    echo "  test         Run integration tests against test environment"
    echo "  clean        Clean up test environment and images"
    echo ""
    echo "Options:"
    echo "  --version VER     Use specific agent worker version (default: latest)"
    echo "  --full-integration Start frontend service for full integration testing"
    echo "  --build-args      Pass additional build arguments"
    echo ""
    echo "Examples:"
    echo "  $0 build                           # Build latest version"
    echo "  $0 build --version v1.2.3         # Build specific version"
    echo "  $0 start                           # Start with latest image"
    echo "  $0 start --version 2025.01.02     # Start with specific version"
    echo "  $0 start --full-integration        # Start with frontend included"
    echo "  $0 test                            # Run integration tests"
    echo ""
    exit 1
}

build_agent_worker() {
    local version="$1"
    local build_args="$2"
    
    log_info "Building fixed version agent worker..."
    
    cd "$PROJECT_ROOT/emery-agents"
    
    # Check if build script exists
    if [ ! -f "scripts/build-fixed-version.sh" ]; then
        log_error "Build script not found: scripts/build-fixed-version.sh"
        exit 1
    fi
    
    # Build the fixed version image
    if [ -n "$version" ]; then
        ./scripts/build-fixed-version.sh "$version" --latest $build_args
    else
        ./scripts/build-fixed-version.sh --latest $build_args
    fi
    
    log_info "✅ Agent worker image built successfully"
}

start_test_env() {
    local version="$1"
    local full_integration="$2"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables
    export TEST_ORGANIZATION_ID="test-org-$(date +%s)"
    
    if [ -n "$version" ]; then
        export AGENT_WORKER_VERSION="$version"
        log_info "Using agent worker version: $version"
    else
        export AGENT_WORKER_VERSION="latest"
        log_info "Using agent worker version: latest"
    fi
    
    # Check if image exists
    if ! docker images "emery-agents:$AGENT_WORKER_VERSION" | grep -q "$AGENT_WORKER_VERSION"; then
        log_warn "Agent worker image emery-agents:$AGENT_WORKER_VERSION not found"
        log_info "Building image first..."
        build_agent_worker "$version"
    fi
    
    log_info "Starting test environment..."
    log_info "  Agent Worker Version: $AGENT_WORKER_VERSION"
    log_info "  Organization ID: $TEST_ORGANIZATION_ID"
    
    # Export HF_TOKEN if available
    if [ -n "$HF_TOKEN" ]; then
        export HF_TOKEN
        log_info "  Using HF_TOKEN for AI model tests"
    else
        log_warn "  No HF_TOKEN set - AI model tests may fail"
    fi
    
    # Start services
    if [ "$full_integration" = "true" ]; then
        log_info "Starting with full integration (including frontend)..."
        docker-compose -f docker-compose.test.yml --profile full-integration up -d
    else
        log_info "Starting core test services (db + agent worker)..."
        docker-compose -f docker-compose.test.yml up -d test-db test-agent-worker test-minio
    fi
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    
    # Wait for database
    echo -n "Database"
    timeout=60
    counter=0
    while [ $counter -lt $timeout ]; do
        if docker-compose -f docker-compose.test.yml exec -T test-db pg_isready -U postgres -d emery_test &>/dev/null; then
            break
        fi
        counter=$((counter + 2))
        sleep 2
        echo -n "."
    done
    echo " ✅"
    
    # Wait for agent worker
    echo -n "Agent Worker"
    counter=0
    while [ $counter -lt $timeout ]; do
        if docker-compose -f docker-compose.test.yml exec -T test-agent-worker python -c "
import grpc
from emery_agents.grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc
channel = grpc.insecure_channel('localhost:50051')
stub = agent_worker_pb2_grpc.AgentWorkerStub(channel)
stub.GetWorkerInfo(agent_worker_pb2.Empty(), timeout=5)
" &>/dev/null; then
            break
        fi
        counter=$((counter + 2))
        sleep 2
        echo -n "."
    done
    echo " ✅"
    
    log_info "🎉 Test environment is ready!"
    log_info ""
    log_info "Services:"
    log_info "  Database:      localhost:5434"
    log_info "  Agent Worker:  localhost:50051" 
    log_info "  MinIO:         localhost:9002"
    if [ "$full_integration" = "true" ]; then
        log_info "  Frontend:      localhost:3001"
    fi
    log_info ""
    log_info "Run tests with: $0 test"
}

stop_test_env() {
    cd "$PROJECT_ROOT"
    log_info "Stopping test environment..."
    docker-compose -f docker-compose.test.yml down
    log_info "✅ Test environment stopped"
}

show_logs() {
    local service="$1"
    cd "$PROJECT_ROOT"
    
    if [ -n "$service" ]; then
        docker-compose -f docker-compose.test.yml logs -f "$service"
    else
        docker-compose -f docker-compose.test.yml logs -f
    fi
}

run_tests() {
    cd "$PROJECT_ROOT"
    
    # Check if services are running
    if ! docker-compose -f docker-compose.test.yml ps | grep -q "Up"; then
        log_info "Test environment not running, starting it..."
        start_test_env
    fi
    
    log_info "Running integration tests..."
    
    # Test 1: Agent worker gRPC connectivity
    log_info "🔧 Testing gRPC connectivity..."
    if npx tsx scripts/test-grpc-integration.ts; then
        log_info "✅ gRPC integration test passed"
    else
        log_error "❌ gRPC integration test failed"
        return 1
    fi
    
    # Test 2: Worker health check
    log_info "🔧 Testing worker health..."
    docker-compose -f docker-compose.test.yml exec -T test-agent-worker python -c "
import grpc
from emery_agents.grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = agent_worker_pb2_grpc.AgentWorkerStub(channel)
response = stub.GetWorkerInfo(agent_worker_pb2.Empty(), timeout=10)
print(f'✅ Worker Health Check Passed:')
print(f'   Worker ID: {response.worker_id}')
print(f'   Version: {response.version}')  
print(f'   Status: {response.status}')
print(f'   Active Tasks: {response.active_tasks}/{response.max_concurrent_tasks}')
print(f'   Capabilities: {len(response.capabilities)}')
"
    
    # Test 3: Database connectivity
    log_info "🔧 Testing database connectivity..."
    if docker-compose -f docker-compose.test.yml exec -T test-db psql -U postgres -d emery_test -c "SELECT version();" &>/dev/null; then
        log_info "✅ Database connectivity test passed"
    else
        log_error "❌ Database connectivity test failed"
        return 1
    fi
    
    log_info "🎉 All integration tests passed!"
}

clean_test_env() {
    cd "$PROJECT_ROOT"
    log_info "Cleaning up test environment..."
    
    # Stop and remove containers
    docker-compose -f docker-compose.test.yml down -v
    
    # Remove test images (optional)
    read -p "Remove agent worker test images? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker images "emery-agents" --format "{{.Repository}}:{{.Tag}}" | xargs -r docker rmi
        log_info "✅ Test images removed"
    fi
    
    log_info "✅ Test environment cleaned up"
}

# Parse arguments
COMMAND=""
VERSION=""
FULL_INTEGRATION="false"
BUILD_ARGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        build|start|stop|restart|logs|test|clean)
            if [ -z "$COMMAND" ]; then
                COMMAND="$1"
            else
                log_error "Multiple commands provided"
                usage
            fi
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --full-integration)
            FULL_INTEGRATION="true"
            shift
            ;;
        --build-args)
            BUILD_ARGS="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        -*)
            log_error "Unknown option $1"
            usage
            ;;
        *)
            log_error "Unknown argument $1"
            usage
            ;;
    esac
done

if [ -z "$COMMAND" ]; then
    usage
fi

# Execute command
case "$COMMAND" in
    build)
        build_agent_worker "$VERSION" "$BUILD_ARGS"
        ;;
    start)
        start_test_env "$VERSION" "$FULL_INTEGRATION"
        ;;
    stop)
        stop_test_env
        ;;
    restart)
        stop_test_env
        start_test_env "$VERSION" "$FULL_INTEGRATION"
        ;;
    logs)
        show_logs
        ;;
    test)
        run_tests
        ;;
    clean)
        clean_test_env
        ;;
esac