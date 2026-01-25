"""
DSPy tool factories.

This module provides factory functions that create DSPy-compatible tool functions.
Each tool function has authentication captured via closures.

Usage:
    tools = create_all_tools(api_key="...", org_id="...")
    # tools is a list of callable functions ready for DSPy ReAct
"""

from __future__ import annotations

from typing import Callable

from .crud import (
    create_agent_crud,
    create_app_crud,
    create_database_crud,
    create_document_crud,
    create_field_crud,
    create_file_crud,
    create_page_crud,
    create_row_crud,
    create_skill_crud,
    create_table_crud,
    create_team_crud,
    create_view_crud,
)
from .output import (
    ClarificationRequestedException,
    QuestionCollector,
    StepCollector,
    create_ask_question_tool,
    create_step_output_tool,
    # Agent output
    OutputCollector,
    CapturedOutput,
    ExtractionStats,
    TargetFieldMetadata,
    create_output_tool,
    # Plan output
    PlanCollector,
    CapturedPlan,
    NormalizedStepData,
    create_plan_output_tool,
    # Recovery output
    RecoveryCollector,
    RecoveryResult,
    create_recovery_output_tool,
)
from .execution import (
    # Bash
    create_bash_tool,
    # Skill invoker
    create_skill_invoker_tool,
    create_skill_invoker_tools,
    # Skill tool
    SkillTool,
)
from .integrations import (
    # Pipedream
    PipedreamTool,
    PIPEDREAM_TOOLS,
    get_pipedream_tool_info,
    list_pipedream_tools_by_app,
    # Base tools
    create_file_reader_tool,
    create_calculator_tool,
    create_document_reader_tool,
    create_table_query_tool,
    # API tools
    MeasurementAPITool,
    KPIAPITool,
    AnalysisAPITool,
    ProcessAPITool,
    load_measurement_api_tool,
    load_kpi_api_tool,
    load_analysis_api_tool,
    load_process_api_tool,
    API_TOOLS,
    # Organizational tools
    EmeryDatabaseTool,
    TableSchemaTool,
    TableDataTool,
    load_emery_database,
    load_table_schema,
    load_table_data,
    ORGANIZATIONAL_TOOLS,
)
from .analysis import (
    # Security
    SecurityAction,
    FindingCounts,
    SecuritySummary,
    SaveLocation,
    SecurityReportResult,
    SecurityReportTool,
    create_security_report_tool,
    # Research
    SystemResearchTool,
    create_system_research_tool,
    # Classifier
    ClassificationResult,
    TaskClassifierTool,
    create_task_classifier_tool,
)
from .wrapper import DSPyToolWrapper, wrap_tool

__all__ = [
    "create_all_tools",
    "create_crud_tools",
    # Wrapper for smolagents compatibility
    "DSPyToolWrapper",
    "wrap_tool",
    # Re-export individual CRUD factories
    "create_agent_crud",
    "create_app_crud",
    "create_database_crud",
    "create_document_crud",
    "create_field_crud",
    "create_file_crud",
    "create_page_crud",
    "create_row_crud",
    "create_skill_crud",
    "create_table_crud",
    "create_team_crud",
    "create_view_crud",
    # Output tools
    "ClarificationRequestedException",
    "QuestionCollector",
    "StepCollector",
    "create_ask_question_tool",
    "create_step_output_tool",
    "OutputCollector",
    "CapturedOutput",
    "ExtractionStats",
    "TargetFieldMetadata",
    "create_output_tool",
    "PlanCollector",
    "CapturedPlan",
    "NormalizedStepData",
    "create_plan_output_tool",
    "RecoveryCollector",
    "RecoveryResult",
    "create_recovery_output_tool",
    # Execution tools
    "create_bash_tool",
    "create_skill_invoker_tool",
    "create_skill_invoker_tools",
    "SkillTool",
    # Integration tools
    "PipedreamTool",
    "PIPEDREAM_TOOLS",
    "get_pipedream_tool_info",
    "list_pipedream_tools_by_app",
    "create_file_reader_tool",
    "create_calculator_tool",
    "create_document_reader_tool",
    "create_table_query_tool",
    "MeasurementAPITool",
    "KPIAPITool",
    "AnalysisAPITool",
    "ProcessAPITool",
    "load_measurement_api_tool",
    "load_kpi_api_tool",
    "load_analysis_api_tool",
    "load_process_api_tool",
    "API_TOOLS",
    "EmeryDatabaseTool",
    "TableSchemaTool",
    "TableDataTool",
    "load_emery_database",
    "load_table_schema",
    "load_table_data",
    "ORGANIZATIONAL_TOOLS",
    # Analysis tools
    "SecurityAction",
    "FindingCounts",
    "SecuritySummary",
    "SaveLocation",
    "SecurityReportResult",
    "SecurityReportTool",
    "create_security_report_tool",
    "SystemResearchTool",
    "create_system_research_tool",
    "ClassificationResult",
    "TaskClassifierTool",
    "create_task_classifier_tool",
]


def create_crud_tools(api_key: str, org_id: str) -> list[Callable[..., str]]:
    """
    Create all CRUD tool functions with auth captured.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        List of callable tool functions for DSPy ReAct
    """
    return [
        create_table_crud(api_key, org_id),
        create_field_crud(api_key, org_id),
        create_row_crud(api_key, org_id),
        create_database_crud(api_key, org_id),
        create_view_crud(api_key, org_id),
        create_app_crud(api_key, org_id),
        create_page_crud(api_key, org_id),
        create_document_crud(api_key, org_id),
        create_file_crud(api_key, org_id),
        create_skill_crud(api_key, org_id),
        create_agent_crud(api_key, org_id),
        create_team_crud(api_key, org_id),
    ]


def create_all_tools(api_key: str, org_id: str) -> list[Callable[..., str]]:
    """
    Create all DSPy tool functions with auth captured.

    This is the main entry point for creating tools for DSPy ReAct execution.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        List of callable tool functions for DSPy ReAct
    """
    tools: list[Callable[..., str]] = []

    # Add CRUD tools
    tools.extend(create_crud_tools(api_key, org_id))

    # TODO: Add discovery tools when ported
    # tools.extend(create_discovery_tools(api_key, org_id))

    # TODO: Add output tools when ported
    # tools.extend(create_output_tools(api_key, org_id))

    return tools
