# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /usr/src/app

# Install uv for faster Python package installation
RUN pip install uv

# Copy dependency files for layer caching
COPY ./pyproject.toml ./uv.lock ./README.md ./

# Install dependencies using uv
RUN uv pip install . --system

# Copy the application code
COPY ./src ./src

# Set environment variables
ENV PYTHONPATH=/usr/src/app/src
ENV WORKER_PORT=50051
ENV ORGANIZATION_ID=default

# The port your gRPC server listens on
EXPOSE 50051

# Health check to ensure the service is running
# AIDEV-NOTE: Extended timeouts for AWS ECS deployment stability
HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=5 \
  CMD python -c "import socket; s=socket.socket(); s.settimeout(10); s.connect(('0.0.0.0', 50051)); s.close()" || exit 1

# Command to run the gRPC server
CMD ["python", "-m", "emery_agents.grpc.main"]
