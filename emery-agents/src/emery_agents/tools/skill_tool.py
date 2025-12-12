"""
SkillTool - Executes skills as tools within the agent framework

This tool wraps a SkillConfig and executes it when called by the LLM.
Uses lazy initialization to avoid circular dependencies.

Includes recursion protection:
- Prevents circular skill calls (A → B → A)
- Enforces maximum nesting depth (MAX_DEPTH=10)
"""

import logging
import threading
from typing import Any, Callable, Dict, Optional, Set
from smolagents import Tool
from ..grpc.generated.agent_worker_pb2 import SkillConfig

logger = logging.getLogger(__name__)


class SkillTool(Tool):
    """
    Tool that executes a skill when called by the LLM.

    Uses lazy initialization: skill_config is stored at creation,
    but the sub-agent is only created when forward() is called.
    This avoids circular dependencies during tool loading.

    Includes recursion protection:
    - Class-level call stack tracks active skills to prevent circular calls
    - MAX_DEPTH limits nesting to prevent runaway recursion

    When the LLM calls this tool, it:
    1. Takes the runtime inputs from the LLM
    2. Calls the execution callback with skill_config + inputs
    3. The callback creates a sub-agent and executes the skill
    4. Returns the result as a string
    """

    # Maximum nesting depth for skill-calling-skill chains
    MAX_DEPTH = 10

    # Thread-local storage for call stack (prevents cross-request contamination)
    _thread_local = threading.local()

    # Skip smolagents' forward signature validation since skills have dynamic inputs
    # This is the official pattern for tools with variable input schemas (see SpaceToolWrapper, LangChainToolWrapper)
    skip_forward_signature_validation = True

    def __init__(
        self,
        skill_config: SkillConfig,
        skill_executor: Callable[[SkillConfig, Dict[str, Any]], str]
    ):
        """
        Initialize SkillTool with lazy execution.

        Args:
            skill_config: The full skill definition from proto
            skill_executor: Callback function that executes the skill
                          Takes (skill_config, runtime_inputs) -> result string
        """
        # Call parent's __init__ to set is_initialized flag
        super().__init__()

        self.skill_config = skill_config
        self.skill_executor = skill_executor

        # Tool metadata for the LLM
        self.name = f"skill_{skill_config.name.replace('-', '_').replace(' ', '_')}"
        self.description = skill_config.description or f"Execute the {skill_config.name} skill"
        self.output_type = "string"

        # Convert skill inputs to tool input schema
        self.inputs = self._build_inputs_schema()

        logger.info(f"✨ Created SkillTool: {self.name} with {len(self.inputs)} inputs")

    @classmethod
    def _get_call_stack(cls) -> Set[str]:
        """Get the thread-local call stack, initializing if needed."""
        if not hasattr(cls._thread_local, 'call_stack'):
            cls._thread_local.call_stack = set()
        return cls._thread_local.call_stack

    @classmethod
    def _get_call_depth(cls) -> int:
        """Get the current call depth (size of call stack)."""
        return len(cls._get_call_stack())

    @classmethod
    def reset_call_stack(cls) -> None:
        """Reset the call stack. Called at the start of a new request."""
        cls._thread_local.call_stack = set()

    def _build_inputs_schema(self) -> Dict[str, Dict[str, str]]:
        """
        Convert SkillConfig.inputs to smolagents tool input schema.

        Returns:
            Dict mapping input name to {type, description}
        """
        inputs_schema = {}

        for skill_input in self.skill_config.inputs:
            # Map skill input types to smolagents types
            type_mapping = {
                "text": "string",
                "image": "string",  # URL to image
                "file": "string",   # URL to file
                "audio": "string",  # URL to audio
                "video": "string",  # URL to video
                "document": "string"  # URL to document
            }

            input_type = type_mapping.get(skill_input.type, "string")

            inputs_schema[skill_input.name] = {
                "type": input_type,
                "description": f"{'(Required) ' if skill_input.required else '(Optional) '}{skill_input.name}"
            }

        # If skill has no inputs, provide a generic task input
        if not inputs_schema:
            inputs_schema["task"] = {
                "type": "string",
                "description": "The task or query to execute with this skill"
            }

        return inputs_schema

    def forward(self, **kwargs) -> str:
        """
        Execute the skill when called by the LLM.

        This is called at runtime when the LLM decides to use this tool.
        We create a new sub-agent and execute the skill's instructions.

        Includes recursion protection:
        - Checks for circular calls (same skill already in call stack)
        - Checks maximum depth (MAX_DEPTH=10)

        Args:
            **kwargs: Runtime inputs from the LLM (matching self.inputs schema)

        Returns:
            Skill execution result as a string
        """
        skill_name = self.skill_config.name
        call_stack = self._get_call_stack()

        # Check for circular call (A → B → A)
        if skill_name in call_stack:
            error_msg = f"Circular skill call detected: '{skill_name}' is already being executed in this call chain. Call stack: {list(call_stack)}"
            logger.error(f"🔄 {error_msg}")
            return f"Error: {error_msg}"

        # Check maximum depth
        current_depth = self._get_call_depth()
        if current_depth >= self.MAX_DEPTH:
            error_msg = f"Maximum skill nesting depth ({self.MAX_DEPTH}) exceeded. Reduce skill delegation complexity."
            logger.error(f"📊 {error_msg}")
            return f"Error: {error_msg}"

        logger.info(f"🎯 Executing skill: {self.name} (depth: {current_depth + 1}/{self.MAX_DEPTH}) with inputs: {list(kwargs.keys())}")

        # Add to call stack
        call_stack.add(skill_name)

        try:
            # Call the execution callback with skill config + runtime inputs
            result = self.skill_executor(self.skill_config, kwargs)

            logger.info(f"✅ Skill {self.name} completed successfully")
            return result

        except Exception as e:
            error_msg = f"Skill execution failed: {str(e)}"
            logger.error(f"❌ Skill {self.name} failed: {e}", exc_info=True)
            return error_msg

        finally:
            # Always remove from call stack, even on error
            call_stack.discard(skill_name)
