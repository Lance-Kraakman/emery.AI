"""
Mock Email Tools Module

AIDEV-NOTE: Mock email and communication tools for testing scenarios.
Simulates Gmail API and other communication services.
"""

from typing import Any, Dict
from smolagents import Tool
from ...core.entities import ToolConfig


def load_mock_gmail(config: ToolConfig) -> Any:
    """Load mock Gmail tool for testing email scenarios."""
    try:
        class MockGmailTool(Tool):
            """Mock Gmail tool that simulates email operations."""
            name = "gmail_api"
            description = "Mock Gmail API for sending and reading emails"
            
            def forward(self, action: str = "send_email", **kwargs) -> Dict[str, Any]:
                """Simulate Gmail operations."""
                if action == "send_email":
                    return {
                        "success": True,
                        "message": f"Mock email sent to {kwargs.get('to', 'unknown')} with subject '{kwargs.get('subject', 'No subject')}'"
                    }
                elif action == "read_emails":
                    return {
                        "success": True,
                        "emails": [
                            {
                                "id": "email_001",
                                "from": "test@example.com",
                                "subject": "Welcome to Emery",
                                "body": "Thank you for signing up!",
                                "received_at": "2024-01-15T10:30:00Z"
                            },
                            {
                                "id": "email_002", 
                                "from": "support@company.com",
                                "subject": "Feature Update",
                                "body": "New features are now available.",
                                "received_at": "2024-01-15T11:00:00Z"
                            }
                        ]
                    }
                else:
                    return {"success": False, "error": f"Unknown action: {action}"}
        
        return MockGmailTool()
    except ImportError:
        raise ValueError("smolagents not available - check smolagents installation")


# Registry of email tools
EMAIL_TOOLS = {
    "gmail_api": load_mock_gmail,
}