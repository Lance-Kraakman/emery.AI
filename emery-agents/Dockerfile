# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /usr/src/app

# Build arguments for version tracking
ARG UV_LOCK_HASH=""
ARG VERSION=""

# Install system dependencies for sandboxed execution
# bubblewrap: Filesystem namespace isolation for secure command execution
# jq: JSON processing for agents
# curl: HTTP requests (when network enabled)
# git: Version control operations
# tree: Directory visualization
# socat: Unix socket to TCP bridge for sandbox network proxy
# iproute2: Loopback interface setup inside sandbox (ip link set lo up)
# libseccomp-dev: Required for seccomp Python bindings (syscall filtering)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bubblewrap \
    jq \
    curl \
    git \
    tree \
    socat \
    iproute2 \
    libseccomp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for faster Python package installation (pinned version)
RUN pip install uv==0.5.30

# Copy dependency files for layer caching
COPY ./pyproject.toml ./uv.lock ./README.md ./

# AIDEV-NOTE: Install dependencies with uv for exact reproducibility
# This ensures package versions are properly resolved
RUN uv pip install . --system

# Pre-download models for memory features (avoids first-run delay)
# spaCy model for Presidio PII detection
RUN python -m spacy download en_core_web_sm

# Add metadata labels
LABEL org.opencontainers.image.version="${VERSION}"
LABEL emery.uv-lock-hash="${UV_LOCK_HASH}"
LABEL emery.uv-version="0.5.30"

# Copy the application code
COPY ./src ./src

# Set environment variables
ENV PYTHONPATH=/usr/src/app/src
ENV WORKER_ADDRESS=50051

# The port your gRPC server listens on
EXPOSE 50051

# AIDEV-NOTE: Health checks are managed by ECS/CDK, not Dockerfile
# Removed HEALTHCHECK to avoid conflicts with ECS container health checks

# Command to run the gRPC server
CMD ["python", "-m", "emery_agents.grpc.server", "--mode=chat", "--port=50051"]
