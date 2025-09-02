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


# Registry of base tools
BASE_TOOLS = {
    "python_repl": load_python_repl,
    "web_search": load_web_search,
    "file_reader": load_file_reader,
    "calculator": load_calculator,
}