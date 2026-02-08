"""Converts streaming response dicts to protobuf messages."""

import json
import time
from typing import Any, NamedTuple

from .generated import agent_worker_pb2
from .response_types import StreamResponseDict


class ConversionResult(NamedTuple):
    """Result of converting a response dict to protobuf.

    Attributes:
        proto_response: The converted protobuf message (None if not applicable)
        content_to_add: Content string to accumulate (for content_chunk events)
        plan_data: Plan metadata dict (for plan_metadata events)
        should_break: Whether to stop streaming (e.g., on error)
        seq_increment: How much to increment sequence number
    """

    proto_response: agent_worker_pb2.ProcessMessageResponse | None
    content_to_add: str
    plan_data: dict[str, Any] | None
    should_break: bool
    seq_increment: int


def _populate_protobuf_map(proto_map: Any, data: dict[str, str]) -> None:
    for key, value in data.items():
        proto_map[key] = str(value)


def convert_step_progress(
    response_dict: dict[str, Any],
) -> agent_worker_pb2.ProcessMessageResponse:
    step_type_map = {
        "PLANNING": agent_worker_pb2.STEP_PLANNING,
        "ACTION": agent_worker_pb2.STEP_ACTION,
        "REASONING": agent_worker_pb2.STEP_REASONING,
        "FINAL": agent_worker_pb2.STEP_FINAL,
    }

    raw_step_index = response_dict.get("step_index", 0)
    step_index = int(raw_step_index) if raw_step_index is not None else 0

    step_progress_msg = agent_worker_pb2.StepProgress(
        step_type=step_type_map.get(
            str(response_dict.get("step_type", "")), agent_worker_pb2.STEP_PLANNING
        ),
        step_name=str(response_dict.get("step_name", "")),
        content=str(response_dict.get("content", "")),
        step_index=step_index,
    )

    metadata = response_dict.get("metadata", {})
    if metadata and isinstance(metadata, dict):
        _populate_protobuf_map(step_progress_msg.metadata, metadata)

    return agent_worker_pb2.ProcessMessageResponse(
        step_progress=step_progress_msg, timestamp=int(time.time() * 1000)
    )


def convert_content_chunk(
    response_dict: dict[str, Any], sequence: int
) -> agent_worker_pb2.ProcessMessageResponse:
    return agent_worker_pb2.ProcessMessageResponse(
        content_chunk=agent_worker_pb2.ContentChunk(
            content=str(response_dict.get("content", "")), sequence=sequence
        ),
        timestamp=int(time.time() * 1000),
    )


def convert_error(
    response_dict: dict[str, Any],
) -> agent_worker_pb2.ProcessMessageResponse:
    error_data = response_dict.get("error", {})
    return agent_worker_pb2.ProcessMessageResponse(
        error=agent_worker_pb2.ProcessingError(
            error_code=str(error_data.get("error_code", "UNKNOWN")),
            error_message=str(error_data.get("error_message", "Unknown error")),
            error_details=error_data.get("error_details", {}),
            hint=str(error_data.get("hint", "")),
            can_retry=bool(error_data.get("can_retry", False)),
            auto_retry=bool(error_data.get("auto_retry", False)),
            session_reset=bool(error_data.get("session_reset", False)),
        ),
        timestamp=int(time.time() * 1000),
    )


def convert_interrupted(
    response_dict: dict[str, Any], sequence: int
) -> agent_worker_pb2.ProcessMessageResponse:
    message = str(response_dict.get("message", "Processing interrupted"))
    return agent_worker_pb2.ProcessMessageResponse(
        content_chunk=agent_worker_pb2.ContentChunk(
            content=f"\n\n{message}", sequence=sequence
        ),
        timestamp=int(time.time() * 1000),
    )


def convert_awaiting_input(
    response_dict: dict[str, Any],
) -> agent_worker_pb2.ProcessMessageResponse:
    data = response_dict.get("data", {})
    input_options = [
        agent_worker_pb2.InputOption(
            id=str(opt.get("id", "")),
            label=str(opt.get("label", "")),
            description=str(opt.get("description", "")),
        )
        for opt in data.get("options", [])
    ]

    # For questions type, serialize questions array to JSON in content
    # (protobuf AwaitingInput doesn't have a questions field)
    content = str(data.get("content", ""))
    questions = data.get("questions", [])
    if questions and data.get("input_type") == "questions":
        content = json.dumps(questions)

    return agent_worker_pb2.ProcessMessageResponse(
        awaiting_input=agent_worker_pb2.AwaitingInput(
            input_type=str(data.get("input_type", "question")),
            title=str(data.get("title", "")),
            content=content,
            options=input_options,
            plan_json=str(data.get("plan_json", "")),
        ),
        timestamp=int(time.time() * 1000),
    )


def convert_permission_request(
    response_dict: dict[str, Any],
) -> agent_worker_pb2.ProcessMessageResponse:
    permission_data = json.dumps(
        {
            "permission": response_dict.get("permission", "unknown"),
            "resource": response_dict.get("resource", ""),
            "resourceId": response_dict.get("resource_id", 0),
            "action": response_dict.get("action", "access"),
            "context": response_dict.get("context", ""),
        }
    )

    return agent_worker_pb2.ProcessMessageResponse(
        awaiting_input=agent_worker_pb2.AwaitingInput(
            input_type="permission_request",
            title="Permission Required",
            content=str(
                response_dict.get("context", "Agent needs permission to continue")
            ),
            options=[
                agent_worker_pb2.InputOption(
                    id="allow",
                    label="Allow Access",
                    description="Grant the requested permission",
                ),
                agent_worker_pb2.InputOption(
                    id="deny", label="Deny", description="Deny the request"
                ),
            ],
            plan_json=permission_data,
        ),
        timestamp=int(time.time() * 1000),
    )


def convert_awaiting_human_skill(response_dict: Dict[str, Any]) -> agent_worker_pb2.ProcessMessageResponse:
    """Convert awaiting_human_skill event to proto response.

    AIDEV-NOTE: Uses the AwaitingHumanSkill proto message defined in agent_worker.proto.
    This event signals that execution has paused for human action.
    """
    # Build output schema
    output_defs = []
    for output in response_dict.get("output_schema", []):
        output_defs.append(agent_worker_pb2.OutputDefinition(
            name=output.get("name", ""),
            type=output.get("type", "text")
        ))

    # Build input values
    input_values = []
    for name, value in response_dict.get("inputs", {}).items():
        input_values.append(agent_worker_pb2.SkillInputValue(
            name=name,
            type="text",  # Simplified - full type resolution at frontend
            string_value=str(value) if value is not None else ""
        ))

    return agent_worker_pb2.ProcessMessageResponse(
        awaiting_human_skill=agent_worker_pb2.AwaitingHumanSkill(
            skill_id=response_dict.get("skill_id", 0),
            skill_name=response_dict.get("skill_name", ""),
            step_id=response_dict.get("step_id", ""),
            instructions=response_dict.get("instructions", ""),
            inputs=input_values,
            output_schema=output_defs,
            assigned_to=response_dict.get("assigned_to", ""),
            external_links=response_dict.get("external_links", []),
            session_id=response_dict.get("session_id", "")
        ),
        timestamp=int(time.time() * 1000)
    )


def convert_response_to_proto(
    response_dict: StreamResponseDict,
    sequence: int,
) -> ConversionResult:
    """Convert a response dict to protobuf message with metadata."""
    response_type = response_dict.get("type")

    if response_type == "step_progress":
        return ConversionResult(
            convert_step_progress(response_dict), "", None, False, 0
        )

    elif response_type == "content_chunk":
        chunk = str(response_dict.get("content", ""))
        return ConversionResult(
            convert_content_chunk(response_dict, sequence), chunk, None, False, 1
        )

    elif response_type == "error":
        return ConversionResult(convert_error(response_dict), "", None, True, 0)

    elif response_type == "interrupted":
        return ConversionResult(
            convert_interrupted(response_dict, sequence), "", None, False, 1
        )

    elif response_type == "awaiting_input":
        return ConversionResult(
            convert_awaiting_input(response_dict), "", None, False, 0
        )

    elif response_type == "plan_metadata":
        return ConversionResult(None, "", response_dict.get("plan"), False, 0)

    elif response_type == "permission_request":
        return ConversionResult(
            convert_permission_request(response_dict), "", None, False, 0
        )

    elif response_type == "awaiting_human_skill":
        # Human skill event - stream should close after this
        return ConversionResult(convert_awaiting_human_skill(response_dict), "", None, True, 0)

    else:
        return ConversionResult(None, "", None, False, 0)
