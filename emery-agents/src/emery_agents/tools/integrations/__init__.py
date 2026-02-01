"""
Integration tool factories for DSPy.

These tools enable agents to integrate with external services.
"""

from __future__ import annotations

from .pipedream import PipedreamTool, PIPEDREAM_TOOLS, get_pipedream_tool_info, list_pipedream_tools_by_app
from .dynamic_agent import DynamicAgentTool
from .dynamic_skill import DynamicSkillTool
from .base import (
    create_file_reader_tool,
    create_calculator_tool,
    create_document_reader_tool,
    create_table_query_tool,
)
from .api import (
    MeasurementAPITool,
    KPIAPITool,
    AnalysisAPITool,
    ProcessAPITool,
    load_measurement_api_tool,
    load_kpi_api_tool,
    load_analysis_api_tool,
    load_process_api_tool,
    API_TOOLS,
)
from .organizational import (
    EmeryDatabaseTool,
    TableSchemaTool,
    TableDataTool,
    load_emery_database,
    load_table_schema,
    load_table_data,
    ORGANIZATIONAL_TOOLS,
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
