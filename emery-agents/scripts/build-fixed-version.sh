#!/bin/bash

# AIDEV-NOTE: Build fixed version Docker image of emery-agents for testing
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
    echo "Usage: $0 [VERSION] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  VERSION    Version tag for the image (default: auto-generated)"
    echo ""
    echo "Options:"
    echo "  --push     Push image to registry after build"
    echo "  --latest   Also tag as 'latest'"
    echo "  --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build with auto-generated version"
    echo "  $0 v1.2.3            # Build with specific version"
    echo "  $0 v1.2.3 --latest   # Build and tag as latest"
    echo ""
    exit 1
}

generate_version() {
    # Generate version based on current date and git commit
    local date_version=$(date +"%Y.%m.%d")
    local git_short_hash=""
    
    if git rev-parse --git-dir > /dev/null 2>&1; then
        git_short_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    else
        git_short_hash="nogit"
    fi
    
    echo "${date_version}-${git_short_hash}"
}

get_uv_lock_hash() {
    if [ -f "$PROJECT_ROOT/uv.lock" ]; then
        # Get first 8 characters of uv.lock file hash for reproducibility tracking
        shasum -a 256 "$PROJECT_ROOT/uv.lock" | cut -c1-8
    else
        echo "nouv"
    fi
}

build_image() {
    local version="$1"
    local push_flag="$2"
    local latest_flag="$3"
    
    cd "$PROJECT_ROOT"
    
    # Verify uv.lock exists
    if [ ! -f "uv.lock" ]; then
        log_error "uv.lock not found. Run 'uv lock' first to generate fixed versions"
        exit 1
    fi
    
    local uv_hash=$(get_uv_lock_hash)
    local base_image="emery-agents"
    local full_image="${base_image}:${version}"
    
    log_info "Building fixed version Docker image"
    log_info "  Version: ${version}"
    log_info "  UV Lock Hash: ${uv_hash}"
    log_info "  Full Image Tag: ${full_image}"
    echo ""
    
    # Build the image
    log_build "Building Docker image with fixed package versions..."
    docker build \
        -f Dockerfile \
        -t "${full_image}" \
        --build-arg UV_LOCK_HASH="${uv_hash}" \
        --build-arg VERSION="${version}" \
        --label "org.opencontainers.image.version=${version}" \
        --label "org.opencontainers.image.source=emery-agents" \
        --label "org.opencontainers.image.description=Fixed version emery-agents worker" \
        --label "emery.uv-lock-hash=${uv_hash}" \
        --label "emery.build-date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        .
    
    if [ $? -eq 0 ]; then
        log_info "✅ Docker image built successfully: ${full_image}"
    else
        log_error "❌ Docker build failed"
        exit 1
    fi
    
    # Tag as latest if requested
    if [ "$latest_flag" = "true" ]; then
        log_build "Tagging as latest..."
        docker tag "${full_image}" "${base_image}:latest"
        log_info "✅ Tagged as ${base_image}:latest"
    fi
    
    # Show image details
    echo ""
    log_info "Image Details:"
    docker images "${base_image}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    echo ""
    log_info "Image Labels:"
    docker inspect "${full_image}" --format '{{range $k, $v := .Config.Labels}}{{$k}}: {{$v}}{{"\n"}}{{end}}' | grep -E "(emery\.|org\.opencontainers)"
    
    # Push if requested
    if [ "$push_flag" = "true" ]; then
        log_build "Pushing to registry..."
        docker push "${full_image}"
        if [ "$latest_flag" = "true" ]; then
            docker push "${base_image}:latest"
        fi
        log_info "✅ Image pushed to registry"
    fi
    
    echo ""
    log_info "🎉 Fixed version image ready for testing!"
    log_info "Use in docker-compose.test.yml:"
    log_info "  services:"
    log_info "    agent-worker:"
    log_info "      image: ${full_image}"
    echo ""
    log_info "Test the image:"
    log_info "  docker run --rm -p 50051:50051 ${full_image}"
}

# Parse arguments
VERSION=""
PUSH_FLAG="false"
LATEST_FLAG="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH_FLAG="true"
            shift
            ;;
        --latest)
            LATEST_FLAG="true"
            shift
            ;;
        --help)
            usage
            ;;
        -*)
            log_error "Unknown option $1"
            usage
            ;;
        *)
            if [ -z "$VERSION" ]; then
                VERSION="$1"
            else
                log_error "Multiple version arguments provided"
                usage
            fi
            shift
            ;;
    esac
done

# Generate version if not provided
if [ -z "$VERSION" ]; then
    VERSION=$(generate_version)
    log_info "Auto-generated version: $VERSION"
fi

# Validate version format
if ! [[ "$VERSION" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
    log_error "Invalid version format: $VERSION"
    log_error "Version must start with alphanumeric and contain only alphanumeric, dots, underscores, and hyphens"
    exit 1
fi

# Build the image
build_image "$VERSION" "$PUSH_FLAG" "$LATEST_FLAG"