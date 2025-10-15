# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /usr/src/app

# Build arguments for version tracking
ARG UV_LOCK_HASH=""
ARG VERSION=""

# Install uv for faster Python package installation (pinned version)
RUN pip install uv==0.5.30

# Copy dependency files for layer caching
COPY ./pyproject.toml ./uv.lock ./README.md ./

# AIDEV-NOTE: Install dependencies with uv for exact reproducibility
# This ensures package versions are properly resolved
RUN uv pip install . --system

# Add metadata labels
LABEL org.opencontainers.image.version="${VERSION}"
LABEL emery.uv-lock-hash="${UV_LOCK_HASH}"
LABEL emery.uv-version="0.5.30"

# Copy the application code
COPY ./src ./src

# Set environment variables
ENV PYTHONPATH=/usr/src/app/src
ENV WORKER_ADDRESS=50051
ENV ORGANIZATION_ID=default

# The port your gRPC server listens on
EXPOSE 50051

# AIDEV-NOTE: Health checks are managed by ECS/CDK, not Dockerfile
# Removed HEALTHCHECK to avoid conflicts with ECS container health checks

# Command to run the gRPC server
CMD ["python", "-m", "emery_agents.infrastructure.grpc.main"]
