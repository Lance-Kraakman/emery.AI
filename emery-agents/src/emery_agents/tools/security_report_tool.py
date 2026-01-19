"""
Security Report Tool - Generate security reports for agents

AIDEV-NOTE: This tool allows managed agents to generate security analysis reports
and optionally save them as TipTap documents to database fields.

The tool uses BaseCrudTool for consistent API handling and error patterns.
Auth is captured in closure variables - NOT exposed to LLM via inputs.

Usage:
    # Generate report (returns summary)
    security_report(action="generate")

    # Generate and get as TipTap
    security_report(action="generate_tiptap")

    # Generate, get TipTap, and save to document field
    security_report(
        action="generate_and_save",
        table_id=5,
        field_id=12,
        row_id="abc-123"
    )
"""

import logging
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from smolagents import Tool

from .crud_tools import BaseCrudTool
from ..grpc.generated.agent_worker_pb2 import ToolConfig

logger = logging.getLogger(__name__)


class SecurityAction(str, Enum):
    """Valid actions for the security report tool."""

    GENERATE = "generate"
    GENERATE_TIPTAP = "generate_tiptap"
    GENERATE_AND_SAVE = "generate_and_save"


@dataclass
class FindingCounts:
    """Security finding counts by severity level."""

    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0


@dataclass
class SecuritySummary:
    """Summary of a security report."""

    report_id: int
    risk_grade: str
    score: int
    finding_counts: FindingCounts
    recommendations: List[str]


@dataclass
class SaveLocation:
    """Location where a document was saved."""

    table_id: int
    field_id: int
    row_id: str


@dataclass
class SecurityReportResult:
    """Result of a security report operation."""

    success: bool
    message: str
    summary: Optional[SecuritySummary] = None
    tiptap_document: Optional[Dict[str, Any]] = None
    saved_to: Optional[SaveLocation] = None
    error: Optional[str] = None


def load_security_report_tool(
    config: Optional[ToolConfig] = None,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Load security report tool with auth configuration.

    AIDEV-NOTE: Auth is captured in closure variables - NOT exposed to LLM via inputs.
    This follows the same pattern as table_crud, field_crud, etc.

    Args:
        config: Tool configuration (unused, for signature compatibility)
        api_key: API key for authenticated requests
        organization_id: Organization ID for RLS

    Returns:
        Configured SecurityReportTool instance
    """
    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class SecurityReportTool(BaseCrudTool):
        """
        Security analysis tool for generating and saving security reports.

        Actions:
        - generate: Generate report, return summary (risk grade, score, finding counts)
        - generate_tiptap: Generate report and return as TipTap document
        - generate_and_save: Generate, convert to TipTap, save to document field
        """

        name = "security_report"
        description = (
            "Security analysis: generate (get security report summary), "
            "generate_tiptap (get report as TipTap document), "
            "generate_and_save (generate and save to a document field in a table row)."
        )
        inputs = {
            "action": {
                "type": "string",
                "description": "Operation: generate, generate_tiptap, generate_and_save",
            },
            "table_id": {
                "type": "integer",
                "description": "Table ID to save document to (required for generate_and_save)",
                "nullable": True,
            },
            "field_id": {
                "type": "integer",
                "description": "Document field ID to save to (required for generate_and_save)",
                "nullable": True,
            },
            "row_id": {
                "type": "string",
                "description": "Row ID to save to. If not provided, creates new row",
                "nullable": True,
            },
        }
        output_type = "object"

        def __init__(self):
            super().__init__("security", "report")

        def forward(
            self,
            action: str,
            table_id: Optional[int] = None,
            field_id: Optional[int] = None,
            row_id: Optional[str] = None,
        ) -> Union[Dict[str, Any], str]:
            """
            Execute security report action.

            Args:
                action: Operation to perform (generate, generate_tiptap, generate_and_save)
                table_id: Table ID for saving (required for generate_and_save)
                field_id: Field ID for saving (required for generate_and_save)
                row_id: Row ID for saving (optional, creates new row if not provided)

            Returns:
                Dict with success status and report data, or error string
            """
            logger.info(f"[SECURITY-REPORT] Action: {action}")

            # Validate action
            try:
                action_enum = SecurityAction(action)
            except ValueError:
                valid_actions = [a.value for a in SecurityAction]
                return f"❌ ERROR: Invalid action '{action}'. Must be one of: {valid_actions}. This operation FAILED."

            # Generate security report
            report_result = self._generate_report()
            if isinstance(report_result, str):
                # Error string returned
                return report_result
            if not report_result.get("success"):
                error = report_result.get("error", "Unknown error")
                return f"❌ ERROR: Failed to generate security report: {error}. This operation FAILED."

            # Extract report data
            report_data = report_result.get("data", {}).get("data", {})
            if not report_data:
                report_data = report_result.get("data", {})

            report_id = report_data.get("id")
            report_info = report_data.get("reportData", {})

            # Build summary
            finding_counts = FindingCounts(
                critical=report_info.get("findingCounts", {}).get("critical", 0),
                high=report_info.get("findingCounts", {}).get("high", 0),
                medium=report_info.get("findingCounts", {}).get("medium", 0),
                low=report_info.get("findingCounts", {}).get("low", 0),
                info=report_info.get("findingCounts", {}).get("info", 0),
            )

            summary = SecuritySummary(
                report_id=report_id,
                risk_grade=report_info.get("riskGrade", "N/A"),
                score=report_info.get("overallScore", 0),
                finding_counts=finding_counts,
                recommendations=report_info.get("topRecommendations", [])[:3],
            )

            if action_enum == SecurityAction.GENERATE:
                result = SecurityReportResult(
                    success=True,
                    message="Security report generated successfully",
                    summary=summary,
                )
                return self._to_dict(result)

            # Get TipTap format
            tiptap_result = self._get_tiptap(report_id)
            if isinstance(tiptap_result, str):
                # Error string but we have summary
                return {
                    "success": False,
                    "error": f"Report generated but TipTap conversion failed",
                    "summary": asdict(summary),
                }
            if not tiptap_result.get("success"):
                error = tiptap_result.get("error", "Unknown error")
                return {
                    "success": False,
                    "error": f"Report generated but TipTap conversion failed: {error}",
                    "summary": asdict(summary),
                }

            tiptap_data = tiptap_result.get("data", {}).get("data", {})
            if not tiptap_data:
                tiptap_data = tiptap_result.get("data", {})

            if action_enum == SecurityAction.GENERATE_TIPTAP:
                result = SecurityReportResult(
                    success=True,
                    message="Security report generated as TipTap document",
                    summary=summary,
                    tiptap_document=tiptap_data,
                )
                return self._to_dict(result)

            # Save to document field
            if action_enum == SecurityAction.GENERATE_AND_SAVE:
                if not table_id or not field_id:
                    return f"❌ ERROR: table_id and field_id are required for generate_and_save. This operation FAILED."

                save_result = self._save_document(
                    table_id=table_id,
                    field_id=field_id,
                    row_id=row_id,
                    tiptap_document=tiptap_data,
                    title=f"Security Report - {summary.risk_grade} Grade",
                )

                if isinstance(save_result, str):
                    # Error string
                    return {
                        "success": False,
                        "error": f"Report generated but save failed",
                        "summary": asdict(summary),
                    }
                if not save_result.get("success"):
                    error = save_result.get("error", "Unknown error")
                    return {
                        "success": False,
                        "error": f"Report generated but save failed: {error}",
                        "summary": asdict(summary),
                    }

                saved_row_id = save_result.get("row_id", row_id)
                result = SecurityReportResult(
                    success=True,
                    message="Security report generated and saved as document",
                    summary=summary,
                    saved_to=SaveLocation(
                        table_id=table_id,
                        field_id=field_id,
                        row_id=saved_row_id,
                    ),
                )
                return self._to_dict(result)

            return f"❌ ERROR: Unknown action. This operation FAILED."

        def _to_dict(self, result: SecurityReportResult) -> Dict[str, Any]:
            """Convert SecurityReportResult to dict, handling nested dataclasses."""
            d = {
                "success": result.success,
                "message": result.message,
            }
            if result.summary:
                d["summary"] = {
                    "report_id": result.summary.report_id,
                    "risk_grade": result.summary.risk_grade,
                    "score": result.summary.score,
                    "finding_counts": asdict(result.summary.finding_counts),
                    "recommendations": result.summary.recommendations,
                }
            if result.tiptap_document:
                d["tiptap_document"] = result.tiptap_document
            if result.saved_to:
                d["saved_to"] = asdict(result.saved_to)
            if result.error:
                d["error"] = result.error
            return d

        def _generate_report(self) -> Union[Dict[str, Any], str]:
            """Generate security report via API."""
            return self._make_api_request(
                endpoint="security/generate",
                method="POST",
                data={},
                auth_token=_auth_token,
                organization_id=_org_id,
            )

        def _get_tiptap(self, report_id: int) -> Union[Dict[str, Any], str]:
            """Get report as TipTap document."""
            return self._make_api_request(
                endpoint=f"security/reports/{report_id}/tiptap",
                method="GET",
                auth_token=_auth_token,
                organization_id=_org_id,
            )

        def _save_document(
            self,
            table_id: int,
            field_id: int,
            row_id: Optional[str],
            tiptap_document: Dict[str, Any],
            title: str,
        ) -> Union[Dict[str, Any], str]:
            """Save TipTap document to a document field."""
            # If no row_id, create a new row first
            if not row_id:
                create_result = self._make_api_request(
                    endpoint=f"tables/{table_id}/rows",
                    method="POST",
                    data={"data": {}},
                    auth_token=_auth_token,
                    organization_id=_org_id,
                )
                if isinstance(create_result, str):
                    return create_result
                if not create_result.get("success"):
                    return create_result

                row_data = create_result.get("data", {})
                row_id = row_data.get("data", {}).get("id") or row_data.get("id")
                if not row_id:
                    return {"success": False, "error": "Could not get row ID from response"}

            # Create document in the field
            doc_result = self._make_api_request(
                endpoint=f"tables/{table_id}/rows/{row_id}/fields/{field_id}/documents",
                method="POST",
                data={
                    "title": title,
                    "content": tiptap_document.get("content", []),
                },
                auth_token=_auth_token,
                organization_id=_org_id,
            )

            if isinstance(doc_result, str):
                return doc_result
            if not doc_result.get("success"):
                return doc_result

            return {"success": True, "row_id": row_id}

    return SecurityReportTool()
