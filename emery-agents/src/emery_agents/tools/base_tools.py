"""Basic smolagents tools: Python REPL, web search, file reader, calculator."""

import ast
import math
import operator
import re
from typing import Any, Optional

from smolagents import Tool

from ..grpc.generated.agent_worker_pb2 import ToolConfig


def load_python_repl(config: ToolConfig) -> Tool:
    """Load Python REPL tool."""
    try:
        from smolagents import PythonInterpreterTool
        return PythonInterpreterTool()
    except ImportError:
        raise ValueError("PythonInterpreterTool not available - check smolagents installation")


def load_web_search(config: ToolConfig) -> Tool:
    """Load web search tool."""
    try:
        from smolagents import DuckDuckGoSearchTool
        return DuckDuckGoSearchTool()
    except ImportError:
        raise ValueError("DuckDuckGoSearchTool not available - check smolagents installation")


def load_file_reader(config: ToolConfig) -> Tool:
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


def load_calculator(config: ToolConfig) -> Tool:
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
            """Evaluate mathematical expression and return the result.

            SECURITY: Uses AST-based safe evaluation instead of eval().
            Only allows arithmetic operations and specific math functions.
            """
            try:
                result = self._safe_eval(expression)
                return str(result)
            except ZeroDivisionError:
                return "Error: Division by zero."
            except ValueError as e:
                return f"Error: Invalid mathematical operation - {str(e)}"
            except SyntaxError:
                return f"Error: Invalid mathematical expression syntax."
            except Exception as e:
                return f"Error evaluating expression: {str(e)}"

        def _safe_eval(self, expression: str) -> Any:
            """Safely evaluate arithmetic expressions using AST parsing.

            Supports: +, -, *, /, **, parentheses, and math functions.
            """
            # Allowed math functions
            safe_functions = {
                'abs': abs, 'round': round, 'min': min, 'max': max, 'pow': pow,
                'sqrt': math.sqrt, 'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
                'log': math.log, 'log10': math.log10, 'exp': math.exp,
                'floor': math.floor, 'ceil': math.ceil,
            }
            # Allowed constants
            safe_constants = {
                'pi': math.pi, 'e': math.e,
            }
            # Allowed operators
            safe_ops = {
                ast.Add: operator.add,
                ast.Sub: operator.sub,
                ast.Mult: operator.mul,
                ast.Div: operator.truediv,
                ast.Pow: operator.pow,
                ast.USub: operator.neg,
                ast.UAdd: operator.pos,
                ast.Mod: operator.mod,
                ast.FloorDiv: operator.floordiv,
            }

            def _eval_node(node: ast.AST) -> Any:
                if isinstance(node, ast.Expression):
                    return _eval_node(node.body)
                elif isinstance(node, ast.Constant):
                    if isinstance(node.value, (int, float)):
                        return node.value
                    raise ValueError(f"Unsupported constant type: {type(node.value)}")
                elif isinstance(node, ast.Num):  # Python 3.7 compatibility
                    return node.n
                elif isinstance(node, ast.BinOp):
                    left = _eval_node(node.left)
                    right = _eval_node(node.right)
                    op = safe_ops.get(type(node.op))
                    if op is None:
                        raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
                    return op(left, right)
                elif isinstance(node, ast.UnaryOp):
                    operand = _eval_node(node.operand)
                    op = safe_ops.get(type(node.op))
                    if op is None:
                        raise ValueError(f"Unsupported unary operator: {type(node.op).__name__}")
                    return op(operand)
                elif isinstance(node, ast.Call):
                    if not isinstance(node.func, ast.Name):
                        raise ValueError("Only simple function calls are allowed")
                    func_name = node.func.id
                    if func_name not in safe_functions:
                        raise ValueError(f"Function '{func_name}' is not allowed")
                    args = [_eval_node(arg) for arg in node.args]
                    return safe_functions[func_name](*args)
                elif isinstance(node, ast.Name):
                    if node.id in safe_constants:
                        return safe_constants[node.id]
                    raise ValueError(f"Unknown variable: {node.id}")
                else:
                    raise ValueError(f"Unsupported expression type: {type(node).__name__}")

            tree = ast.parse(expression, mode='eval')
            return _eval_node(tree)

    return CalculatorTool()


def load_document_reader_tool(config: ToolConfig) -> Tool:
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


def load_table_query_tool(config: ToolConfig) -> Tool:
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