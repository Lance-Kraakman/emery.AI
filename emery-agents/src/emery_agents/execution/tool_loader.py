"""
Simple Tool Loader

AIDEV-NOTE: Simplified tool loading for protobuf ToolConfig.
No complex registry patterns - just direct tool instantiation.
"""

from typing import Any, Dict, List
from ..core.entities import ToolConfig


class ToolLoader:
    """Simple tool loader for smolagents tools."""
    
    def __init__(self):
        """Initialize tool loader with known tools."""
        # AIDEV-NOTE: Start with basic tools, expand as needed
        self._tool_registry = {
            "python_repl": self._load_python_repl,
            "web_search": self._load_web_search,
            "file_reader": self._load_file_reader,
            "calculator": self._load_calculator,
            # Mock tools for testing scenarios
            "gmail_api": self._load_mock_gmail,
            "pandas": self._load_mock_pandas,
            "matplotlib": self._load_mock_matplotlib,
            # Emery database mock tools
            "emery_database": self._load_mock_emery_database,
            "table_schema": self._load_mock_table_schema,
            "table_data": self._load_mock_table_data,
        }
    
    def load_tool(self, tool_config: ToolConfig) -> Any:
        """
        Load a tool instance from ToolConfig.
        
        Args:
            tool_config: Tool configuration from protobuf
            
        Returns:
            Tool instance for smolagents
            
        Raises:
            ValueError: If tool not found or cannot be loaded
        """
        tool_name = tool_config.name.lower()
        
        if tool_name not in self._tool_registry:
            raise ValueError(f"Unknown tool: {tool_config.name}")
        
        loader_func = self._tool_registry[tool_name]
        return loader_func(tool_config)
    
    def load_tools(self, tool_configs: List[ToolConfig]) -> List[Any]:
        """Load multiple tools from configurations."""
        return [self.load_tool(config) for config in tool_configs]
    
    def list_available_tools(self) -> List[str]:
        """List all available tool names."""
        return list(self._tool_registry.keys())
    
    def _load_python_repl(self, config: ToolConfig) -> Any:
        """Load Python REPL tool."""
        try:
            from smolagents.tools import PythonInterpreterTool
            return PythonInterpreterTool()
        except ImportError:
            raise ValueError("PythonInterpreterTool not available - check smolagents installation")
    
    def _load_web_search(self, config: ToolConfig) -> Any:
        """Load web search tool."""
        try:
            from smolagents.tools import DuckDuckGoSearchTool
            return DuckDuckGoSearchTool()
        except ImportError:
            raise ValueError("DuckDuckGoSearchTool not available - check smolagents installation")
    
    def _load_file_reader(self, config: ToolConfig) -> Any:
        """Load file reader tool."""
        # AIDEV-TODO: Implement file reader tool
        # For now, use a placeholder
        class FileReaderTool:
            def __call__(self, file_path: str) -> str:
                with open(file_path, 'r') as f:
                    return f.read()
        
        return FileReaderTool()
    
    def _load_calculator(self, config: ToolConfig) -> Any:
        """Load calculator tool."""
        # AIDEV-TODO: Implement calculator tool or use existing one
        class CalculatorTool:
            def __call__(self, expression: str) -> float:
                # Simple eval - in production use safer math parser
                return eval(expression)
        
        return CalculatorTool()
    
    def _load_mock_gmail(self, config: ToolConfig) -> Any:
        """Load mock Gmail API tool for testing."""
        try:
            from smolagents import Tool
            
            class MockGmailTool(Tool):
                """Mock Gmail tool that simulates email operations."""
                name = "gmail_api"
                description = "Mock Gmail API for sending and reading emails"
                
                def forward(self, action: str = "send_email", **kwargs) -> Dict[str, Any]:
                    """Main tool interface."""
                    if action == "send_email":
                        return self.send_email(**kwargs)
                    elif action == "read_emails":
                        return self.read_emails(**kwargs)
                    elif action == "categorize_emails":
                        return self.categorize_emails(**kwargs)
                    else:
                        return {"error": f"Unknown Gmail action: {action}"}
                
                def send_email(self, to: str = "user@example.com", subject: str = "Test", body: str = "Hello") -> Dict[str, Any]:
                    """Mock email sending."""
                    return {
                        "status": "sent",
                        "message_id": f"msg_{hash(to + subject)%10000:04d}",
                        "to": to,
                        "subject": subject,
                        "timestamp": "2024-01-15T10:30:00Z"
                    }
                
                def read_emails(self, folder: str = "inbox", limit: int = 5) -> Dict[str, Any]:
                    """Mock email reading."""
                    mock_emails = [
                        {
                            "id": "email_001",
                            "from": "customer1@example.com",
                            "subject": "Love your product!",
                            "body": "Just wanted to say your service is amazing. Keep up the great work!",
                            "sentiment": "positive",
                            "timestamp": "2024-01-15T09:00:00Z"
                        },
                        {
                            "id": "email_002", 
                            "from": "customer2@company.com",
                            "subject": "Issue with delivery",
                            "body": "My order was delayed and I'm not happy about it. Please resolve this.",
                            "sentiment": "negative",
                            "timestamp": "2024-01-15T08:30:00Z"
                        },
                        {
                            "id": "email_003",
                            "from": "partner@business.org",
                            "subject": "Partnership proposal",
                            "body": "We'd like to discuss a potential partnership opportunity.",
                            "sentiment": "neutral",
                            "timestamp": "2024-01-15T07:45:00Z"
                        }
                    ]
                    
                    return {
                        "folder": folder,
                        "count": len(mock_emails[:limit]),
                        "emails": mock_emails[:limit]
                    }
                
                def categorize_emails(self, emails: List[Dict] = None) -> Dict[str, Any]:
                    """Mock email categorization."""
                    if not emails:
                        emails = self.read_emails()["emails"]
                    
                    categories = {
                        "positive": [],
                        "negative": [],
                        "neutral": [],
                        "urgent": []
                    }
                    
                    for email in emails:
                        sentiment = email.get("sentiment", "neutral")
                        categories[sentiment].append(email["id"])
                        
                        # Mark some as urgent based on keywords
                        if any(word in email["subject"].lower() for word in ["urgent", "asap", "emergency", "issue"]):
                            categories["urgent"].append(email["id"])
                    
                    return {
                        "total_processed": len(emails),
                        "categories": categories,
                        "summary": f"Processed {len(emails)} emails: {len(categories['positive'])} positive, {len(categories['negative'])} negative, {len(categories['neutral'])} neutral"
                    }
            
            return MockGmailTool()
        except ImportError:
            raise ValueError("smolagents not available - check smolagents installation")
    
    def _load_mock_pandas(self, config: ToolConfig) -> Any:
        """Load mock Pandas tool for testing."""
        try:
            from smolagents import Tool
            
            class MockPandasTool(Tool):
                """Mock Pandas tool that simulates data analysis operations."""
                name = "pandas"
                description = "Mock Pandas for data loading and analysis"
                
                def forward(self, action: str = "load_data", **kwargs) -> Dict[str, Any]:
                    """Main tool interface."""
                    if action == "load_data":
                        return self.load_data(**kwargs)
                    elif action == "analyze_data":
                        return self.analyze_data(**kwargs)
                    elif action == "create_summary":
                        return self.create_summary(**kwargs)
                    else:
                        return {"error": f"Unknown Pandas action: {action}"}
            
            def load_data(self, source: str = "sales_data.csv", **kwargs) -> Dict[str, Any]:
                """Mock data loading."""
                # Simulate different data sources
                if "sales" in source.lower():
                    return {
                        "source": source,
                        "rows": 1250,
                        "columns": 8,
                        "columns_list": ["date", "product", "sales_amount", "region", "customer_type", "discount", "profit_margin", "sales_rep"],
                        "date_range": "2024-01-01 to 2024-12-31",
                        "total_sales": 485750.25,
                        "preview": {
                            "sample_records": [
                                {"date": "2024-01-15", "product": "Widget A", "sales_amount": 125.50, "region": "North"},
                                {"date": "2024-01-16", "product": "Widget B", "sales_amount": 89.75, "region": "South"}
                            ]
                        }
                    }
                else:
                    return {
                        "source": source,
                        "rows": 500,
                        "columns": 5,
                        "message": f"Loaded generic dataset from {source}"
                    }
            
            def analyze_data(self, data_source: str = None, analysis_type: str = "summary", **kwargs) -> Dict[str, Any]:
                """Mock data analysis."""
                return {
                    "analysis_type": analysis_type,
                    "key_metrics": {
                        "total_revenue": 485750.25,
                        "average_order_value": 388.60,
                        "growth_rate": "+12.3%",
                        "top_product": "Widget A",
                        "best_region": "North"
                    },
                    "trends": [
                        "Sales increased by 15% in Q4 compared to Q3",
                        "North region outperformed other regions by 23%",
                        "Widget A consistently top performer with 35% market share",
                        "Customer retention improved by 8% year-over-year"
                    ],
                    "recommendations": [
                        "Increase inventory for Widget A in North region",
                        "Investigate underperformance in South region",
                        "Launch targeted campaign for Q1 to maintain momentum"
                    ]
                }
            
            def create_summary(self, **kwargs) -> Dict[str, Any]:
                """Mock summary creation."""
                return {
                    "summary_type": "monthly_report",
                    "period": "December 2024",
                    "highlights": [
                        "Record monthly sales of $52,480",
                        "12 new customers acquired",
                        "95% customer satisfaction rate",
                        "3 new products launched successfully"
                    ],
                    "charts_created": [
                        "Monthly sales trend line chart",
                        "Regional performance bar chart", 
                        "Product mix pie chart",
                        "Customer acquisition funnel"
                    ],
                    "status": "Report generated successfully"
                }
        
            return MockPandasTool()
        except ImportError:
            raise ValueError("smolagents not available - check smolagents installation")
    
    def _load_mock_matplotlib(self, config: ToolConfig) -> Any:
        """Load mock Matplotlib tool for testing."""
        try:
            from smolagents import Tool
            
            class MockMatplotlibTool(Tool):
                """Mock Matplotlib tool that simulates chart creation."""
                name = "matplotlib"
                description = "Mock Matplotlib for chart creation"
                
                def forward(self, chart_type: str = "line", **kwargs) -> Dict[str, Any]:
                    """Main tool interface."""
                    return self.create_chart(chart_type, **kwargs)
            
            def create_chart(self, chart_type: str = "line", title: str = "Chart", data: Dict = None, **kwargs) -> Dict[str, Any]:
                """Mock chart creation."""
                chart_descriptions = {
                    "line": f"Line chart showing trends over time: {title}",
                    "bar": f"Bar chart comparing categories: {title}",
                    "pie": f"Pie chart showing distribution: {title}",
                    "scatter": f"Scatter plot showing correlation: {title}",
                    "histogram": f"Histogram showing frequency distribution: {title}"
                }
                
                return {
                    "chart_type": chart_type,
                    "title": title,
                    "description": chart_descriptions.get(chart_type, f"Chart of type {chart_type}: {title}"),
                    "file_path": f"/tmp/mock_chart_{chart_type}_{hash(title)%1000}.png",
                    "dimensions": "800x600 pixels",
                    "status": "Chart created successfully",
                    "data_points": len(data) if data else 20,
                    "style_info": {
                        "color_scheme": "blue_gradient",
                        "grid": True,
                        "legend": True,
                        "axes_labels": kwargs.get("axes_labels", {"x": "Time", "y": "Value"})
                    }
                }
        
            return MockMatplotlibTool()
        except ImportError:
            raise ValueError("smolagents not available - check smolagents installation")
    
    def _load_mock_emery_database(self, config: ToolConfig) -> Any:
        """Load mock Emery Database tool for testing."""
        try:
            from smolagents import Tool
            
            class MockEmeryDatabaseTool(Tool):
                """Mock Emery Database tool that simulates table listing operations."""
                name = "emery_database"
                description = "Mock Emery Database for listing tables in an organization"
                inputs = {
                    "database_id": {"type": "integer", "description": "Database ID to list tables from", "nullable": True},
                    "organization_id": {"type": "integer", "description": "Organization ID", "nullable": True}
                }
                output_type = "object"
                
                def __init__(self):
                    super().__init__()
                    # Sample database structure with realistic data
                    self.databases = {
                        1: {"id": 1, "name": "Main Database", "organizationId": 1, "slug": "main-db"}
                    }
                    
                    self.tables = {
                        1: {
                            "id": 1, "name": "Customers", "dbName": "customers_table", 
                            "databaseId": 1, "organizationId": 1,
                            "metadata": {"description": "Customer information and contacts"},
                            "createdAt": "2024-01-10T08:00:00Z", "createdBy": "user_123"
                        },
                        2: {
                            "id": 2, "name": "Orders", "dbName": "orders_table",
                            "databaseId": 1, "organizationId": 1, 
                            "metadata": {"description": "Customer orders and transactions"},
                            "createdAt": "2024-01-10T08:05:00Z", "createdBy": "user_123"
                        },
                        3: {
                            "id": 3, "name": "Products", "dbName": "products_table",
                            "databaseId": 1, "organizationId": 1,
                            "metadata": {"description": "Product catalog and inventory"},
                            "createdAt": "2024-01-10T08:10:00Z", "createdBy": "user_123"  
                        },
                        4: {
                            "id": 4, "name": "Tasks", "dbName": "tasks_table", 
                            "databaseId": 1, "organizationId": 1,
                            "metadata": {"description": "Project tasks and assignments"},
                            "createdAt": "2024-01-10T08:15:00Z", "createdBy": "user_123"
                        }
                    }
                    self.next_table_id = 5
                
                def forward(self, database_id: int = 1, organization_id: int = 1) -> Dict[str, Any]:
                    """List tables in the specified database."""
                    return self.list_tables(database_id, organization_id)
                
                def list_tables(self, database_id: int = 1, organization_id: int = 1) -> Dict[str, Any]:
                    """List all tables in database."""
                    filtered_tables = [
                        table for table in self.tables.values() 
                        if table["databaseId"] == database_id and table["organizationId"] == organization_id
                    ]
                    
                    return {
                        "success": True,
                        "tables": filtered_tables,
                        "count": len(filtered_tables),
                        "databaseId": database_id
                    }
                
                
                def _get_row_count(self, tableId: int) -> int:
                    """Simulate row counts for different tables."""
                    row_counts = {1: 25, 2: 87, 3: 156, 4: 43}
                    return row_counts.get(tableId, 0)
                
                def _get_field_count(self, tableId: int) -> int:
                    """Simulate field counts for different tables."""
                    field_counts = {1: 6, 2: 8, 3: 10, 4: 7}
                    return field_counts.get(tableId, 0)
            
            return MockEmeryDatabaseTool()
        except ImportError:
            raise ValueError("smolagents not available - check smolagents installation")
    
    def _load_mock_table_schema(self, config: ToolConfig) -> Any:
        """Load mock Table Schema tool for testing."""
        try:
            from smolagents import Tool
            
            class MockTableSchemaTool(Tool):
                """Mock Table Schema tool that simulates field listing operations."""
                name = "table_schema"
                description = "Mock Table Schema for listing fields in a table"
                inputs = {
                    "table_id": {"type": "integer", "description": "Table ID to list fields for"},
                }
                output_type = "object"
                
                def __init__(self):
                    super().__init__()
                    # Sample field structures for different tables
                    self.fields = {
                        # Customers table fields
                        1: {
                            10: {"id": 10, "tableId": 1, "name": "Name", "slug": "name", "type": "text", "required": True, "orderIndex": 1},
                            11: {"id": 11, "tableId": 1, "name": "Email", "slug": "email", "type": "email", "required": True, "orderIndex": 2},
                            12: {"id": 12, "tableId": 1, "name": "Company", "slug": "company", "type": "text", "required": False, "orderIndex": 3},
                            13: {"id": 13, "tableId": 1, "name": "Phone", "slug": "phone", "type": "text", "required": False, "orderIndex": 4},
                            14: {"id": 14, "tableId": 1, "name": "Active", "slug": "active", "type": "boolean", "required": False, "orderIndex": 5},
                            15: {"id": 15, "tableId": 1, "name": "Orders", "slug": "orders", "type": "relation", "required": False, "relatedTableId": 2, "orderIndex": 6}
                        },
                        # Orders table fields
                        2: {
                            20: {"id": 20, "tableId": 2, "name": "Order Number", "slug": "order_number", "type": "text", "required": True, "orderIndex": 1},
                            21: {"id": 21, "tableId": 2, "name": "Customer", "slug": "customer", "type": "relation", "required": True, "relatedTableId": 1, "orderIndex": 2},
                            22: {"id": 22, "tableId": 2, "name": "Product", "slug": "product", "type": "relation", "required": True, "relatedTableId": 3, "orderIndex": 3},
                            23: {"id": 23, "tableId": 2, "name": "Quantity", "slug": "quantity", "type": "number", "required": True, "orderIndex": 4},
                            24: {"id": 24, "tableId": 2, "name": "Total Amount", "slug": "total_amount", "type": "number", "required": True, "orderIndex": 5},
                            25: {"id": 25, "tableId": 2, "name": "Order Date", "slug": "order_date", "type": "date", "required": True, "orderIndex": 6},
                            26: {"id": 26, "tableId": 2, "name": "Status", "slug": "status", "type": "text", "required": True, "orderIndex": 7},
                            27: {"id": 27, "tableId": 2, "name": "Shipped", "slug": "shipped", "type": "boolean", "required": False, "orderIndex": 8}
                        },
                        # Products table fields  
                        3: {
                            30: {"id": 30, "tableId": 3, "name": "Product Name", "slug": "product_name", "type": "text", "required": True, "orderIndex": 1},
                            31: {"id": 31, "tableId": 3, "name": "SKU", "slug": "sku", "type": "text", "required": True, "orderIndex": 2},
                            32: {"id": 32, "tableId": 3, "name": "Description", "slug": "description", "type": "text", "required": False, "orderIndex": 3},
                            33: {"id": 33, "tableId": 3, "name": "Price", "slug": "price", "type": "number", "required": True, "orderIndex": 4},
                            34: {"id": 34, "tableId": 3, "name": "Category", "slug": "category", "type": "text", "required": False, "orderIndex": 5},
                            35: {"id": 35, "tableId": 3, "name": "In Stock", "slug": "in_stock", "type": "boolean", "required": False, "orderIndex": 6},
                            36: {"id": 36, "tableId": 3, "name": "Website", "slug": "website", "type": "url", "required": False, "orderIndex": 7},
                            37: {"id": 37, "tableId": 3, "name": "Stock Quantity", "slug": "stock_quantity", "type": "number", "required": False, "orderIndex": 8},
                            38: {"id": 38, "tableId": 3, "name": "Last Restocked", "slug": "last_restocked", "type": "date", "required": False, "orderIndex": 9},
                            39: {"id": 39, "tableId": 3, "name": "Orders", "slug": "orders", "type": "relation", "required": False, "relatedTableId": 2, "orderIndex": 10}
                        },
                        # Tasks table fields
                        4: {
                            40: {"id": 40, "tableId": 4, "name": "Task Title", "slug": "task_title", "type": "text", "required": True, "orderIndex": 1},
                            41: {"id": 41, "tableId": 4, "name": "Description", "slug": "description", "type": "text", "required": False, "orderIndex": 2},
                            42: {"id": 42, "tableId": 4, "name": "Assignee", "slug": "assignee", "type": "text", "required": False, "orderIndex": 3},
                            43: {"id": 43, "tableId": 4, "name": "Priority", "slug": "priority", "type": "text", "required": False, "orderIndex": 4},
                            44: {"id": 44, "tableId": 4, "name": "Due Date", "slug": "due_date", "type": "date", "required": False, "orderIndex": 5},
                            45: {"id": 45, "tableId": 4, "name": "Completed", "slug": "completed", "type": "boolean", "required": False, "orderIndex": 6},
                            46: {"id": 46, "tableId": 4, "name": "Customer", "slug": "customer", "type": "relation", "required": False, "relatedTableId": 1, "orderIndex": 7}
                        }
                    }
                    self.next_field_id = 100
                
                def forward(self, table_id: int) -> Dict[str, Any]:
                    """List fields for the specified table."""
                    return self.list_fields(table_id)
                
                def list_fields(self, table_id: int) -> Dict[str, Any]:
                    """List all fields for a table."""
                    if table_id not in self.fields:
                        return {"success": False, "error": f"No fields found for table {table_id}"}
                    
                    fields_list = list(self.fields[table_id].values())
                    # Sort by orderIndex
                    fields_list.sort(key=lambda f: f.get("orderIndex", 999))
                    
                    return {
                        "success": True,
                        "fields": fields_list,
                        "count": len(fields_list),
                        "tableId": table_id
                    }
                
            
            return MockTableSchemaTool()
        except ImportError:
            raise ValueError("smolagents not available - check smolagents installation")
    
    def _load_mock_table_data(self, config: ToolConfig) -> Any:
        """Load mock Table Data tool for testing."""
        try:
            from smolagents import Tool
            import uuid
            from datetime import datetime
            import json
            
            class MockTableDataTool(Tool):
                """Mock Table Data tool that simulates row listing operations."""
                name = "table_data"
                description = "Mock Table Data for listing rows in a table"
                inputs = {
                    "table_id": {"type": "integer", "description": "Table ID to get rows from"},
                    "limit": {"type": "integer", "description": "Maximum number of rows to return", "nullable": True},
                    "offset": {"type": "integer", "description": "Number of rows to skip", "nullable": True}
                }
                output_type = "object"
                
                def __init__(self):
                    super().__init__()
                    # Sample row data with field_{id} mapping (Baserow-style)
                    self.rows = {
                        # Customers table (tableId: 1)
                        1: {
                            "cust_001": {
                                "id": "cust_001", "created_at": "2024-01-10T09:00:00Z", "updated_at": "2024-01-10T09:00:00Z",
                                "field_10": "Acme Corporation", "field_11": "contact@acme.com", "field_12": "Technology", 
                                "field_13": "555-0123", "field_14": True,
                                "field_15": [{"id": "ord_001", "value": "Order #1001", "tableId": 2}, {"id": "ord_002", "value": "Order #1002", "tableId": 2}]
                            },
                            "cust_002": {
                                "id": "cust_002", "created_at": "2024-01-10T09:15:00Z", "updated_at": "2024-01-10T09:15:00Z",
                                "field_10": "Beta Solutions", "field_11": "info@betasolutions.com", "field_12": "Consulting",
                                "field_13": "555-0124", "field_14": True,
                                "field_15": [{"id": "ord_003", "value": "Order #1003", "tableId": 2}]
                            },
                            "cust_003": {
                                "id": "cust_003", "created_at": "2024-01-10T09:30:00Z", "updated_at": "2024-01-10T09:30:00Z",
                                "field_10": "Gamma Industries", "field_11": "hello@gamma.net", "field_12": "Manufacturing",
                                "field_13": "555-0125", "field_14": False,
                                "field_15": []
                            }
                        },
                        # Orders table (tableId: 2)
                        2: {
                            "ord_001": {
                                "id": "ord_001", "created_at": "2024-01-11T10:00:00Z", "updated_at": "2024-01-11T10:00:00Z",
                                "field_20": "ORD-1001", 
                                "field_21": [{"id": "cust_001", "value": "Acme Corporation", "tableId": 1}],
                                "field_22": [{"id": "prod_001", "value": "Widget Pro", "tableId": 3}],
                                "field_23": 5, "field_24": 2500.00, "field_25": "2024-01-11", "field_26": "shipped", "field_27": True
                            },
                            "ord_002": {
                                "id": "ord_002", "created_at": "2024-01-11T14:00:00Z", "updated_at": "2024-01-11T14:00:00Z",
                                "field_20": "ORD-1002",
                                "field_21": [{"id": "cust_001", "value": "Acme Corporation", "tableId": 1}],
                                "field_22": [{"id": "prod_002", "value": "Widget Basic", "tableId": 3}],
                                "field_23": 10, "field_24": 1200.00, "field_25": "2024-01-11", "field_26": "processing", "field_27": False
                            },
                            "ord_003": {
                                "id": "ord_003", "created_at": "2024-01-12T08:00:00Z", "updated_at": "2024-01-12T08:00:00Z",
                                "field_20": "ORD-1003",
                                "field_21": [{"id": "cust_002", "value": "Beta Solutions", "tableId": 1}],
                                "field_22": [{"id": "prod_003", "value": "Widget Advanced", "tableId": 3}],
                                "field_23": 2, "field_24": 800.00, "field_25": "2024-01-12", "field_26": "pending", "field_27": False
                            }
                        },
                        # Products table (tableId: 3)
                        3: {
                            "prod_001": {
                                "id": "prod_001", "created_at": "2024-01-05T12:00:00Z", "updated_at": "2024-01-10T12:00:00Z",
                                "field_30": "Widget Pro", "field_31": "WGT-PRO-001", "field_32": "Professional grade widget with advanced features",
                                "field_33": 500.00, "field_34": "Widgets", "field_35": True, "field_36": "https://widgets.com/pro", 
                                "field_37": 25, "field_38": "2024-01-01", 
                                "field_39": [{"id": "ord_001", "value": "Order #1001", "tableId": 2}]
                            },
                            "prod_002": {
                                "id": "prod_002", "created_at": "2024-01-05T12:15:00Z", "updated_at": "2024-01-10T12:15:00Z",
                                "field_30": "Widget Basic", "field_31": "WGT-BSC-001", "field_32": "Basic widget for everyday use",
                                "field_33": 120.00, "field_34": "Widgets", "field_35": True, "field_36": "https://widgets.com/basic",
                                "field_37": 50, "field_38": "2024-01-05",
                                "field_39": [{"id": "ord_002", "value": "Order #1002", "tableId": 2}]
                            },
                            "prod_003": {
                                "id": "prod_003", "created_at": "2024-01-05T12:30:00Z", "updated_at": "2024-01-10T12:30:00Z",
                                "field_30": "Widget Advanced", "field_31": "WGT-ADV-001", "field_32": "Advanced widget with premium features",
                                "field_33": 400.00, "field_34": "Widgets", "field_35": True, "field_36": "https://widgets.com/advanced",
                                "field_37": 15, "field_38": "2024-01-03",
                                "field_39": [{"id": "ord_003", "value": "Order #1003", "tableId": 2}]
                            }
                        },
                        # Tasks table (tableId: 4)
                        4: {
                            "task_001": {
                                "id": "task_001", "created_at": "2024-01-12T09:00:00Z", "updated_at": "2024-01-13T09:00:00Z",
                                "field_40": "Follow up with Acme Corp", "field_41": "Send thank you email and check satisfaction",
                                "field_42": "John Smith", "field_43": "high", "field_44": "2024-01-15", "field_45": False,
                                "field_46": [{"id": "cust_001", "value": "Acme Corporation", "tableId": 1}]
                            },
                            "task_002": {
                                "id": "task_002", "created_at": "2024-01-12T10:30:00Z", "updated_at": "2024-01-12T10:30:00Z",
                                "field_40": "Process Beta Solutions order", "field_41": "Prepare shipping and tracking info",
                                "field_42": "Jane Doe", "field_43": "medium", "field_44": "2024-01-14", "field_45": True,
                                "field_46": [{"id": "cust_002", "value": "Beta Solutions", "tableId": 1}]
                            },
                            "task_003": {
                                "id": "task_003", "created_at": "2024-01-13T08:00:00Z", "updated_at": "2024-01-13T08:00:00Z",
                                "field_40": "Restock Widget Advanced", "field_41": "Order more inventory from supplier",
                                "field_42": "Mike Johnson", "field_43": "medium", "field_44": "2024-01-18", "field_45": False,
                                "field_46": []
                            }
                        }
                    }
                
                def forward(self, table_id: int, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
                    """Get rows from the specified table."""
                    return self.get_rows(table_id, limit, offset)
                
                def get_rows(self, table_id: int, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
                    """Get rows from table with pagination."""
                    if table_id not in self.rows:
                        return {"success": False, "error": f"No data found for table {table_id}"}
                    
                    table_rows = list(self.rows[table_id].values())
                    
                    # Apply pagination
                    total_count = len(table_rows)
                    paginated_rows = table_rows[offset:offset + limit]
                    
                    return {
                        "success": True,
                        "rows": paginated_rows,
                        "count": len(paginated_rows),
                        "totalCount": total_count,
                        "offset": offset,
                        "limit": limit,
                        "tableId": table_id
                    }
                
                def create_row(self, tableId: int, data: Dict[str, Any]) -> Dict[str, Any]:
                    """Create new row in table."""
                    if tableId not in self.rows:
                        self.rows[tableId] = {}
                    
                    # Generate unique ID
                    row_id = str(uuid.uuid4())
                    timestamp = datetime.now().isoformat() + "Z"
                    
                    # Create new row with system fields
                    new_row = {
                        "id": row_id,
                        "created_at": timestamp,
                        "updated_at": timestamp,
                        **data  # User-provided field data
                    }
                    
                    self.rows[tableId][row_id] = new_row
                    
                    return {
                        "success": True,
                        "message": "Row created successfully",
                        "row": new_row,
                        "rowId": row_id
                    }
                
                def update_row(self, tableId: int, rowId: str, data: Dict[str, Any]) -> Dict[str, Any]:
                    """Update existing row."""
                    if tableId not in self.rows or rowId not in self.rows[tableId]:
                        return {"success": False, "error": f"Row {rowId} not found in table {tableId}"}
                    
                    # Update row data
                    row = self.rows[tableId][rowId]
                    row.update(data)
                    row["updated_at"] = datetime.now().isoformat() + "Z"
                    
                    return {
                        "success": True,
                        "message": "Row updated successfully",
                        "row": row,
                        "rowId": rowId
                    }
                
                def delete_row(self, tableId: int, rowId: str) -> Dict[str, Any]:
                    """Delete row."""
                    if tableId not in self.rows or rowId not in self.rows[tableId]:
                        return {"success": False, "error": f"Row {rowId} not found in table {tableId}"}
                    
                    del self.rows[tableId][rowId]
                    
                    return {
                        "success": True,
                        "message": "Row deleted successfully",
                        "deletedRowId": rowId
                    }
                
                def search_rows(self, tableId: int, query: str, fields: List[str] = None, limit: int = 100) -> Dict[str, Any]:
                    """Search rows by text query across specified fields."""
                    if tableId not in self.rows:
                        return {"success": False, "error": f"No data found for table {tableId}"}
                    
                    table_rows = list(self.rows[tableId].values())
                    matching_rows = []
                    
                    query_lower = query.lower()
                    
                    for row in table_rows:
                        # If specific fields provided, search only those
                        search_fields = fields if fields else row.keys()
                        
                        for field in search_fields:
                            if field in row:
                                field_value = str(row[field]).lower()
                                if query_lower in field_value:
                                    matching_rows.append(row)
                                    break  # Avoid duplicates
                    
                    # Apply limit
                    limited_rows = matching_rows[:limit]
                    
                    return {
                        "success": True,
                        "query": query,
                        "rows": limited_rows,
                        "count": len(limited_rows),
                        "totalMatches": len(matching_rows),
                        "tableId": tableId
                    }
                
                def get_row_stats(self, tableId: int) -> Dict[str, Any]:
                    """Get statistics about table data."""
                    if tableId not in self.rows:
                        return {"success": False, "error": f"No data found for table {tableId}"}
                    
                    table_rows = list(self.rows[tableId].values())
                    
                    if not table_rows:
                        return {
                            "success": True,
                            "tableId": tableId,
                            "totalRows": 0,
                            "stats": {}
                        }
                    
                    # Basic statistics
                    stats = {
                        "totalRows": len(table_rows),
                        "fieldsWithData": {},
                        "recentActivity": {
                            "lastCreated": max([row.get("created_at", "") for row in table_rows]),
                            "lastUpdated": max([row.get("updated_at", "") for row in table_rows])
                        }
                    }
                    
                    # Count non-null values per field
                    all_fields = set()
                    for row in table_rows:
                        all_fields.update(row.keys())
                    
                    for field in all_fields:
                        if field not in ["id", "created_at", "updated_at"]:
                            non_null_count = sum(1 for row in table_rows if row.get(field) not in [None, "", []])
                            stats["fieldsWithData"][field] = {
                                "nonNullCount": non_null_count,
                                "percentage": round((non_null_count / len(table_rows)) * 100, 1)
                            }
                    
                    return {
                        "success": True,
                        "tableId": tableId,
                        "stats": stats
                    }
                
                def _apply_filters(self, rows: List[Dict], filters: List[Dict]) -> List[Dict]:
                    """Apply filters to row list."""
                    filtered_rows = rows
                    
                    for filter_spec in filters:
                        field = filter_spec.get("field", "")
                        operator = filter_spec.get("operator", "eq")
                        value = filter_spec.get("value")
                        
                        if operator == "eq":
                            filtered_rows = [r for r in filtered_rows if r.get(field) == value]
                        elif operator == "ne":
                            filtered_rows = [r for r in filtered_rows if r.get(field) != value]
                        elif operator == "like":
                            filtered_rows = [r for r in filtered_rows if value.lower() in str(r.get(field, "")).lower()]
                        elif operator == "in":
                            filtered_rows = [r for r in filtered_rows if r.get(field) in value]
                        elif operator == "gt" and isinstance(value, (int, float)):
                            filtered_rows = [r for r in filtered_rows if isinstance(r.get(field), (int, float)) and r.get(field) > value]
                        elif operator == "lt" and isinstance(value, (int, float)):
                            filtered_rows = [r for r in filtered_rows if isinstance(r.get(field), (int, float)) and r.get(field) < value]
                        elif operator == "is_null":
                            filtered_rows = [r for r in filtered_rows if r.get(field) in [None, "", []]]
                        elif operator == "is_not_null":
                            filtered_rows = [r for r in filtered_rows if r.get(field) not in [None, "", []]]
                        elif operator == "contains" and isinstance(value, str):
                            # For JSONB/relation fields
                            filtered_rows = [r for r in filtered_rows if value in str(r.get(field, ""))]
                    
                    return filtered_rows
            
            return MockTableDataTool()
        except ImportError:
            raise ValueError("smolagents not available - check smolagents installation")