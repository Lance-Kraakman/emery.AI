"""
Unified Session Context

Provides session-level context that's pre-resolved at session start,
complementing the execution-scoped ExecutionState.

AIDEV-NOTE: This consolidates scattered context into a single source:
- Session identifiers (org, user, workspace)
- Pre-resolved agents and tools (no discovery needed)
- Conversation history reference

The existing ExecutionContext (entities/execution_context.py) handles
task-specific context and remains unchanged. This module adds the
session-level context that wraps around task execution.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..models.plan import Plan


@dataclass
class AgentInfo:
    """
    Pre-resolved agent information for prompt injection.

    Instead of discovering agents via tool calls, inject this into prompts
    at render time.
    """
    name: str
    description: str
    examples: List[str] = field(default_factory=list)
    antipatterns: List[str] = field(default_factory=list)
    capabilities: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for template rendering."""
        return {
            "name": self.name,
            "description": self.description,
            "examples": self.examples,
            "antipatterns": self.antipatterns,
            "capabilities": self.capabilities,
        }


@dataclass
class ToolInfo:
    """Pre-resolved tool information."""
    name: str
    description: str
    is_read_only: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "is_read_only": self.is_read_only,
        }


@dataclass
class SessionContext:
    """
    Session-scoped context, resolved once at session start.

    Contains everything needed for an execution session:
    - Identity (org, user, workspace)
    - Available agents and tools (pre-resolved, no discovery)
    - Conversation history reference

    Usage:
        session = SessionContext.create(
            session_id="abc123",
            org_id="org_1",
            workspace_id="ws_1",
            model_provider=model_provider,
        )

        # Pass to planner/executor for prompt rendering
        prompt_vars = session.to_prompt_context()
    """
    session_id: str
    org_id: str
    user_id: str = ""
    workspace_id: str = ""

    # Pre-resolved at session start (no discovery calls needed)
    available_agents: List[AgentInfo] = field(default_factory=list)
    available_tools: List[ToolInfo] = field(default_factory=list)

    # Conversation reference (actual messages stored elsewhere)
    conversation_id: Optional[str] = None

    # Model configuration
    org_model: Optional[str] = None

    @classmethod
    def create(
        cls,
        session_id: str,
        org_id: str,
        user_id: str = "",
        workspace_id: str = "",
        agents: Optional[List[AgentInfo]] = None,
        tools: Optional[List[ToolInfo]] = None,
        org_model: Optional[str] = None,
    ) -> "SessionContext":  # Forward ref needed - class not yet defined
        """
        Factory method to create a session context.

        In production, agents/tools would be resolved from CapabilityRegistry
        at session start, then injected here.
        """
        return cls(
            session_id=session_id,
            org_id=org_id,
            user_id=user_id,
            workspace_id=workspace_id,
            available_agents=agents or [],
            available_tools=tools or [],
            org_model=org_model,
        )

    def to_prompt_context(self) -> Dict[str, Any]:
        """
        Build context dict for prompt template rendering.

        Returns dict that can be passed directly to render_template().
        """
        return {
            "session_id": self.session_id,
            "org_id": self.org_id,
            "user_id": self.user_id,
            "workspace_id": self.workspace_id,
            "available_agents": [a.to_dict() for a in self.available_agents],
            "available_tools": [t.to_dict() for t in self.available_tools],
            "has_agents": len(self.available_agents) > 0,
            "has_tools": len(self.available_tools) > 0,
        }

    def get_agent_by_name(self, name: str) -> Optional[AgentInfo]:
        """Look up agent by name."""
        for agent in self.available_agents:
            if agent.name == name:
                return agent
        return None

    def get_tool_by_name(self, name: str) -> Optional[ToolInfo]:
        """Look up tool by name."""
        for tool in self.available_tools:
            if tool.name == name:
                return tool
        return None


def build_prompt_context(
    session: SessionContext,
    task: str,
    plan: Optional[Plan] = None,
    step_results: Optional[Dict[str, Dict[str, Any]]] = None,
    additional_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build complete prompt context from session and execution state.

    This is the single function to call when rendering any prompt template.
    It combines session context with task-specific state.

    Args:
        session: Session-level context (agents, tools, identity)
        task: Current task/goal
        plan: Current plan if any
        step_results: Results from completed steps
        additional_context: Any extra context to merge in

    Returns:
        Dict ready for render_template()
    """
    context = session.to_prompt_context()
    context.update({
        "task": task,
        "plan": plan,
        "step_results": step_results or {},
    })
    if additional_context:
        context.update(additional_context)
    return context
