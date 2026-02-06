"""Type definitions for gRPC streaming handlers."""
from typing import TypedDict, Optional, List, Any, Dict

from PIL import Image


class CoordinatorStreamingParams(TypedDict, total=False):
    """
    Parameters passed from AgentStreamingHandler to CoordinatorStreamingHandler.

    This TypedDict defines the contract between the two handlers, ensuring
    only valid parameters are passed and catching mismatches at type-check time.
    """
    session_id: Optional[str]
    org_model: Optional[str]
    sm: Optional[Any]  # StateMachine
    stored_plan: Optional[Any]  # Plan
    conversation_history: Optional[List[Any]]  # List[HistoryMessage]
    user_id: Optional[str]
    workspace_type: Optional[str]
    workspace_id: Optional[str]
    runtime_skill_inputs: Optional[Dict[str, str]]
    images: Optional[List[Image.Image]]
    has_images: bool
    pre_selected_skill: Optional[str]
    pre_selected_agent: Optional[str]
    pre_selected_tool: Optional[str]
