"""
Base Tools Module

AIDEV-NOTE: Basic smolagents tools for core functionality.
Includes Python REPL, web search, file operations, and calculator.
"""

from typing import Any
from smolagents import Tool
from ...core.entities import ToolConfig


def load_python_repl(config: ToolConfig) -> Any:
    """Load Python REPL tool."""
    try:
        from smolagents.tools import PythonInterpreterTool
        return PythonInterpreterTool()
    except ImportError:
        raise ValueError("PythonInterpreterTool not available - check smolagents installation")


def load_web_search(config: ToolConfig) -> Any:
    """Load web search tool."""
    try:
        from smolagents import DuckDuckGoSearchTool
        return DuckDuckGoSearchTool()
    except ImportError:
        raise ValueError("DuckDuckGoSearchTool not available - check smolagents installation")


def load_file_reader(config: ToolConfig) -> Any:
    """Load file reader tool."""
    # AIDEV-TODO: Implement file reader tool
    # For now, use a placeholder
    class FileReaderTool:
        def __call__(self, file_path: str) -> str:
            with open(file_path, 'r') as f:
                return f.read()
    
    return FileReaderTool()


def load_calculator(config: ToolConfig) -> Any:
    """Load calculator tool."""
    # AIDEV-TODO: Implement calculator tool or use existing one
    class CalculatorTool:
        def __call__(self, expression: str) -> float:
            # Simple eval - in production use safer math parser
            return eval(expression)
    
    return CalculatorTool()


# Registry of base tools
BASE_TOOLS = {
    "python_repl": load_python_repl,
    "web_search": load_web_search,
    "file_reader": load_file_reader,
    "calculator": load_calculator,
}