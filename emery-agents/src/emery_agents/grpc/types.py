"""Type definitions for gRPC streaming handlers."""

from typing import Any, TypedDict

from PIL import Image


class CoordinatorStreamingParams(TypedDict, total=False):
    """
    Parameters passed from AgentStreamingHandler to CoordinatorStreamingHandler.

    This TypedDict defines the contract between the two handlers, ensuring
    only valid parameters are passed and catching mismatches at type-check time.
    """

    session_id: str | None
    org_model: str | None
    sm: Any | None  # StateMachine
    stored_plan: Any | None  # Plan
    conversation_history: list[Any] | None  # List[HistoryMessage]
    user_id: str | None
    workspace_type: str | None
    workspace_id: str | None
    runtime_skill_inputs: dict[str, str] | None
    images: list[Image.Image] | None
    has_images: bool
    pre_selected_skill: str | None
    pre_selected_agent: str | None
    pre_selected_tool: str | None
