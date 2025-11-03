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
        from smolagents import PythonInterpreterTool
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
    
    class FileReaderTool(Tool):
        name = "file_reader"
        description = "This tool reads the content of a text file from the filesystem. It takes a file_path as input and returns the text content of the file."
        inputs = {
            "file_path": {
                "type": "string", 
                "description": "The path to the text file to read. Must be a valid file path accessible to the system."
            }
        }
        output_type = "string"
        
        def forward(self, file_path: str) -> str:
            """Read and return the content of the specified file."""
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except FileNotFoundError:
                return f"Error: File '{file_path}' not found."
            except PermissionError:
                return f"Error: Permission denied reading '{file_path}'."
            except UnicodeDecodeError:
                return f"Error: Unable to decode '{file_path}' as text file."
            except Exception as e:
                return f"Error reading file '{file_path}': {str(e)}"
    
    return FileReaderTool()


def load_calculator(config: ToolConfig) -> Any:
    """Load calculator tool."""

    class CalculatorTool(Tool):
        name = "calculator"
        description = "This tool evaluates mathematical expressions and returns the result. It can perform basic arithmetic operations like addition, subtraction, multiplication, division, and use mathematical functions."
        inputs = {
            "expression": {
                "type": "string",
                "description": "A mathematical expression to evaluate. Supports basic arithmetic (+, -, *, /, **), parentheses, and common math functions. Example: '2 + 3 * 4' or 'sqrt(16) + 5'."
            }
        }
        output_type = "string"

        def forward(self, expression: str) -> str:
            """Evaluate mathematical expression and return the result."""
            try:
                # Import math functions for safer evaluation
                import math
                import re

                # Basic safety check - only allow mathematical expressions
                if re.search(r'[a-zA-Z_][a-zA-Z0-9_]*\s*\(', expression):
                    # Allow only specific math functions
                    allowed_functions = {
                        'abs', 'round', 'min', 'max', 'sum', 'pow',
                        'sqrt', 'sin', 'cos', 'tan', 'log', 'log10', 'exp',
                        'floor', 'ceil', 'pi', 'e'
                    }
                    # Check if any disallowed functions are used
                    functions_used = re.findall(r'([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', expression)
                    for func in functions_used:
                        if func not in allowed_functions:
                            return f"Error: Function '{func}' is not allowed for security reasons."

                # Create safe namespace for evaluation
                safe_dict = {
                    "__builtins__": {},
                    "abs": abs, "round": round, "min": min, "max": max, "sum": sum, "pow": pow,
                    "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan,
                    "log": math.log, "log10": math.log10, "exp": math.exp,
                    "floor": math.floor, "ceil": math.ceil, "pi": math.pi, "e": math.e
                }

                result = eval(expression, safe_dict)
                return str(result)

            except ZeroDivisionError:
                return "Error: Division by zero."
            except ValueError as e:
                return f"Error: Invalid mathematical operation - {str(e)}"
            except SyntaxError:
                return f"Error: Invalid mathematical expression syntax."
            except Exception as e:
                return f"Error evaluating expression: {str(e)}"

    return CalculatorTool()


def load_document_reader_tool(config: ToolConfig) -> Any:
    """Load document reader tool for accessing organization documents."""

    class DocumentReaderTool(Tool):
        name = "document_reader"
        description = "This tool reads and analyzes documents from your organization. It can access documents by ID and perform various operations like reading, summarizing, or searching within the document content."
        inputs = {
            "document_id": {
                "type": "string",
                "description": "The document ID or path to access. This should be a valid document identifier from your organization's document system."
            },
            "action": {
                "type": "string",
                "description": "The action to perform on the document. Options: 'read' (default), 'summarize', 'search'. Defaults to 'read'."
            },
            "search_query": {
                "type": "string",
                "description": "Optional search query when action is 'search'. Only used for searching within document content."
            }
        }
        output_type = "string"

        def forward(self, document_id: str, action: str = "read", search_query: str = "") -> str:
            """Read and analyze document based on the specified action."""
            try:
                # AIDEV-NOTE: This is a simplified implementation for reference-execution mapping
                # In production, this would integrate with the organization's document system
                # For now, return a mock response showing the mapping works

                if action == "read":
                    return f"✅ Document Reader: Successfully accessed document '{document_id}'\n\nThis would contain the full content of the document. The reference mapping from @doc:{document_id} to document_reader tool is working correctly."

                elif action == "summarize":
                    return f"✅ Document Reader: Summary of document '{document_id}'\n\nThis would contain a summary of the document content. The document reference has been properly mapped to the execution tool."

                elif action == "search":
                    if not search_query:
                        return f"Error: Search query is required when action is 'search'"
                    return f"✅ Document Reader: Search results for '{search_query}' in document '{document_id}'\n\nThis would contain search results within the document. The reference-to-execution mapping is functioning."

                else:
                    return f"Error: Unknown action '{action}'. Supported actions: read, summarize, search"

            except Exception as e:
                return f"Error accessing document '{document_id}': {str(e)}"

    return DocumentReaderTool()


def load_table_query_tool(config: ToolConfig) -> Any:
    """Load table query tool for accessing organization table data."""

    class TableQueryTool(Tool):
        name = "table_query"
        description = "This tool queries data from your organization tables. It can access tables by name and perform SQL queries or apply filters to retrieve specific data."
        inputs = {
            "table_name": {
                "type": "string",
                "description": "The name of the table to query. This should be a valid table name from your organization's database."
            },
            "query": {
                "type": "string",
                "description": "Optional SQL query or filter criteria to apply to the table. If not provided, returns basic table information."
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of rows to return. Defaults to 100 to prevent large result sets."
            }
        }
        output_type = "string"

        def forward(self, table_name: str, query: str = "", limit: int = 100) -> str:
            """Query table data based on the specified parameters."""
            try:
                # AIDEV-NOTE: This is a simplified implementation for reference-execution mapping
                # In production, this would integrate with the organization's table/database system
                # For now, return a mock response showing the mapping works

                if not query:
                    return f"✅ Table Query: Successfully accessed table '{table_name}'\n\nTable Information:\n- Rows: Available\n- Columns: Available\n- Status: Ready for querying\n\nThe reference mapping from @table:{table_name} to table_query tool is working correctly."

                else:
                    return f"✅ Table Query: Executed query on table '{table_name}'\n\nQuery: {query}\nLimit: {limit} rows\n\nThis would contain the actual query results. The table reference has been properly mapped to the execution tool."

            except Exception as e:
                return f"Error querying table '{table_name}': {str(e)}"

    return TableQueryTool()


# Registry of base tools
BASE_TOOLS = {
    "python_repl": load_python_repl,
    "web_search": load_web_search,
    "file_reader": load_file_reader,
    "calculator": load_calculator,
    "document_reader": load_document_reader_tool,
    "table_query": load_table_query_tool,
}