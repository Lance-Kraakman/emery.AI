"""
Security Report Tool - Generate security reports for agents

AIDEV-NOTE: This tool allows managed agents to generate security analysis reports
and optionally save them as TipTap documents to database fields.

The tool:
1. Calls the security report generation API
2. Optionally retrieves the report in TipTap format
3. Optionally saves the TipTap document to a specified table/field/row

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
import json
from typing import Any, Optional

from smolagents import Tool

from ..services.authenticated_http_client import AuthenticatedHttpClient

logger = logging.getLogger(__name__)


def load_security_report_tool(
    config: Any,
    api_key: str,
    organization_id: int
) -> "SecurityReportTool":
    """
    Load security report tool with auth configuration.

    Args:
        config: Tool configuration (unused, for signature compatibility)
        api_key: API key for authenticated requests
        organization_id: Organization ID for RLS

    Returns:
        Configured SecurityReportTool instance
    """
    return SecurityReportTool(api_key, organization_id)


class SecurityReportTool(Tool):
    """
    Security analysis tool for generating and saving security reports.

    Actions:
    - generate: Generate a security report and return summary
    - generate_tiptap: Generate report and return as TipTap document
    - generate_and_save: Generate, convert to TipTap, and save to document field
    """

    name = "security_report"
    description = (
        "Generate a security analysis report for the organization. "
        "The report analyzes agents, skills, and automations for security vulnerabilities. "
        "Can return summary, TipTap document, or save to a database document field."
    )
    inputs = {
        "action": {
            "type": "string",
            "description": (
                "Action to perform: "
                "'generate' (summary only), "
                "'generate_tiptap' (return TipTap document), "
                "'generate_and_save' (generate and save to document field)"
            ),
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
            "description": (
                "Row ID to save to. If not provided, creates new row. "
                "Only used with generate_and_save action."
            ),
            "nullable": True,
        },
    }
    output_type = "object"

    def __init__(self, api_key: str, organization_id: int):
        """
        Initialize security report tool.

        Args:
            api_key: API key for authenticated requests
            organization_id: Organization ID
        """
        super().__init__()
        self._http_client = AuthenticatedHttpClient(api_key, organization_id)
        self._organization_id = organization_id
        logger.info(f"[SECURITY-REPORT-TOOL] Initialized for org {organization_id}")

    def forward(
        self,
        action: str,
        table_id: Optional[int] = None,
        field_id: Optional[int] = None,
        row_id: Optional[str] = None,
    ) -> dict:
        """
        Execute security report action.

        Args:
            action: Action to perform (generate, generate_tiptap, generate_and_save)
            table_id: Table ID for saving (required for generate_and_save)
            field_id: Field ID for saving (required for generate_and_save)
            row_id: Row ID for saving (optional, creates new row if not provided)

        Returns:
            dict with success status and report/error data
        """
        logger.info(f"[SECURITY-REPORT-TOOL] Action: {action}")

        valid_actions = ["generate", "generate_tiptap", "generate_and_save"]
        if action not in valid_actions:
            return {
                "success": False,
                "error": f"Invalid action. Must be one of: {valid_actions}",
            }

        # Generate security report
        report_result = self._generate_report()
        if not report_result["success"]:
            return report_result

        report_id = report_result["data"]["id"]
        report_data = report_result["data"]["reportData"]

        # Summary response for all actions
        summary = {
            "report_id": report_id,
            "risk_grade": report_data.get("riskGrade"),
            "score": report_data.get("overallScore"),
            "finding_counts": report_data.get("findingCounts"),
            "recommendations": report_data.get("topRecommendations", [])[:3],
        }

        if action == "generate":
            return {
                "success": True,
                "message": "Security report generated successfully",
                "data": summary,
            }

        # Get TipTap format
        tiptap_result = self._get_tiptap(report_id)
        if not tiptap_result["success"]:
            return {
                "success": False,
                "error": f"Report generated but TipTap conversion failed: {tiptap_result['error']}",
                "data": summary,
            }

        tiptap_document = tiptap_result["data"]

        if action == "generate_tiptap":
            return {
                "success": True,
                "message": "Security report generated as TipTap document",
                "data": {
                    **summary,
                    "tiptap_document": tiptap_document,
                },
            }

        # Save to document field
        if action == "generate_and_save":
            if not table_id or not field_id:
                return {
                    "success": False,
                    "error": "table_id and field_id are required for generate_and_save action",
                    "data": summary,
                }

            save_result = self._save_document(
                table_id=table_id,
                field_id=field_id,
                row_id=row_id,
                tiptap_document=tiptap_document,
                title=f"Security Report - {report_data.get('riskGrade', 'N/A')} Grade",
            )

            if not save_result["success"]:
                return {
                    "success": False,
                    "error": f"Report generated but save failed: {save_result['error']}",
                    "data": summary,
                }

            return {
                "success": True,
                "message": "Security report generated and saved as document",
                "data": {
                    **summary,
                    "saved_to": {
                        "table_id": table_id,
                        "field_id": field_id,
                        "row_id": save_result.get("row_id"),
                    },
                },
            }

        return {"success": False, "error": "Unknown action"}

    def _generate_report(self) -> dict:
        """Generate security report via API."""
        try:
            response = self._http_client.post(
                "/api/security/generate",
                json={},
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return {"success": True, "data": data.get("data")}
                return {"success": False, "error": data.get("error", "Unknown error")}

            return {
                "success": False,
                "error": f"API returned status {response.status_code}",
            }
        except Exception as e:
            logger.error(f"[SECURITY-REPORT-TOOL] Generate failed: {e}")
            return {"success": False, "error": str(e)}

    def _get_tiptap(self, report_id: int) -> dict:
        """Get report as TipTap document."""
        try:
            response = self._http_client.get(
                f"/api/security/reports/{report_id}/tiptap"
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return {"success": True, "data": data.get("data")}
                return {"success": False, "error": data.get("error", "Unknown error")}

            return {
                "success": False,
                "error": f"API returned status {response.status_code}",
            }
        except Exception as e:
            logger.error(f"[SECURITY-REPORT-TOOL] TipTap fetch failed: {e}")
            return {"success": False, "error": str(e)}

    def _save_document(
        self,
        table_id: int,
        field_id: int,
        row_id: Optional[str],
        tiptap_document: dict,
        title: str,
    ) -> dict:
        """Save TipTap document to a document field."""
        try:
            # If no row_id, create a new row first
            if not row_id:
                create_row_response = self._http_client.post(
                    f"/api/tables/{table_id}/rows",
                    json={"data": {}},
                )
                if create_row_response.status_code not in [200, 201]:
                    return {
                        "success": False,
                        "error": f"Failed to create row: {create_row_response.status_code}",
                    }
                row_data = create_row_response.json()
                row_id = row_data.get("data", {}).get("id") or row_data.get("id")
                if not row_id:
                    return {"success": False, "error": "Could not get row ID from response"}

            # Create document in the field
            doc_response = self._http_client.post(
                f"/api/tables/{table_id}/rows/{row_id}/fields/{field_id}/documents",
                json={
                    "title": title,
                    "content": tiptap_document.get("content", []),
                },
            )

            if doc_response.status_code in [200, 201]:
                return {"success": True, "row_id": row_id}

            return {
                "success": False,
                "error": f"Failed to save document: {doc_response.status_code}",
            }
        except Exception as e:
            logger.error(f"[SECURITY-REPORT-TOOL] Save failed: {e}")
            return {"success": False, "error": str(e)}
