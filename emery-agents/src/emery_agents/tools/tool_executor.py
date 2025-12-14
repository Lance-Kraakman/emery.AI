"""
ToolExecutorTool - Executes tools via sub-agent with proper instructions

AIDEV-NOTE: This wrapper allows CodeAgent (which writes Python code) to delegate
actual tool execution to a ToolCallingAgent sub-agent with proper instructions.

Architecture:
    User → Main ToolCallingAgent
             └── document_builder (CodeAgent)
                    └── writes: tool_executor(tool="document_crud", task="...")
                    └── tool_executor.forward():
                          └── Creates ToolCallingAgent sub-agent
                          └── Uses build_agent_instructions(tools=[tool], agent_type="tool_executor")
                          └── Sub-agent gets tool instructions + executor rules
                          └── Executes in own context (reset=True)
                          └── Returns SUCCESS:/FAILED: prefixed result
                    └── CodeAgent receives result, handles retries/errors

Benefits:
1. Proper instructions - Sub-agent knows tool schema via auto-generated docs
2. Error truthfulness - Enforced by tool_executor.j2 rules
3. Isolation - Own memory, doesn't pollute parent context
4. Parent control - CodeAgent handles interpretation, retries
"""

import logging
from typing import Any, Dict, List

from smolagents import Tool, ToolCallingAgent

logger = logging.getLogger(__name__)


class ToolExecutorTool(Tool):
    """
    Tool executor with proper sub-agent instructions.

    Creates a ToolCallingAgent with:
    - Tool-specific instructions (from tools/emery/*.j2)
    - Executor rules (from agents/tool_executor.j2)
    - Own context (reset=True)

    Returns SUCCESS: or FAILED: prefixed results for clear parent interpretation.
    """

    name = "tool_executor"
    description = (
        "Execute a tool operation via sub-agent. Returns SUCCESS: or FAILED: prefixed output. "
        "Use this for all CRUD operations. Provide tool name and task description."
    )
    inputs = {
        "tool": {
            "type": "string",
            "description": "Name of the tool to execute (e.g., 'document_crud', 'skill_crud')"
        },
        "task": {
            "type": "string",
            "description": (
                "Task description with all required parameters. "
                "Example: 'Create document titled \"My Doc\" in table_id=5, field_id=3'"
            )
        }
    }
    output_type = "string"

    def __init__(
        self,
        available_tools: Dict[str, Tool],
        model: Any,
        max_steps: int = 3
    ):
        """
        Initialize ToolExecutorTool with available tools.

        Args:
            available_tools: Dict mapping tool names to Tool instances
            model: The LLM model to use for the sub-agent
            max_steps: Maximum steps for sub-agent execution (default 3)
        """
        super().__init__()
        self.available_tools = available_tools
        self.model = model
        self.max_steps = max_steps

        logger.info(f"✨ Created ToolExecutorTool with {len(available_tools)} tools: {list(available_tools.keys())}")

    def forward(self, tool: str, task: str) -> str:
        """
        Execute a tool operation via ToolCallingAgent sub-agent with proper instructions.

        Args:
            tool: Name of the tool to execute
            task: Natural language task description with parameters

        Returns:
            Result prefixed with SUCCESS: or FAILED:
        """
        logger.info(f"🔧 ToolExecutor: Executing tool='{tool}' with task='{task[:100]}...'")

        # Validate tool exists
        if tool not in self.available_tools:
            available = list(self.available_tools.keys())
            error_msg = f"Tool '{tool}' not available. Available tools: {available}"
            logger.error(f"❌ ToolExecutor: {error_msg}")
            return f"FAILED: {error_msg}"

        # Get the actual tool instance
        actual_tool = self.available_tools[tool]

        try:
            # Build instructions using existing pattern
            # This gets tool-specific docs + executor rules
            from ..prompts import build_agent_instructions

            instructions = build_agent_instructions(
                tools=[actual_tool],
                agent_type="tool_executor",
                context_type="autonomous"
            )

            logger.debug(f"🔧 ToolExecutor: Built instructions ({len(instructions)} chars)")

            # Create sub-agent with proper instructions
            sub_agent = ToolCallingAgent(
                tools=[actual_tool],
                model=self.model,
                max_steps=self.max_steps,
                instructions=instructions,  # smolagents uses 'instructions', not 'system_prompt'
                verbosity_level=1  # Minimal logging
            )

            logger.info(f"🤖 ToolExecutor: Created sub-agent for tool='{tool}'")

            # Execute in own context (reset=True)
            result = sub_agent.run(task=task, reset=True)
            result_str = str(result)

            logger.info(f"✅ ToolExecutor: tool='{tool}' completed")
            logger.debug(f"🔧 ToolExecutor: Result preview: {result_str[:200]}...")

            return result_str

        except Exception as e:
            error_msg = f"Tool execution error: {str(e)}"
            logger.error(f"❌ ToolExecutor: {error_msg}", exc_info=True)
            return f"FAILED: {error_msg}"


def create_tool_executor(
    tools: List[Tool],
    model: Any,
    max_steps: int = 3
) -> ToolExecutorTool:
    """
    Factory function to create a ToolExecutorTool from a list of tools.

    Args:
        tools: List of Tool instances to make available for execution
        model: The LLM model to use for sub-agent
        max_steps: Maximum steps for sub-agent (default 3)

    Returns:
        Configured ToolExecutorTool instance
    """
    # Convert list to dict keyed by tool name
    available_tools = {tool.name: tool for tool in tools}

    return ToolExecutorTool(
        available_tools=available_tools,
        model=model,
        max_steps=max_steps
    )
