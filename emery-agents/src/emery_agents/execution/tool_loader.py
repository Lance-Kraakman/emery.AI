"""
Simple Tool Loader

AIDEV-NOTE: Simplified tool loading using modular tool registry.
This replaces the massive previous implementation with a clean, maintainable system.
"""

from .tools.tool_registry import create_tool_loader

# Create the ToolLoader class for backward compatibility
ToolLoader = create_tool_loader().__class__

# Export for use by other modules
__all__ = ["ToolLoader"]