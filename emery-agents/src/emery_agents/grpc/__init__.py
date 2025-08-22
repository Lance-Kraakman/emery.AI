"""
gRPC server and client components for agent workers
"""

# Import generated protobuf definitions from infrastructure
from ..infrastructure.grpc.generated import agent_worker_pb2
from ..infrastructure.grpc.generated import agent_worker_pb2_grpc

__all__ = [
    'agent_worker_pb2',
    'agent_worker_pb2_grpc'
]