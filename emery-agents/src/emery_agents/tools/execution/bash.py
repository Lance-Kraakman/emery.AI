"""
Bash Tool - Execute bash commands in isolated gVisor sandbox.

gVisor provides strong kernel isolation by intercepting ALL syscalls
via its Sentry user-space kernel. The real kernel is never exposed.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path

from emery_agents.services.sandbox import GVisorExecutor

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
    executor = GVisorExecutor()

    logger.info(
        f"BashTool initialized: workspace={workspace_path}, "
        f"network={allow_network}, timeout={timeout}s"
    )

    def bash(command: str) -> str:
        """Execute bash commands in the agent's isolated workspace.

        USE WHEN:
        - Running system commands, scripts, or build tools
        - Complex file operations that combine multiple steps
        - Network operations (curl, wget) when enabled
        - Data processing pipelines with multiple tools

        DON'T USE (prefer specialized tools):
        - For simple file reading (use read_file instead)
        - For file/pattern search (use glob/grep instead)
        - For simple file writing (use write_file instead)
        - For targeted edits (use edit_file instead)

        WORKSPACE STRUCTURE:
        /workspace/               <- Current working directory
        ├── workspace/            <- Working files, outputs, scratch space
        ├── .agent/               <- Agent config, persistent memory
        └── history/              <- Execution logs, previous results

        AVAILABLE TOOLS:
        File Operations:
          cat, head, tail, less   - Read files
          echo, printf            - Output text
          cp, mv, rm, mkdir       - File management
          touch, chmod            - Create/permissions
          tar, gzip, unzip        - Archives

        Search & Discovery:
          find                    - Find files by criteria
          grep, rg                - Search file contents
          ls, tree                - List directories
          wc, du                  - Counts and sizes

        Data Processing:
          jq                      - JSON processing
          awk, sed                - Text transformation
          sort, uniq, cut         - Line processing
          xargs                   - Build commands from input

        Network (if enabled):
          curl, wget              - HTTP requests
          nc                      - Network connections

        COMMON PATTERNS:

        1. EXPLORE DIRECTORY STRUCTURE:
           tree -L 2                           # Tree view, 2 levels deep
           ls -la                              # Detailed file listing
           find . -type f -name "*.py" | head  # Find Python files

        2. SEARCH FILE CONTENTS:
           grep -rn "pattern" .                # Recursive with line numbers
           grep -rl "pattern" .                # List files only
           grep -A3 -B3 "pattern" file.txt    # With context lines

        3. PROCESS JSON DATA:
           cat data.json | jq '.'              # Pretty print
           cat data.json | jq '.items[]'       # Iterate array
           cat data.json | jq '.field.nested'  # Access nested field
           cat data.json | jq 'keys'           # Get object keys

        4. RUN SCRIPTS:
           python script.py                    # Run Python
           node script.js                      # Run JavaScript
           bash script.sh                      # Run shell script

        5. BUILD/TEST COMMANDS:
           pip install -r requirements.txt     # Install Python deps
           npm install                         # Install Node deps
           make build                          # Run makefile

        6. CHAIN COMMANDS:
           cmd1 && cmd2                        # Run cmd2 if cmd1 succeeds
           cmd1 || cmd2                        # Run cmd2 if cmd1 fails
           cmd1 | cmd2                         # Pipe output to cmd2
           cmd1 ; cmd2                         # Run both regardless

        BEST PRACTICES:
        - Always use full paths from /workspace/ for clarity
        - Quote paths with spaces: "path/with spaces/file.txt"
        - Use 'ls' before 'rm' to verify targets
        - For large files, use head/tail instead of cat
        - Prefer grep over find+cat for content search
        - Check exit status with $? if needed
        - Use -n flag with sed for safety (don't edit in place blindly)

        Args:
            command: Bash command to execute (runs in /workspace/ directory)

        Returns:
            stdout on success, error message with stderr on failure
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
