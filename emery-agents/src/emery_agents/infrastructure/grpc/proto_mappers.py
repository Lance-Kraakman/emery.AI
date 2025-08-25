"""
Protobuf Message Mappers - Simplified for Testing

AIDEV-NOTE: Simplified version for gRPC testing without complex domain imports.
Contains only essential mapping functions needed by the gRPC server.
"""

import json
from typing import Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass

from ...grpc.generated import agent_worker_pb2


@dataclass 
class Task:
    """Simple task data class for testing."""
    id: str
    agent: str
    instructions: str
    capabilityName: Optional[str] = None


def parse_task_request(request: agent_worker_pb2.TaskRequest) -> Task:
    """Parse protobuf TaskRequest into simple Task object."""
    # Extract instructions from the request
    instructions = ""
    if hasattr(request, 'instruction_config') and request.instruction_config:
        instructions = request.instruction_config.instructions
    
    return Task(
        id=request.task_id,
        agent=str(request.agent_id),
        instructions=instructions,
        capabilityName=request.capability_name if request.capability_name else None
    )


def create_task_progress(
    task_id: str, 
    status: int, 
    step_id: str = "",
    step_type: str = "",
    output_data: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
    progress_percent: float = 0.0
) -> agent_worker_pb2.TaskProgress:
    """Create TaskProgress protobuf message."""
    progress = agent_worker_pb2.TaskProgress()
    progress.task_id = task_id
    progress.status = status
    progress.step_id = step_id
    progress.step_type = step_type
    progress.timestamp_ms = int(datetime.now().timestamp() * 1000)
    progress.progress_percent = progress_percent
    
    if output_data:
        progress.output_json = json.dumps(output_data)
    
    if error_message:
        progress.error_message = error_message
    
    return progress