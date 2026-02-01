"""
Tool factories, loading, and capability management.

All tool definitions live here:
- crud/          CRUD tools for platform resources
- execution/     Bash, skill execution, dynamic dispatch
- integrations/  External integrations (Pipedream, API tools, etc.)
- analysis/      Security reports, research, classification
- output/        Plan/step/recovery output collectors
- discovery.py   Discovery tools (workspace, capabilities, web search)

Infrastructure:
- loader.py              UnifiedToolLoader (metadata-driven)
- provider.py            ToolProvider (auth-scoped tool creation)
- capability_registry.py CapabilityRegistry (semantic capability search)
- tool_modes.py          ToolMode filtering (read-only vs mutation)
"""

from __future__ import annotations

from typing import Any, Callable

import dspy

from .capability_registry import CapabilityRegistry
from .loader import UnifiedToolLoader
from .provider import ToolProvider
from .research import duckduckgo_search

from .tool_modes import (
    ToolMode,
    is_read_only_tool,
    filter_tools_for_mode,
    get_planning_tool_restrictions,
    get_execution_tool_permissions,
    READ_ONLY_TOOLS,
    MUTATION_ONLY_TOOLS,
    MUTATION_METHODS,
)

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
    PlanCollector,
    CapturedPlan,
    NormalizedStepData,
    create_plan_output_tool,
    RecoveryCollector,
    RecoveryResult,
    create_recovery_output_tool,
)
from .execution import (
    create_bash_tool,
    create_skill_invoker_tool,
    create_skill_invoker_tools,
    SkillTool,
)
from .integrations import (
    PipedreamTool,
    PIPEDREAM_TOOLS,
    get_pipedream_tool_info,
    list_pipedream_tools_by_app,
    create_file_reader_tool,
    create_calculator_tool,
    create_document_reader_tool,
    create_table_query_tool,
    MeasurementAPITool,
    KPIAPITool,
    AnalysisAPITool,
    ProcessAPITool,
    load_measurement_api_tool,
    load_kpi_api_tool,
    load_analysis_api_tool,
    load_process_api_tool,
    API_TOOLS,
    EmeryDatabaseTool,
    TableSchemaTool,
    TableDataTool,
    load_emery_database,
    load_table_schema,
    load_table_data,
    ORGANIZATIONAL_TOOLS,
)
from .analysis import (
    SecurityAction,
    FindingCounts,
    SecuritySummary,
    SaveLocation,
    SecurityReportResult,
    SecurityReportTool,
    create_security_report_tool,
    SystemResearchTool,
    create_system_research_tool,
    ClassificationResult,
    TaskClassifierTool,
    create_task_classifier_tool,
)
from .discovery import create_discovery_tools

__all__ = [
    # Tool modes
    "ToolMode",
    "is_read_only_tool",
    "filter_tools_for_mode",
    "get_planning_tool_restrictions",
    "get_execution_tool_permissions",
    "READ_ONLY_TOOLS",
    "MUTATION_ONLY_TOOLS",
    "MUTATION_METHODS",
    # Infrastructure
    "UnifiedToolLoader",
    "ToolProvider",
    "CapabilityRegistry",
    "duckduckgo_search",
    # Factories
    "create_all_tools",
    "create_crud_tools",
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
    # Output
    "ClarificationRequestedException",
    "QuestionCollector",
    "StepCollector",
    "create_ask_question_tool",
    "create_step_output_tool",
    "PlanCollector",
    "CapturedPlan",
    "NormalizedStepData",
    "create_plan_output_tool",
    "RecoveryCollector",
    "RecoveryResult",
    "create_recovery_output_tool",
    # Execution
    "create_bash_tool",
    "create_skill_invoker_tool",
    "create_skill_invoker_tools",
    "SkillTool",
    # Integrations
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
    # Analysis
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
    # Discovery
    "create_discovery_tools",
]


def create_crud_tools(api_key: str, org_id: str) -> list[dspy.Tool]:
    """Create all CRUD tool functions with auth captured."""
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


def create_all_tools(
    api_key: str,
    org_id: str,
    capability_registry: "CapabilityRegistry | None" = None,
) -> list[dspy.Tool]:
    """Create all DSPy tool functions with auth captured."""
    tools: list[dspy.Tool] = []
    tools.extend(create_crud_tools(api_key, org_id))
    tools.extend(create_discovery_tools(api_key, org_id, capability_registry))
    return tools
