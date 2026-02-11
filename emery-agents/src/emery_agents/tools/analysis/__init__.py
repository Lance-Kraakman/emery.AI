"""
Analysis tool factories for DSPy.

These tools provide analysis and classification capabilities.
"""

from __future__ import annotations

from .classifier import (
    ClassificationResult,
    TaskClassifierTool,
    create_task_classifier_tool,
)
from .research import (
    SystemResearchTool,
    create_system_research_tool,
)
from .security import (
    FindingCounts,
    SaveLocation,
    SecurityAction,
    SecurityReportResult,
    SecurityReportTool,
    SecuritySummary,
    create_security_report_tool,
)

__all__ = [
    # Security
    "SecurityAction",
    "FindingCounts",
    "SecuritySummary",
    "SaveLocation",
    "SecurityReportResult",
    "SecurityReportTool",
    "create_security_report_tool",
    # Research
    "SystemResearchTool",
    "create_system_research_tool",
    # Classifier
    "ClassificationResult",
    "TaskClassifierTool",
    "create_task_classifier_tool",
]
