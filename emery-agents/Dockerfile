# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /usr/src/app

# Build arguments for version tracking
ARG UV_LOCK_HASH=""
ARG VERSION=""

# Install system dependencies for sandboxed execution
# jq: JSON processing for agents
# curl: HTTP requests (when network enabled)
# git: Version control operations
# tree: Directory visualization
# socat: Unix socket to TCP bridge for sandbox network proxy
# iproute2: Loopback interface setup inside sandbox (ip link set lo up)
# gnupg: Required for gVisor apt repository
RUN apt-get update && apt-get install -y --no-install-recommends \
    jq \
    curl \
    git \
    tree \
    socat \
    iproute2 \
    procps \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install gVisor (runsc) for stronger kernel isolation
# Uses ptrace platform which works on Fargate (no KVM required)
# gVisor intercepts ALL syscalls via its Sentry user-space kernel
RUN curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" > /etc/apt/sources.list.d/gvisor.list && \
    apt-get update && apt-get install -y runsc && \
    rm -rf /var/lib/apt/lists/*

# Install uv for faster Python package installation (pinned version)
RUN pip install uv==0.5.30

# Copy dependency files for layer caching
COPY ./pyproject.toml ./uv.lock ./README.md ./

# AIDEV-NOTE: Install dependencies with uv for exact reproducibility
# Uses BuildKit cache mount for pip cache - run with DOCKER_BUILDKIT=1
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install . --system

# Pre-download models for memory features (avoids first-run delay)
# spaCy model for Presidio PII detection
RUN python -m spacy download en_core_web_sm

# Add metadata labels
LABEL org.opencontainers.image.version="${VERSION}"
LABEL emery.uv-lock-hash="${UV_LOCK_HASH}"
LABEL emery.uv-version="0.5.30"

# Copy the application code
COPY ./src ./src

# Copy diagnostic scripts
COPY ./scripts/diag.sh /usr/local/bin/diag
COPY ./scripts/sandbox-pentest.sh /usr/local/bin/sandbox-pentest
COPY ./scripts/run-sandbox-pentest.py /usr/local/bin/run-sandbox-pentest
RUN chmod +x /usr/local/bin/diag /usr/local/bin/sandbox-pentest /usr/local/bin/run-sandbox-pentest

# Install battle-tested container security testing tools
# amicontained: https://github.com/genuinetools/amicontained
# deepce: https://github.com/stealthcopter/deepce
# botb: https://github.com/brompwnie/botb
RUN curl -sLo /usr/local/bin/amicontained https://github.com/genuinetools/amicontained/releases/download/v0.4.9/amicontained-linux-amd64 && \
    chmod +x /usr/local/bin/amicontained && \
    curl -sLo /usr/local/bin/deepce https://raw.githubusercontent.com/stealthcopter/deepce/main/deepce.sh && \
    chmod +x /usr/local/bin/deepce && \
    curl -sLo /usr/local/bin/botb https://github.com/brompwnie/botb/releases/download/1.8.0/botb-linux-amd64 && \
    chmod +x /usr/local/bin/botb

# Set environment variables
ENV PYTHONPATH=/usr/src/app/src
ENV WORKER_ADDRESS=50051

# The port your gRPC server listens on
EXPOSE 50051

# AIDEV-NOTE: Health checks are managed by ECS/CDK, not Dockerfile
# Removed HEALTHCHECK to avoid conflicts with ECS container health checks

# Command to run the gRPC server
CMD ["python", "-m", "emery_agents.grpc.server", "--mode=chat", "--port=50051"]
