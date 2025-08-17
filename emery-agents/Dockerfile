# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /usr/src/app

# Install uv for faster Python package installation
RUN pip install uv

# Copy dependency files for layer caching
COPY ./pyproject.toml ./uv.lock ./README.md ./

# AIDEV-NOTE: Use Docker cache mount for uv cache to significantly speed up installs
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install . --system

# Copy the application code
COPY ./src ./src

# Set environment variables
ENV PYTHONPATH=/usr/src/app/src
ENV WORKER_PORT=50051
ENV ORGANIZATION_ID=default

# The port your gRPC server listens on
EXPOSE 50051

# AIDEV-NOTE: Health checks are managed by ECS/CDK, not Dockerfile
# Removed HEALTHCHECK to avoid conflicts with ECS container health checks

# Command to run the gRPC server
CMD ["python", "-m", "emery_agents.grpc.main"]
