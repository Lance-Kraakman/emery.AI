"""
Mock Data Tools Module

AIDEV-NOTE: Mock data analysis tools for testing scenarios.
Simulates Pandas, Matplotlib, and other data processing tools.
"""

from typing import Any, Dict
from smolagents import Tool
from ..grpc.generated.agent_worker_pb2 import ToolConfig


def load_mock_pandas(config: ToolConfig) -> Any:
    """Load mock Pandas tool for testing data analysis scenarios with DDD validation."""
    # Validate ToolConfig using DDD patterns
    if not config or not config.name:
        raise ValueError("ToolConfig must have a name")
    
    if config.name != "pandas":
        raise ValueError(f"Expected tool name 'pandas', got '{config.name}'")
    
    try:
        class MockPandasTool(Tool):
            """Mock Pandas tool that simulates data analysis operations."""
            name = "pandas"
            description = "Mock Pandas for data loading and analysis"
            inputs = {
                "action": {
                    "type": "string",
                    "description": "Data action to perform (load_data, analyze)",
                    "nullable": True
                }
            }
            output_type = "object"
            
            def forward(self, action: str = "load_data") -> Dict[str, Any]:
                """Simulate pandas operations."""
                if action == "load_data":
                    return {
                        "success": True,
                        "message": f"Mock data loaded from test_data.csv",
                        "rows": 1000,
                        "columns": ["id", "name", "value", "category", "timestamp"],
                        "preview": [
                            {"id": 1, "name": "Product A", "value": 150.0, "category": "electronics", "timestamp": "2024-01-15"},
                            {"id": 2, "name": "Product B", "value": 89.5, "category": "clothing", "timestamp": "2024-01-15"},
                            {"id": 3, "name": "Product C", "value": 220.0, "category": "electronics", "timestamp": "2024-01-16"}
                        ]
                    }
                elif action == "analyze":
                    return {
                        "success": True,
                        "message": "Data analysis completed",
                        "statistics": {
                            "total_rows": 1000,
                            "mean_value": 165.2,
                            "max_value": 450.0,
                            "min_value": 12.5,
                            "categories": ["electronics", "clothing", "home", "books"]
                        },
                        "insights": [
                            "Electronics category has highest average value",
                            "Sales peak on weekends",
                            "Strong correlation between price and customer satisfaction"
                        ]
                    }
                else:
                    return {"success": False, "error": f"Unknown action: {action}"}
        
        return MockPandasTool()
    except ImportError:
        raise ValueError("smolagents not available - check smolagents installation")


def load_mock_matplotlib(config: ToolConfig) -> Any:
    """Load mock Matplotlib tool for testing visualization scenarios with DDD validation."""
    # Validate ToolConfig using DDD patterns
    if not config or not config.name:
        raise ValueError("ToolConfig must have a name")
    
    if config.name != "matplotlib":
        raise ValueError(f"Expected tool name 'matplotlib', got '{config.name}'")
    
    try:
        class MockMatplotlibTool(Tool):
            """Mock Matplotlib tool that simulates chart creation."""
            name = "matplotlib"
            description = "Mock Matplotlib for chart creation"
            inputs = {
                "chart_type": {
                    "type": "string",
                    "description": "Type of chart to create (line, bar, scatter, pie, histogram)",
                    "nullable": True
                }
            }
            output_type = "object"
            
            def forward(self, chart_type: str = "line") -> Dict[str, Any]:
                """Simulate chart creation."""
                chart_types = ["line", "bar", "scatter", "pie", "histogram"]
                
                if chart_type not in chart_types:
                    return {"success": False, "error": f"Unsupported chart type: {chart_type}"}
                
                return {
                    "success": True,
                    "message": f"Mock {chart_type} chart created",
                    "chart_type": chart_type,
                    "data_points": 50,
                    "title": f'{chart_type.title()} Chart',
                    "file_path": f"/tmp/mock_{chart_type}_chart.png",
                    "insights": [
                        f"Chart shows clear {chart_type} pattern",
                        "Data visualization completed successfully",
                        f"Recommended for {chart_type} data presentation"
                    ]
                }
        
        return MockMatplotlibTool()
    except ImportError:
        raise ValueError("smolagents not available - check smolagents installation")


# Registry of data tools
DATA_TOOLS = {
    "pandas": load_mock_pandas,
    "matplotlib": load_mock_matplotlib,
}