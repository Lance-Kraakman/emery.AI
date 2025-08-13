# Use an official Python runtime as a parent image
FROM python:3.11-slim

WORKDIR /usr/src/app

# Using 'uv' from Astral for faster installs
# First copy only dependency files to leverage Docker layer caching
COPY ./pyproject.toml ./uv.lock* ./
RUN pip install uv
RUN uv pip install --system --frozen-lockfile

# Copy the application code
COPY ./src ./src

# The port your gRPC server listens on
EXPOSE 50051

# Command to run the gRPC server
CMD ["python", "src/emery_agents/grpc/server_simple.py"]
