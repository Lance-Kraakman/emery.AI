"""
Integration tool factories for DSPy.

These tools enable agents to integrate with external services.
"""

from __future__ import annotations

from .api import (
    API_TOOLS,
    AnalysisAPITool,
    KPIAPITool,
    MeasurementAPITool,
    ProcessAPITool,
    load_analysis_api_tool,
    load_kpi_api_tool,
    load_measurement_api_tool,
    load_process_api_tool,
)
from .base import (
    create_calculator_tool,
    create_document_reader_tool,
    create_file_reader_tool,
    create_table_query_tool,
)
from .dynamic_agent import DynamicAgentTool
from .dynamic_skill import DynamicSkillTool
from .organizational import (
    ORGANIZATIONAL_TOOLS,
    EmeryDatabaseTool,
    TableDataTool,
    TableSchemaTool,
    load_emery_database,
    load_table_data,
    load_table_schema,
)
from .pipedream import (
    PIPEDREAM_TOOLS,
    PipedreamTool,
    get_pipedream_tool_info,
    list_pipedream_tools_by_app,
)

__all__ = [
    # Pipedream
    "PipedreamTool",
    "PIPEDREAM_TOOLS",
    "get_pipedream_tool_info",
    "list_pipedream_tools_by_app",
    # Dynamic Agent
    "DynamicAgentTool",
    # Dynamic Skill
    "DynamicSkillTool",
    # Base tools
    "create_file_reader_tool",
    "create_calculator_tool",
    "create_document_reader_tool",
    "create_table_query_tool",
    # API tools
    "MeasurementAPITool",
    "KPIAPITool",
    "AnalysisAPITool",
    "ProcessAPITool",
    "load_measurement_api_tool",
    "load_kpi_api_tool",
    "load_analysis_api_tool",
    "load_process_api_tool",
    "API_TOOLS",
    # Organizational tools
    "EmeryDatabaseTool",
    "TableSchemaTool",
    "TableDataTool",
    "load_emery_database",
    "load_table_schema",
    "load_table_data",
    "ORGANIZATIONAL_TOOLS",
]
