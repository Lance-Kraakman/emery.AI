"""
Filesystem Tools - Read, search, and modify files in agent workspace.

These tools provide Claude Code-style filesystem operations with rich
descriptions that help the agent understand WHEN and HOW to use each tool.

Separation of concerns:
- read_file: View specific file contents
- glob_files: Find files by name pattern
- grep_content: Search file contents
- write_file: Create or overwrite files
- edit_file: Make targeted changes to existing files
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import dspy

logger = logging.getLogger(__name__)

# Maximum file size to read (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

# Maximum lines to return by default
DEFAULT_MAX_LINES = 200


def create_filesystem_tools(
    workspace_path: Path,
) -> dict[str, Callable[..., str]]:
    """
    Factory: Create filesystem tools with workspace captured in closure.

    Args:
        workspace_path: Path to agent's workspace (all operations confined here)

    Returns:
        Dictionary of tool name -> callable function
    """
    logger.info(f"FilesystemTools initialized: workspace={workspace_path}")

    def _resolve_path(path: str) -> Path:
        """Resolve path relative to workspace, with security checks."""
        if not path:
            return workspace_path

        # Handle absolute paths by making them relative
        if path.startswith("/"):
            path = path.lstrip("/")

        resolved = (workspace_path / path).resolve()

        # Security: ensure path stays within workspace
        try:
            resolved.relative_to(workspace_path.resolve())
        except ValueError:
            raise ValueError(f"Path escapes workspace: {path}")

        return resolved

    def _format_with_line_numbers(content: str, start_line: int = 1) -> str:
        """Format content with line numbers like 'N: content'."""
        lines = content.split("\n")
        formatted = []
        for i, line in enumerate(lines, start=start_line):
            formatted.append(f"{i}: {line}")
        return "\n".join(formatted)

    def read_file(
        path: str,
        start_line: int = 1,
        max_lines: int = DEFAULT_MAX_LINES,
    ) -> str:
        """Read file contents with line numbers.

        USE WHEN:
        - You need to see file contents to understand code or data
        - You need to find specific lines before making edits
        - You want to examine a configuration or data file

        DON'T USE:
        - For searching across many files (use grep instead)
        - For finding files by name (use glob instead)
        - For very large files without specifying line limits

        Args:
            path: File path relative to workspace (e.g., "src/main.py", "config.json")
            start_line: Line to start from (1-indexed, default 1)
            max_lines: Maximum lines to return (default 200, use for large files)

        Returns:
            File contents with line numbers in format:
            1: first line content
            2: second line content
            ...

        Examples:
            read_file("config.json")              # Read entire config
            read_file("main.py", 50, 100)         # Lines 50-150 of main.py
            read_file("data.csv", 1, 10)          # First 10 lines of CSV
        """
        try:
            resolved = _resolve_path(path)

            if not resolved.exists():
                return f"Error: File not found: {path}"

            if not resolved.is_file():
                return f"Error: Not a file: {path}"

            # Check file size
            size = resolved.stat().st_size
            if size > MAX_FILE_SIZE:
                return f"Error: File too large ({size} bytes). Use start_line/max_lines to read portions."

            content = resolved.read_text(encoding="utf-8", errors="replace")
            lines = content.split("\n")

            # Apply offset and limit
            start_idx = max(0, start_line - 1)
            end_idx = start_idx + max_lines
            selected_lines = lines[start_idx:end_idx]

            # Format with line numbers
            result = _format_with_line_numbers("\n".join(selected_lines), start_line)

            # Add truncation notice if applicable
            if end_idx < len(lines):
                result += f"\n\n[Showing lines {start_line}-{start_idx + len(selected_lines)}, {len(lines) - end_idx} more lines below]"

            return result

        except Exception as e:
            logger.exception(f"read_file failed: {e}")
            return f"Error reading file: {str(e)}"

    def glob_files(pattern: str, path: str = "") -> str:
        """Find files matching a glob pattern.

        USE WHEN:
        - You know the file name pattern but not the exact location
        - You need to discover what files exist in the workspace
        - You want to find all files of a certain type (e.g., all .py files)

        DON'T USE:
        - When searching file CONTENTS (use grep instead)
        - When you know the exact file path (use read_file instead)

        GLOB SYNTAX:
        - *        matches any characters except /
        - **       matches any characters including / (recursive)
        - ?        matches any single character
        - [abc]    matches a, b, or c
        - [!abc]   matches anything except a, b, or c

        Args:
            pattern: Glob pattern (e.g., "**/*.py", "src/**/*.ts", "*.json")
            path: Directory to search in (default: workspace root)

        Returns:
            Newline-separated list of matching file paths (relative to workspace)
            Returns "No files found" if no matches

        Examples:
            glob_files("**/*.py")              # All Python files, recursive
            glob_files("*.json")               # JSON files in root only
            glob_files("**/*.test.ts")         # All TypeScript test files
            glob_files("src/**/*.tsx")         # TSX files under src/
            glob_files("config*")              # Files starting with 'config'
        """
        try:
            base_path = _resolve_path(path)

            if not base_path.exists():
                return f"Error: Path not found: {path or 'workspace root'}"

            if not base_path.is_dir():
                return f"Error: Not a directory: {path}"

            # Use pathlib glob
            if "**" in pattern:
                matches = list(base_path.glob(pattern))
            else:
                matches = list(base_path.glob(pattern))

            # Filter to files only (not directories)
            matches = [m for m in matches if m.is_file()]

            if not matches:
                return f"No files found matching pattern: {pattern}"

            # Sort and format relative paths
            matches.sort()
            relative_paths = []
            for match in matches[:100]:  # Limit to 100 results
                try:
                    rel = match.relative_to(workspace_path)
                    relative_paths.append(str(rel))
                except ValueError:
                    relative_paths.append(str(match))

            result = "\n".join(relative_paths)

            if len(matches) > 100:
                result += f"\n\n[Showing 100 of {len(matches)} matches]"

            return result

        except Exception as e:
            logger.exception(f"glob_files failed: {e}")
            return f"Error searching files: {str(e)}"

    def grep_content(
        pattern: str,
        path: str = "",
        file_pattern: str = "",
        context: int = 0,
        max_results: int = 50,
    ) -> str:
        """Search file contents using regex.

        USE WHEN:
        - You need to find WHERE something is defined or used
        - You're searching for patterns across multiple files
        - You want to find all occurrences of a function, class, or variable

        DON'T USE:
        - For reading a specific known file (use read_file instead)
        - For finding files by name (use glob instead)

        PATTERN SYNTAX (Python regex):
        - .        matches any character
        - *        matches 0+ of preceding
        - +        matches 1+ of preceding
        - ?        makes preceding optional
        - ^        start of line
        - $        end of line
        - \\b       word boundary
        - [abc]    character class
        - (a|b)    alternation

        Args:
            pattern: Regex pattern to search for (e.g., "def main", "import.*pandas")
            path: Directory or file to search (default: workspace root)
            file_pattern: Filter files by glob (e.g., "*.py", "*.ts")
            context: Lines of context around matches (default 0)
            max_results: Maximum results to return (default 50)

        Returns:
            Matches in format: filepath:line_number:content
            With context lines shown as filepath:line_number-content

        Examples:
            grep_content("def main")                          # Find main function
            grep_content("import.*pandas", file_pattern="*.py")  # Pandas imports
            grep_content("TODO", context=2)                   # TODOs with context
            grep_content("class.*Error")                      # Error class definitions
            grep_content("\\buser_id\\b")                       # Exact word user_id
        """
        try:
            base_path = _resolve_path(path)

            if not base_path.exists():
                return f"Error: Path not found: {path or 'workspace root'}"

            # Compile regex
            try:
                regex = re.compile(pattern)
            except re.error as e:
                return f"Error: Invalid regex pattern: {e}"

            # Find files to search
            if base_path.is_file():
                files_to_search = [base_path]
            else:
                # Get all files, optionally filtered by pattern
                if file_pattern:
                    files_to_search = list(base_path.rglob(file_pattern))
                else:
                    files_to_search = [
                        f for f in base_path.rglob("*") if f.is_file()
                    ]

            results = []
            matches_found = 0

            for file_path in sorted(files_to_search):
                if matches_found >= max_results:
                    break

                # Skip binary files and very large files
                try:
                    if file_path.stat().st_size > MAX_FILE_SIZE:
                        continue

                    content = file_path.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue

                lines = content.split("\n")
                rel_path = str(file_path.relative_to(workspace_path))

                for i, line in enumerate(lines):
                    if matches_found >= max_results:
                        break

                    if regex.search(line):
                        matches_found += 1

                        if context > 0:
                            # Add context lines before
                            start = max(0, i - context)
                            for j in range(start, i):
                                results.append(f"{rel_path}:{j + 1}-{lines[j]}")

                        # Add the matching line
                        results.append(f"{rel_path}:{i + 1}:{line}")

                        if context > 0:
                            # Add context lines after
                            end = min(len(lines), i + context + 1)
                            for j in range(i + 1, end):
                                results.append(f"{rel_path}:{j + 1}-{lines[j]}")
                            results.append("")  # Separator between matches

            if not results:
                return f"No matches found for pattern: {pattern}"

            result = "\n".join(results)

            if matches_found >= max_results:
                result += f"\n\n[Showing first {max_results} matches, more may exist]"

            return result

        except Exception as e:
            logger.exception(f"grep_content failed: {e}")
            return f"Error searching content: {str(e)}"

    def write_file(path: str, content: str) -> str:
        """Write content to a file (creates directories if needed).

        USE WHEN:
        - Creating new files from scratch
        - Completely replacing a file's contents
        - Generating new code, configs, or data files

        DON'T USE:
        - For making small edits to existing files (use edit_file instead)
        - When you haven't checked if the file exists (might overwrite important data)

        SAFETY:
        - Always verify the file doesn't exist or is safe to overwrite
        - Use read_file first if you're unsure about existing content

        Args:
            path: File path relative to workspace (directories created automatically)
            content: Content to write to the file

        Returns:
            Success message with file path and size, or error message

        Examples:
            write_file("output/results.json", '{"status": "complete"}')
            write_file("src/new_module.py", 'def hello():\\n    print("Hello")')
            write_file("README.md", '# Project Title\\n\\nDescription here.')
        """
        try:
            resolved = _resolve_path(path)

            # Create parent directories if needed
            resolved.parent.mkdir(parents=True, exist_ok=True)

            # Write content
            resolved.write_text(content, encoding="utf-8")

            size = len(content.encode("utf-8"))
            lines = content.count("\n") + 1

            return f"Successfully wrote {path} ({lines} lines, {size} bytes)"

        except Exception as e:
            logger.exception(f"write_file failed: {e}")
            return f"Error writing file: {str(e)}"

    def edit_file(path: str, old_content: str, new_content: str) -> str:
        """Edit a file by replacing specific content.

        USE WHEN:
        - Making targeted changes to existing files
        - Fixing bugs or updating specific code sections
        - Modifying configurations without rewriting entire file

        DON'T USE:
        - For creating new files (use write_file instead)
        - When you haven't read the file first (you need exact content to match)

        IMPORTANT:
        - old_content must match EXACTLY (including whitespace and indentation)
        - Always use read_file first to get the exact content to replace
        - If old_content appears multiple times, ALL occurrences are replaced

        Args:
            path: File path relative to workspace
            old_content: Exact content to find and replace (must match exactly)
            new_content: Content to replace it with

        Returns:
            Success message with diff preview, or error if old_content not found

        Examples:
            # After reading file and finding: "def old_name():"
            edit_file("main.py", "def old_name():", "def new_name():")

            # Fix a bug (include enough context to be unique)
            edit_file("calc.py",
                "    return x + y  # BUG: should subtract",
                "    return x - y  # Fixed")

            # Update configuration
            edit_file("config.json",
                '"debug": false',
                '"debug": true')
        """
        try:
            resolved = _resolve_path(path)

            if not resolved.exists():
                return f"Error: File not found: {path}"

            if not resolved.is_file():
                return f"Error: Not a file: {path}"

            content = resolved.read_text(encoding="utf-8")

            # Check if old_content exists
            if old_content not in content:
                # Provide helpful error with context
                if old_content.strip() in content:
                    return (
                        f"Error: old_content not found (whitespace mismatch?).\n"
                        f"The stripped content exists in the file.\n"
                        f"Use read_file to get the exact content including indentation."
                    )
                return (
                    f"Error: old_content not found in {path}.\n"
                    f"Use read_file first to get the exact content to replace."
                )

            # Count occurrences
            count = content.count(old_content)

            # Perform replacement
            new_file_content = content.replace(old_content, new_content)

            # Write back
            resolved.write_text(new_file_content, encoding="utf-8")

            # Generate diff preview
            old_lines = old_content.split("\n")
            new_lines = new_content.split("\n")

            diff_preview = ["Changes made:"]
            for line in old_lines[:3]:
                diff_preview.append(f"- {line}")
            if len(old_lines) > 3:
                diff_preview.append(f"  ... ({len(old_lines) - 3} more lines)")
            for line in new_lines[:3]:
                diff_preview.append(f"+ {line}")
            if len(new_lines) > 3:
                diff_preview.append(f"  ... ({len(new_lines) - 3} more lines)")

            result = f"Successfully edited {path}"
            if count > 1:
                result += f" ({count} occurrences replaced)"
            result += "\n\n" + "\n".join(diff_preview)

            return result

        except Exception as e:
            logger.exception(f"edit_file failed: {e}")
            return f"Error editing file: {str(e)}"

    return {
        "read_file": read_file,
        "glob": glob_files,
        "grep": grep_content,
        "write_file": write_file,
        "edit_file": edit_file,
    }
