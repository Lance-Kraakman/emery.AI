# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /usr/src/app

# Install uv for faster Python package installation
RUN pip install uv

# Copy dependency files for layer caching
COPY ./pyproject.toml ./uv.lock ./README.md ./

# Install dependencies using uv
RUN uv sync --frozen --no-dev

# Copy the application code
COPY ./src ./src

# Set environment variables
ENV PYTHONPATH=/usr/src/app/src
ENV WORKER_PORT=50051
ENV ORGANIZATION_ID=default

# The port your gRPC server listens on
EXPOSE 50051

# Health check to ensure the service is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import grpc; channel = grpc.insecure_channel('localhost:50051'); channel.close()" || exit 1

# Command to run the gRPC server
CMD ["uv", "run", "emery-worker"]
