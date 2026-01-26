"""
Base Tools - Common tools for agents.

Ported from tools/base_tools.py - removes smolagents.Tool dependency.
"""

from __future__ import annotations

import ast
import math
import operator
from typing import Any, Callable


def create_file_reader_tool() -> Callable[[str], str]:
    """Factory: Create file reader function."""

    def file_reader(file_path: str) -> str:
        """Read and return the content of a text file from the filesystem.

        Args:
            file_path: The path to the text file to read.
                Must be a valid file path accessible to the system.

        Returns:
            The text content of the file, or an error message if reading fails.
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            return f"Error: File '{file_path}' not found."
        except PermissionError:
            return f"Error: Permission denied reading '{file_path}'."
        except UnicodeDecodeError:
            return f"Error: Unable to decode '{file_path}' as text file."
        except Exception as e:
            return f"Error reading file '{file_path}': {str(e)}"

    return file_reader


def create_calculator_tool() -> Callable[[str], str]:
    """Factory: Create calculator function with safe expression evaluation."""

    # Allowed math functions
    safe_functions = {
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "pow": pow,
        "sqrt": math.sqrt,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "log": math.log,
        "log10": math.log10,
        "exp": math.exp,
        "floor": math.floor,
        "ceil": math.ceil,
    }
    # Allowed constants
    safe_constants = {"pi": math.pi, "e": math.e}
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

    def _safe_eval(expression: str) -> Any:
        """Safely evaluate arithmetic expressions using AST parsing."""

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

        tree = ast.parse(expression, mode="eval")
        return _eval_node(tree)

    def calculator(expression: str) -> str:
        """Evaluate a mathematical expression and return the result.

        Supports basic arithmetic (+, -, *, /, **), parentheses, and common
        math functions like sqrt(), sin(), cos(), log(), etc.

        Args:
            expression: A mathematical expression to evaluate.
                Examples: '2 + 3 * 4', 'sqrt(16) + 5', 'sin(pi/2)'

        Returns:
            The result as a string, or an error message if evaluation fails.
        """
        try:
            result = _safe_eval(expression)
            return str(result)
        except ZeroDivisionError:
            return "Error: Division by zero."
        except ValueError as e:
            return f"Error: Invalid mathematical operation - {str(e)}"
        except SyntaxError:
            return "Error: Invalid mathematical expression syntax."
        except Exception as e:
            return f"Error evaluating expression: {str(e)}"

    return calculator


def create_document_reader_tool() -> Callable[..., str]:
    """Factory: Create document reader function."""

    def document_reader(
        document_id: str,
        action: str = "read",
        search_query: str = "",
    ) -> str:
        """Read and analyze documents from your organization.

        Args:
            document_id: The document ID or path to access.
                This should be a valid document identifier from your
                organization's document system.
            action: The action to perform on the document.
                Options: 'read' (default), 'summarize', 'search'.
            search_query: Optional search query when action is 'search'.
                Only used for searching within document content.

        Returns:
            Document content, summary, or search results depending on action.
        """
        try:
            if action == "read":
                return (
                    f"Document Reader: Successfully accessed document '{document_id}'\n\n"
                    f"This would contain the full content of the document."
                )
            elif action == "summarize":
                return (
                    f"Document Reader: Summary of document '{document_id}'\n\n"
                    f"This would contain a summary of the document content."
                )
            elif action == "search":
                if not search_query:
                    return "Error: Search query is required when action is 'search'"
                return (
                    f"Document Reader: Search results for '{search_query}' "
                    f"in document '{document_id}'\n\n"
                    f"This would contain search results within the document."
                )
            else:
                return f"Error: Unknown action '{action}'. Supported: read, summarize, search"
        except Exception as e:
            return f"Error accessing document '{document_id}': {str(e)}"

    return document_reader


def create_table_query_tool() -> Callable[..., str]:
    """Factory: Create table query function."""

    def table_query(
        table_name: str,
        query: str = "",
        limit: int = 100,
    ) -> str:
        """Query data from organization tables.

        Args:
            table_name: The name of the table to query.
                This should be a valid table name from your organization's database.
            query: Optional SQL query or filter criteria to apply.
                If not provided, returns basic table information.
            limit: Maximum number of rows to return. Defaults to 100.

        Returns:
            Table information or query results.
        """
        try:
            if not query:
                return (
                    f"Table Query: Successfully accessed table '{table_name}'\n\n"
                    f"Table Information:\n- Rows: Available\n- Columns: Available\n"
                    f"- Status: Ready for querying"
                )
            else:
                return (
                    f"Table Query: Executed query on table '{table_name}'\n\n"
                    f"Query: {query}\nLimit: {limit} rows\n\n"
                    f"This would contain the actual query results."
                )
        except Exception as e:
            return f"Error querying table '{table_name}': {str(e)}"

    return table_query
