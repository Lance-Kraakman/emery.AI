"""
Mock Data Tools Module

AIDEV-NOTE: Mock data analysis tools for testing scenarios.
Simulates Pandas, Matplotlib, and other data processing tools.
"""

from typing import Any, Dict
from smolagents import Tool
from ...core.entities import ToolConfig


def load_mock_pandas(config: ToolConfig) -> Any:
    """Load mock Pandas tool for testing data analysis scenarios."""
    try:
        class MockPandasTool(Tool):
            """Mock Pandas tool that simulates data analysis operations."""
            name = "pandas"
            description = "Mock Pandas for data loading and analysis"
            
            def forward(self, action: str = "load_data", **kwargs) -> Dict[str, Any]:
                """Simulate pandas operations."""
                if action == "load_data":
                    return {
                        "success": True,
                        "message": f"Mock data loaded from {kwargs.get('source', 'unknown source')}",
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
    """Load mock Matplotlib tool for testing visualization scenarios."""
    try:
        class MockMatplotlibTool(Tool):
            """Mock Matplotlib tool that simulates chart creation."""
            name = "matplotlib"
            description = "Mock Matplotlib for chart creation"
            
            def forward(self, chart_type: str = "line", **kwargs) -> Dict[str, Any]:
                """Simulate chart creation."""
                chart_types = ["line", "bar", "scatter", "pie", "histogram"]
                
                if chart_type not in chart_types:
                    return {"success": False, "error": f"Unsupported chart type: {chart_type}"}
                
                return {
                    "success": True,
                    "message": f"Mock {chart_type} chart created",
                    "chart_type": chart_type,
                    "data_points": kwargs.get('data_points', 50),
                    "title": kwargs.get('title', f'{chart_type.title()} Chart'),
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