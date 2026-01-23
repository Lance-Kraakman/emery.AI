"""
Bash Tool - Execute bash commands in isolated bwrap sandbox.

Provides agents with bash access inside an isolated filesystem namespace.
Commands run in /workspace with access to standard Linux tools but
no access to host filesystem or other agent workspaces.

Security:
- Commands run in bwrap sandbox (if available)
- No access to host secrets or environment variables
- Network disabled by default (can be enabled per-tool)
- Only /workspace is writable
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional

from smolagents import Tool

from ..sandbox.bwrap_executor import BwrapExecutor, ExecutionResult

logger = logging.getLogger(__name__)


class BashTool(Tool):
    """
    Execute bash commands in an isolated bwrap sandbox.

    Commands run inside the agent's workspace with access to standard
    Linux tools (cat, grep, sed, jq, etc.) but isolated from the host
    filesystem and other agent workspaces.

    Available tools in sandbox:
    - File operations: cat, head, tail, echo, sed, cp, mv, rm, mkdir
    - Search: grep, find, ls, tree
    - Data processing: jq, awk, sort, uniq, wc
    - Network (if enabled): curl, wget
    """

    name = "bash"
    description = """Execute a bash command in the agent's isolated workspace.

Commands run in /workspace with access to standard Linux tools.
The workspace contains:
- workspace/: Working files, outputs, and scratch space
- .agent/: Agent config and persistent memory
- history/: Execution logs and previous results

Examples:
- List files: ls -la workspace/
- Search: grep -r "pattern" workspace/
- Create file: echo "content" > workspace/output.txt
- Process JSON: cat data.json | jq '.field'
"""

    inputs = {
        "command": {
            "type": "string",
            "description": "The bash command to execute. Command runs in /workspace directory."
        }
    }
    output_type = "string"

    def __init__(
        self,
        workspace_path: Path,
        allow_network: bool = False,
        timeout: int = 300,
    ):
        """
        Initialize bash tool with workspace path.

        Args:
            workspace_path: Path to agent's workspace (mounted at /workspace in sandbox)
            allow_network: Whether to allow network access (default False)
            timeout: Command timeout in seconds (default 5 minutes)
        """
        super().__init__()
        self.workspace_path = workspace_path
        self.allow_network = allow_network
        self.timeout = timeout
        self.executor = BwrapExecutor()

        logger.info(
            f"BashTool initialized: workspace={workspace_path}, "
            f"network={allow_network}, timeout={timeout}s"
        )

    def forward(self, command: str) -> str:
        """
        Execute bash command in sandbox and return output.

        Args:
            command: Bash command to execute

        Returns:
            Command stdout on success, or error message on failure
        """
        if not command or not command.strip():
            return "Error: Empty command"

        logger.debug(f"Executing bash command: {command[:100]}...")

        try:
            # Run async executor in sync context
            result = asyncio.run(
                self.executor.execute(
                    command=command,
                    workspace_path=self.workspace_path,
                    timeout=self.timeout,
                    allow_network=self.allow_network,
                )
            )

            return str(result)

        except asyncio.TimeoutError:
            return f"Error: Command timed out after {self.timeout} seconds"
        except Exception as e:
            logger.exception(f"Bash command failed: {e}")
            return f"Error executing command: {str(e)}"

    async def forward_async(self, command: str) -> str:
        """
        Async version of forward for use in async contexts.

        Args:
            command: Bash command to execute

        Returns:
            Command stdout on success, or error message on failure
        """
        if not command or not command.strip():
            return "Error: Empty command"

        result = await self.executor.execute(
            command=command,
            workspace_path=self.workspace_path,
            timeout=self.timeout,
            allow_network=self.allow_network,
        )

        return str(result)


def load_bash_tool(
    workspace_path: Path,
    allow_network: bool = False,
    timeout: int = 300,
) -> BashTool:
    """
    Factory function to create BashTool instance.

    Args:
        workspace_path: Path to agent's workspace
        allow_network: Whether to allow network access
        timeout: Command timeout in seconds

    Returns:
        Configured BashTool instance
    """
    return BashTool(
        workspace_path=workspace_path,
        allow_network=allow_network,
        timeout=timeout,
    )
