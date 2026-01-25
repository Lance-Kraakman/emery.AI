"""
Security Report Tool - Generate security reports for agents.

Ported from tools/security_report_tool.py - removes smolagents.Tool dependency.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any, Callable

from ..http_client import make_request

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
    recommendations: list[str]


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
    summary: SecuritySummary | None = None
    tiptap_document: dict[str, Any] | None = None
    saved_to: SaveLocation | None = None
    error: str | None = None


class SecurityReportTool:
    """
    Security analysis tool for generating and saving security reports.

    Attributes:
        name: Tool name for LLM
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type
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

    def __init__(self, auth_token: str, org_id: str) -> None:
        self._auth_token = auth_token
        self._org_id = org_id

    def __call__(self, **kwargs: Any) -> dict[str, Any] | str:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def forward(
        self,
        action: str,
        table_id: int | None = None,
        field_id: int | None = None,
        row_id: str | None = None,
    ) -> dict[str, Any] | str:
        """Execute security report action."""
        logger.info(f"[SECURITY-REPORT] Action: {action}")

        try:
            action_enum = SecurityAction(action)
        except ValueError:
            valid_actions = [a.value for a in SecurityAction]
            return f"ERROR: Invalid action '{action}'. Must be one of: {valid_actions}. This operation FAILED."

        # Generate security report
        report_result = self._generate_report()
        if isinstance(report_result, str) and report_result.startswith("ERROR"):
            return report_result

        try:
            report_data = json.loads(report_result) if isinstance(report_result, str) else report_result
        except json.JSONDecodeError:
            return f"ERROR: Failed to parse report response: {report_result}"

        if not report_data.get("success", True):
            error = report_data.get("error", "Unknown error")
            return f"ERROR: Failed to generate security report: {error}. This operation FAILED."

        # Extract report data
        data = report_data.get("data", {}).get("data", {})
        if not data:
            data = report_data.get("data", {})

        report_id = data.get("id")
        report_info = data.get("reportData", {})

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
        if isinstance(tiptap_result, str) and tiptap_result.startswith("ERROR"):
            return {
                "success": False,
                "error": "Report generated but TipTap conversion failed",
                "summary": self._summary_to_dict(summary),
            }

        try:
            tiptap_data = json.loads(tiptap_result) if isinstance(tiptap_result, str) else tiptap_result
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Report generated but TipTap conversion failed: invalid response",
                "summary": self._summary_to_dict(summary),
            }

        if not tiptap_data.get("success", True):
            error = tiptap_data.get("error", "Unknown error")
            return {
                "success": False,
                "error": f"Report generated but TipTap conversion failed: {error}",
                "summary": self._summary_to_dict(summary),
            }

        tiptap_content = tiptap_data.get("data", {}).get("data", {})
        if not tiptap_content:
            tiptap_content = tiptap_data.get("data", {})

        if action_enum == SecurityAction.GENERATE_TIPTAP:
            result = SecurityReportResult(
                success=True,
                message="Security report generated as TipTap document",
                summary=summary,
                tiptap_document=tiptap_content,
            )
            return self._to_dict(result)

        # Save to document field
        if action_enum == SecurityAction.GENERATE_AND_SAVE:
            if not table_id or not field_id:
                return "ERROR: table_id and field_id are required for generate_and_save. This operation FAILED."

            save_result = self._save_document(
                table_id=table_id,
                field_id=field_id,
                row_id=row_id,
                tiptap_document=tiptap_content,
                title=f"Security Report - {summary.risk_grade} Grade",
            )

            if isinstance(save_result, str) and save_result.startswith("ERROR"):
                return {
                    "success": False,
                    "error": "Report generated but save failed",
                    "summary": self._summary_to_dict(summary),
                }

            try:
                save_data = json.loads(save_result) if isinstance(save_result, str) else save_result
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": "Report generated but save failed: invalid response",
                    "summary": self._summary_to_dict(summary),
                }

            if not save_data.get("success"):
                error = save_data.get("error", "Unknown error")
                return {
                    "success": False,
                    "error": f"Report generated but save failed: {error}",
                    "summary": self._summary_to_dict(summary),
                }

            saved_row_id = save_data.get("row_id", row_id)
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

        return "ERROR: Unknown action. This operation FAILED."

    def _summary_to_dict(self, summary: SecuritySummary) -> dict[str, Any]:
        """Convert summary to dict."""
        return {
            "report_id": summary.report_id,
            "risk_grade": summary.risk_grade,
            "score": summary.score,
            "finding_counts": asdict(summary.finding_counts),
            "recommendations": summary.recommendations,
        }

    def _to_dict(self, result: SecurityReportResult) -> dict[str, Any]:
        """Convert SecurityReportResult to dict, handling nested dataclasses."""
        d: dict[str, Any] = {
            "success": result.success,
            "message": result.message,
        }
        if result.summary:
            d["summary"] = self._summary_to_dict(result.summary)
        if result.tiptap_document:
            d["tiptap_document"] = result.tiptap_document
        if result.saved_to:
            d["saved_to"] = asdict(result.saved_to)
        if result.error:
            d["error"] = result.error
        return d

    def _generate_report(self) -> str:
        """Generate security report via API."""
        return make_request(
            endpoint="security/generate",
            method="POST",
            data={},
            auth_token=self._auth_token,
            org_id=self._org_id,
        )

    def _get_tiptap(self, report_id: int) -> str:
        """Get report as TipTap document."""
        return make_request(
            endpoint=f"security/reports/{report_id}/tiptap",
            method="GET",
            data=None,
            auth_token=self._auth_token,
            org_id=self._org_id,
        )

    def _save_document(
        self,
        table_id: int,
        field_id: int,
        row_id: str | None,
        tiptap_document: dict[str, Any],
        title: str,
    ) -> str:
        """Save TipTap document to a document field."""
        # If no row_id, create a new row first
        if not row_id:
            create_result = make_request(
                endpoint=f"tables/{table_id}/rows",
                method="POST",
                data={"data": {}},
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
            if isinstance(create_result, str) and create_result.startswith("ERROR"):
                return create_result

            try:
                create_data = json.loads(create_result)
            except json.JSONDecodeError:
                return json.dumps({"success": False, "error": "Could not parse create row response"})

            if not create_data.get("success", True):
                return json.dumps(create_data)

            row_data = create_data.get("data", {})
            row_id = row_data.get("data", {}).get("id") or row_data.get("id")
            if not row_id:
                return json.dumps({"success": False, "error": "Could not get row ID from response"})

        # Create document in the field
        doc_result = make_request(
            endpoint=f"tables/{table_id}/rows/{row_id}/fields/{field_id}/documents",
            method="POST",
            data={
                "title": title,
                "content": tiptap_document.get("content", []),
            },
            auth_token=self._auth_token,
            org_id=self._org_id,
        )

        if isinstance(doc_result, str) and doc_result.startswith("ERROR"):
            return doc_result

        try:
            doc_data = json.loads(doc_result)
        except json.JSONDecodeError:
            return json.dumps({"success": False, "error": "Could not parse document creation response"})

        if not doc_data.get("success", True):
            return json.dumps(doc_data)

        return json.dumps({"success": True, "row_id": row_id})


def create_security_report_tool(
    api_key: str | None = None,
    organization_id: int | None = None,
) -> SecurityReportTool:
    """
    Create security report tool with auth configuration.

    Args:
        api_key: API key for authenticated requests
        organization_id: Organization ID for RLS

    Returns:
        Configured SecurityReportTool instance
    """
    auth_token = api_key or ""
    org_id = str(organization_id) if organization_id else ""
    return SecurityReportTool(auth_token=auth_token, org_id=org_id)
