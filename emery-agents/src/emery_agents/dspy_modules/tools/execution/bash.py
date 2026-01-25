"""
Bash Tool - Execute bash commands in isolated bwrap sandbox.

Ported from tools/bash_tool.py as DSPy-compatible function.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable

from ....sandbox.bwrap_executor import BwrapExecutor

logger = logging.getLogger(__name__)


def create_bash_tool(
    workspace_path: Path,
    allow_network: bool = False,
    timeout: int = 300,
) -> Callable[[str], str]:
    """
    Factory: Create bash execution function with workspace captured in closure.

    Args:
        workspace_path: Path to agent's workspace (mounted at /workspace in sandbox)
        allow_network: Whether to allow network access (default False)
        timeout: Command timeout in seconds (default 5 minutes)

    Returns:
        bash function that DSPy ReAct can use
    """
    executor = BwrapExecutor()

    logger.info(
        f"BashTool initialized: workspace={workspace_path}, "
        f"network={allow_network}, timeout={timeout}s"
    )

    def bash(command: str) -> str:
        """Execute a bash command in the agent's isolated workspace.

        Commands run in /workspace with access to standard Linux tools.
        The workspace contains:
        - workspace/: Working files, outputs, and scratch space
        - .agent/: Agent config and persistent memory
        - history/: Execution logs and previous results

        Available tools in sandbox:
        - File operations: cat, head, tail, echo, sed, cp, mv, rm, mkdir
        - Search: grep, find, ls, tree
        - Data processing: jq, awk, sort, uniq, wc
        - Network (if enabled): curl, wget

        Examples:
        - List files: ls -la workspace/
        - Search: grep -r "pattern" workspace/
        - Create file: echo "content" > workspace/output.txt
        - Process JSON: cat data.json | jq '.field'

        Args:
            command: The bash command to execute. Command runs in /workspace directory.

        Returns:
            Command stdout on success, or error message on failure
        """
        if not command or not command.strip():
            return "Error: Empty command"

        logger.debug(f"Executing bash command: {command[:100]}...")

        try:
            result = executor.execute(
                command=command,
                workspace_path=workspace_path,
                timeout=timeout,
                allow_network=allow_network,
            )
            return str(result)
        except Exception as e:
            logger.exception(f"Bash command failed: {e}")
            return f"Error executing command: {str(e)}"

    return bash
