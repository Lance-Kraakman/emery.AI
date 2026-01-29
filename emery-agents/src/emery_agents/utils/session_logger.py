"""
Session Logger for debugging agent prompt flows.

Logs full prompt sessions to a single file for easy debugging:
- Prompts sent to each agent
- Responses received
- State transitions between phases
- Tool calls and results
- Plan creation, approval, and execution

Each session creates a log file like:
  /tmp/emery_prompts/session_{session_id}.log

The log format is JSONL (one JSON object per line) for easy parsing.

Enable logging by setting:
  EMERY_DEBUG_PROMPTS=1
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Check if debug logging is enabled via environment variable
DEBUG_PROMPTS_ENABLED = os.environ.get("EMERY_DEBUG_PROMPTS", "").lower() in ("1", "true", "yes")


class SessionLogger:
    """Logs full prompt sessions for debugging agent flows.

    Only active when EMERY_DEBUG_PROMPTS=1 environment variable is set.
    """

    _instance: Optional["SessionLogger"] = None
    _session_id: Optional[str] = None

    def __init__(self, session_id: str):
        """
        Initialize session logger.

        Args:
            session_id: Unique identifier for this session (e.g., conversation ID)
        """
        self.session_id = session_id
        self.enabled = DEBUG_PROMPTS_ENABLED
        self.log_dir = "/tmp/emery_prompts"
        self.log_path = f"{self.log_dir}/session_{session_id}.log"

        if self.enabled:
            self._ensure_dir()
            logger.info(f"📝 Session logger initialized: {self.log_path}")
        else:
            logger.debug("📝 Session logger disabled (set EMERY_DEBUG_PROMPTS=1 to enable)")

    def _ensure_dir(self) -> None:
        """Ensure log directory exists."""
        os.makedirs(self.log_dir, exist_ok=True)

    def log_prompt(
        self,
        agent_name: str,
        prompt: str,
        phase: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log a prompt sent to an agent.

        Args:
            agent_name: Name of the agent receiving the prompt
            prompt: The full prompt text
            phase: Current execution phase (e.g., "classification", "planning")
            metadata: Optional additional context
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "prompt",
            "agent": agent_name,
            "phase": phase,
            "content_length": len(prompt),
            "content_preview": prompt[:500] + "..." if len(prompt) > 500 else prompt,
            "metadata": metadata or {}
        }
        self._append(entry)

    def log_prompt_full(
        self,
        agent_name: str,
        prompt: str,
        phase: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log a prompt with full content (for debugging).

        Args:
            agent_name: Name of the agent receiving the prompt
            prompt: The full prompt text
            phase: Current execution phase
            metadata: Optional additional context
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "prompt_full",
            "agent": agent_name,
            "phase": phase,
            "content": prompt,
            "metadata": metadata or {}
        }
        self._append(entry)

    def log_response(
        self,
        agent_name: str,
        response: str,
        tool_calls: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """
        Log a response from an agent.

        Args:
            agent_name: Name of the agent that produced the response
            response: The response text
            tool_calls: Optional list of tool calls made
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "response",
            "agent": agent_name,
            "content_length": len(response),
            "content_preview": response[:500] + "..." if len(response) > 500 else response,
            "tool_calls": tool_calls or []
        }
        self._append(entry)

    def log_state_transition(
        self,
        from_state: str,
        to_state: str,
        trigger: str = ""
    ) -> None:
        """
        Log a state machine transition.

        Args:
            from_state: Previous state
            to_state: New state
            trigger: What caused the transition
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "state_transition",
            "from": from_state,
            "to": to_state,
            "trigger": trigger
        }
        self._append(entry)

    def log_tool_call(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        agent_name: str = ""
    ) -> None:
        """
        Log a tool call.

        Args:
            tool_name: Name of the tool being called
            arguments: Arguments passed to the tool
            agent_name: Name of the agent making the call
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "tool_call",
            "tool": tool_name,
            "agent": agent_name,
            "arguments": arguments
        }
        self._append(entry)

    def log_tool_result(
        self,
        tool_name: str,
        result: Any,
        success: bool = True,
        agent_name: str = ""
    ) -> None:
        """
        Log a tool result.

        Args:
            tool_name: Name of the tool
            result: The result returned
            success: Whether the call succeeded
            agent_name: Name of the agent that made the call
        """
        result_str = str(result)
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "tool_result",
            "tool": tool_name,
            "agent": agent_name,
            "success": success,
            "result_length": len(result_str),
            "result_preview": result_str[:500] + "..." if len(result_str) > 500 else result_str
        }
        self._append(entry)

    def log_event(
        self,
        event_type: str,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log a generic event.

        Args:
            event_type: Type of event
            data: Event data
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "event",
            "event_type": event_type,
            "data": data or {}
        }
        self._append(entry)

    def log_plan(
        self,
        action: str,
        plan_id: str,
        goal: str,
        steps: Optional[List[Dict[str, Any]]] = None,
        context: Optional[str] = None,
        analysis: Optional[str] = None
    ) -> None:
        """
        Log plan creation, update, or status change.

        Args:
            action: Plan action (created, approved, executing, completed, failed, modified)
            plan_id: Unique plan identifier
            goal: Plan goal text
            steps: Optional list of plan steps with descriptions
            context: Optional context gathered during planning
            analysis: Optional analysis/reasoning for the plan
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "plan",
            "action": action,
            "plan_id": plan_id,
            "goal": goal,
            "step_count": len(steps) if steps else 0,
            "steps": [
                {
                    "step_id": s.get("step_id", ""),
                    "description": s.get("description", "")[:200],
                    "status": s.get("status", "pending"),
                    "target_agent": s.get("target_agent")
                }
                for s in (steps or [])
            ],
            "has_context": bool(context),
            "context_preview": context[:300] + "..." if context and len(context) > 300 else context,
            "has_analysis": bool(analysis),
            "analysis_preview": analysis[:300] + "..." if analysis and len(analysis) > 300 else analysis
        }
        self._append(entry)

    def log_step_execution(
        self,
        plan_id: str,
        step_id: str,
        action: str,
        description: str,
        result: Optional[str] = None,
        error: Optional[str] = None
    ) -> None:
        """
        Log step execution events.

        Args:
            plan_id: Parent plan ID
            step_id: Step ID
            action: Step action (started, completed, failed, skipped)
            description: Step description
            result: Optional result for completed steps
            error: Optional error for failed steps
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "step_execution",
            "plan_id": plan_id,
            "step_id": step_id,
            "action": action,
            "description": description[:200],
            "result_preview": result[:300] + "..." if result and len(result) > 300 else result,
            "error": error
        }
        self._append(entry)

    def log_full_content(
        self,
        content_type: str,
        name: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log full content to a separate file for inspection.

        Creates files with timestamps to handle repeated calls:
        /tmp/emery_prompts/session_{id}/001_20240115_143052_context_domain_schema_input.txt

        Args:
            content_type: Type of content ("context", "prompt", "response", "result", "analysis")
            name: Descriptive name (e.g., "domain_schema_input", "step_executor")
            content: The full content to log
            metadata: Optional metadata to include at the top of the file
        """
        if not self.enabled:
            return

        # Create session subdirectory
        session_dir = f"{self.log_dir}/session_{self.session_id}"
        os.makedirs(session_dir, exist_ok=True)

        # Increment counter for ordering (stored as instance attribute)
        if not hasattr(self, "_content_counter"):
            self._content_counter = 0
        self._content_counter += 1

        # Generate timestamp for uniqueness (same prompt can be called twice)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Write full content to separate file
        filename = f"{self._content_counter:03d}_{timestamp}_{content_type}_{name}.txt"
        filepath = f"{session_dir}/{filename}"

        try:
            with open(filepath, "w") as f:
                if metadata:
                    f.write(f"=== METADATA ===\n{json.dumps(metadata, indent=2)}\n\n")
                f.write(f"=== {content_type.upper()} ===\n")
                f.write(content)
        except Exception as e:
            logger.warning(f"Failed to write full content log: {e}")
            return

        # Also log reference in main log
        self._append({
            "timestamp": datetime.now().isoformat(),
            "type": "full_content",
            "content_type": content_type,
            "name": name,
            "file": filepath,
            "length": len(content),
            "metadata": metadata or {}
        })

    def _append(self, entry: Dict[str, Any]) -> None:
        """Append entry to log file (only if enabled)."""
        if not self.enabled:
            return

        try:
            with open(self.log_path, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            logger.warning(f"Failed to write session log: {e}")

    @classmethod
    def get_or_create(cls, session_id: str) -> "SessionLogger":
        """
        Get existing logger or create new one for session.

        Args:
            session_id: Unique session identifier

        Returns:
            SessionLogger instance
        """
        if cls._instance is None or cls._session_id != session_id:
            cls._instance = cls(session_id)
            cls._session_id = session_id
        return cls._instance

    @classmethod
    def get_current(cls) -> Optional["SessionLogger"]:
        """Get current session logger if one exists."""
        return cls._instance


def get_session_logger(session_id: Optional[str] = None) -> Optional[SessionLogger]:
    """
    Get session logger instance.

    Args:
        session_id: Optional session ID. If provided and different from current,
                    creates a new logger.

    Returns:
        SessionLogger instance or None if no session
    """
    if session_id:
        return SessionLogger.get_or_create(session_id)
    return SessionLogger.get_current()
