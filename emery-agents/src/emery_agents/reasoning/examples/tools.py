"""
Tool examples for KNNFewShot tool selection.

Each example teaches: given a task (INPUT), use this tool with these args (OUTPUT).
Includes example inputs/outputs for better few-shot learning.
"""

import dspy


from typing import Any


def _tool_example(
    request: str,
    tool_id: str,
    tool_args: dict[str, Any] | None = None,
    expected_output: str | None = None,
) -> dspy.Example:
    """Create a tool selection example with all executor input fields.

    The executor signature is: step_description, context -> result
    Examples must include all InputFields to avoid DSPy warnings.

    Args:
        request: Natural language request - mapped to step_description for KNN matching
        tool_id: Tool to use for this task (OUTPUT)
        tool_args: Example input arguments for the tool
        expected_output: Example of what the tool returns
    """
    example_dict: dict[str, Any] = {
        # Inputs (match executor signature)
        "step_description": request,  # KNN matches on this field
        "context": "",  # Runtime context - empty in demos
        # Outputs
        "tool_id": tool_id,
    }
    if tool_args:
        example_dict["tool_args"] = tool_args
    if expected_output:
        example_dict["expected_output"] = expected_output

    return dspy.Example(**example_dict).with_inputs("step_description", "context")


# =============================================================================
# INTERNAL TOOLS - Skills, CRUD, System Operations
# =============================================================================

INTERNAL_TOOL_EXAMPLES: list[dspy.Example] = [
    # --- Skill Execution (Pre-loaded via @mention) ---
    # When a skill is @mentioned, it's pre-loaded as a DynamicSkillTool.
    # The tool name follows the pattern: skill_{id}_{name_slug}
    _tool_example(
        request="@skill:go-for-a-walk",
        tool_id="skill_30_go_for_a_walk",  # Pre-loaded tool with typed inputs
        tool_args={},  # Inputs are typed from skill schema
        expected_output="Skill 'Go for a Walk' executed. Awaiting user completion.",
    ),

    # --- Skill Execution (Discovered via list → skill:{id}) ---
    # When a skill isn't @mentioned, first list skills then use skill:{id} pattern
    # This lazy-loads a DynamicSkillTool with typed inputs
    _tool_example(
        request="Run the weekly report skill",
        tool_id="skill:25",  # Lazy-load pattern for discovered skills
        tool_args={"recipient_email": "team@company.com"},  # Typed inputs
        expected_output="Weekly Report skill executed successfully.",
    ),
    _tool_example(
        request="Execute send-newsletter skill with recipient team@company.com",
        tool_id="skill:35",  # Lazy-load pattern
        tool_args={"recipient_email": "team@company.com"},
        expected_output="Newsletter sent to team@company.com",
    ),
    _tool_example(
        request="Trigger the backup skill now",
        tool_id="skill:40",  # Lazy-load pattern
        tool_args={},
        expected_output="Backup completed successfully.",
    ),

    # --- Skill CRUD (Management only, no execute) ---
    _tool_example(
        request="What skills do I have?",
        tool_id="skill_crud",
        tool_args={"method": "list"},
        expected_output='[{"id": 25, "name": "Weekly Report"}, {"id": 30, "name": "Go for a Walk"}]',
    ),
    _tool_example(
        request="Show me the details of the weekly report skill",
        tool_id="skill_crud",
        tool_args={"method": "read", "skill_id": "25"},
        expected_output='{"id": 25, "name": "Weekly Report", "type": "automated", "inputs": ["recipient_email"]}',
    ),
    _tool_example(
        request="Create a new skill for sending daily summaries",
        tool_id="skill_crud",
        tool_args={"method": "create", "agent_id": "1", "data": {"name": "Daily Summary", "instructions": "..."}},
        expected_output='{"id": 45, "name": "Daily Summary"}',
    ),

    # --- Table CRUD ---
    _tool_example(
        request="Create a contacts table with name, email, and phone fields",
        tool_id="table_crud",
        tool_args={
            "action": "create",
            "name": "contacts",
            "fields": [
                {"name": "name", "type": "text"},
                {"name": "email", "type": "email"},
                {"name": "phone", "type": "phone"},
            ],
        },
        expected_output='{"id": "tbl_123", "name": "contacts", "field_count": 3}',
    ),
    _tool_example(
        request="List all tables in my database",
        tool_id="table_crud",
        tool_args={"action": "list"},
        expected_output='[{"id": "tbl_1", "name": "contacts"}, {"id": "tbl_2", "name": "orders"}]',
    ),
    _tool_example(
        request="Delete the old_data table",
        tool_id="table_crud",
        tool_args={"action": "delete", "table_id": "tbl_old"},
        expected_output="Table deleted successfully.",
    ),

    # --- Field CRUD ---
    _tool_example(
        request="Add a phone field to the contacts table",
        tool_id="field_crud",
        tool_args={
            "action": "create",
            "table_id": "tbl_1",
            "name": "phone",
            "type": "phone",
        },
        expected_output='{"id": "fld_456", "name": "phone", "type": "phone"}',
    ),
    _tool_example(
        request="Rename the 'email' field to 'contact_email'",
        tool_id="field_crud",
        tool_args={"action": "update", "field_id": "fld_2", "name": "contact_email"},
        expected_output="Field renamed successfully.",
    ),

    # --- Row CRUD ---
    _tool_example(
        request="Add a new contact: John Doe, john@example.com",
        tool_id="row_crud",
        tool_args={
            "action": "create",
            "table_id": "tbl_1",
            "data": {"name": "John Doe", "email": "john@example.com"},
        },
        expected_output='{"id": "row_789", "name": "John Doe", "email": "john@example.com"}',
    ),
    _tool_example(
        request="Get all contacts",
        tool_id="row_crud",
        tool_args={"action": "list", "table_id": "tbl_1"},
        expected_output='[{"id": "row_1", "name": "John"}, {"id": "row_2", "name": "Jane"}]',
    ),
    _tool_example(
        request="Update contact John's email to john.doe@newcompany.com",
        tool_id="row_crud",
        tool_args={
            "action": "update",
            "row_id": "row_789",
            "data": {"email": "john.doe@newcompany.com"},
        },
        expected_output="Row updated successfully.",
    ),
    _tool_example(
        request="Delete the duplicate contact entry",
        tool_id="row_crud",
        tool_args={"action": "delete", "row_id": "row_dup"},
        expected_output="Row deleted successfully.",
    ),

    # --- App CRUD ---
    _tool_example(
        request="Create a new app called 'Sales Dashboard'",
        tool_id="app_crud",
        tool_args={"action": "create", "name": "Sales Dashboard"},
        expected_output='{"id": "app_1", "name": "Sales Dashboard"}',
    ),
    _tool_example(
        request="List my apps",
        tool_id="app_crud",
        tool_args={"action": "list"},
        expected_output='[{"id": "app_1", "name": "Sales Dashboard"}, {"id": "app_2", "name": "CRM"}]',
    ),

    # --- Page CRUD ---
    _tool_example(
        request="Add a new page 'Reports' to the Sales Dashboard app",
        tool_id="page_crud",
        tool_args={"action": "create", "app_id": "app_1", "name": "Reports"},
        expected_output='{"id": "page_1", "name": "Reports", "app_id": "app_1"}',
    ),

    # --- View CRUD ---
    _tool_example(
        request="Create a table view for contacts on the Reports page",
        tool_id="view_crud",
        tool_args={
            "action": "create",
            "page_id": "page_1",
            "view_type": "table",
            "table_id": "tbl_1",
        },
        expected_output='{"id": "view_1", "type": "table", "table_id": "tbl_1"}',
    ),

    # --- Agent CRUD (Management only, no execute) ---
    _tool_example(
        request="Create a new agent for sales automation",
        tool_id="agent_crud",
        tool_args={"method": "create", "data": {"name": "Sales Bot", "description": "Handles sales automation"}},
        expected_output='{"id": 5, "name": "Sales Bot"}',
    ),
    _tool_example(
        request="List all my agents",
        tool_id="agent_crud",
        tool_args={"method": "list"},
        expected_output='[{"id": 5, "name": "Sales Bot"}, {"id": 6, "name": "Support Bot"}]',
    ),

    # --- Agent Execution (Discovered via list → agent:{id}) ---
    # When an agent isn't @mentioned, first list agents then use agent:{id} pattern
    _tool_example(
        request="Run the sales automation agent with task 'process new leads'",
        tool_id="agent:5",  # Lazy-load pattern for discovered agents
        tool_args={"task": "Process new leads from today"},
        expected_output="Sales Bot completed: Processed 12 new leads.",
    ),

    # --- Discovery/Research Tools ---
    _tool_example(
        request="What tables exist in my workspace?",
        tool_id="system_research",
        tool_args={"resource_type": "tables"},
        expected_output='[{"id": "tbl_1", "name": "contacts"}, {"id": "tbl_2", "name": "orders"}]',
    ),
    _tool_example(
        request="Show me my workspace overview",
        tool_id="workspace_overview",
        tool_args={},
        expected_output='{"databases": 2, "tables": 5, "apps": 3, "skills": 10}',
    ),
    _tool_example(
        request="Search for information about competitor pricing",
        tool_id="web_search",
        tool_args={"query": "competitor pricing analysis"},
        expected_output="Found 5 relevant articles about competitor pricing...",
    ),
]


# =============================================================================
# FILESYSTEM TOOLS - Documents, Files
# =============================================================================

FILESYSTEM_TOOL_EXAMPLES: list[dspy.Example] = [
    # --- Document CRUD ---
    _tool_example(
        request="Create a new document called 'Meeting Notes'",
        tool_id="document_crud",
        tool_args={"action": "create", "name": "Meeting Notes", "content": ""},
        expected_output='{"id": "doc_1", "name": "Meeting Notes"}',
    ),
    _tool_example(
        request="Save the meeting summary to a document",
        tool_id="document_crud",
        tool_args={
            "action": "update",
            "doc_id": "doc_1",
            "content": "Meeting Summary: Discussed Q4 goals...",
        },
        expected_output="Document updated successfully.",
    ),
    _tool_example(
        request="List all my documents",
        tool_id="document_crud",
        tool_args={"action": "list"},
        expected_output='[{"id": "doc_1", "name": "Meeting Notes"}, {"id": "doc_2", "name": "Report"}]',
    ),
    _tool_example(
        request="Delete the draft document",
        tool_id="document_crud",
        tool_args={"action": "delete", "doc_id": "doc_draft"},
        expected_output="Document deleted successfully.",
    ),

    # --- File CRUD ---
    _tool_example(
        request="Upload the quarterly report PDF",
        tool_id="file_crud",
        tool_args={"action": "upload", "filename": "Q4_Report.pdf", "content_type": "application/pdf"},
        expected_output='{"id": "file_1", "name": "Q4_Report.pdf", "size": "2.5MB"}',
    ),
    _tool_example(
        request="List all uploaded files",
        tool_id="file_crud",
        tool_args={"action": "list"},
        expected_output='[{"id": "file_1", "name": "Q4_Report.pdf"}, {"id": "file_2", "name": "logo.png"}]',
    ),
    _tool_example(
        request="Download the company logo",
        tool_id="file_crud",
        tool_args={"action": "read", "file_id": "file_2"},
        expected_output='{"url": "https://storage.example.com/file_2/logo.png"}',
    ),
    _tool_example(
        request="Delete the old backup file",
        tool_id="file_crud",
        tool_args={"action": "delete", "file_id": "file_old"},
        expected_output="File deleted successfully.",
    ),
]


# =============================================================================
# SYSTEM AGENTS - Specialized builders
# =============================================================================

SYSTEM_AGENT_EXAMPLES: list[dspy.Example] = [
    # --- Schema Builder ---
    _tool_example(
        request="Design a database schema for a CRM",
        tool_id="agent:schema_builder",
        tool_args={"goal": "Create CRM schema with contacts, companies, deals tables"},
        expected_output="Created schema with 3 tables: contacts, companies, deals",
    ),
    _tool_example(
        request="Plan the database structure for inventory management",
        tool_id="agent:schema_builder",
        tool_args={"goal": "Create inventory schema with products, stock, suppliers"},
    ),

    # --- App Builder ---
    _tool_example(
        request="Build me a dashboard for sales metrics",
        tool_id="agent:app_builder",
        tool_args={"goal": "Create Sales Dashboard app with charts and reports"},
        expected_output="Created app 'Sales Dashboard' with 3 pages",
    ),
    _tool_example(
        request="Create an app to view and manage orders",
        tool_id="agent:app_builder",
        tool_args={"goal": "Create Orders app with table view and filters"},
    ),

    # --- Skill Builder ---
    _tool_example(
        request="Create a skill to send weekly reports",
        tool_id="agent:skill_builder",
        tool_args={
            "goal": "Create automated skill for weekly report generation",
            "trigger": "schedule",
            "schedule": "every Monday 9am",
        },
        expected_output='Created skill "Weekly Report" with scheduled trigger',
    ),
    _tool_example(
        request="Build an automation to notify on new orders",
        tool_id="agent:skill_builder",
        tool_args={"goal": "Create skill triggered on new row in orders table"},
    ),

    # --- Document Builder ---
    _tool_example(
        request="Generate a summary report from sales data",
        tool_id="agent:document_builder",
        tool_args={"goal": "Create PDF report summarizing sales by region"},
        expected_output="Generated report: sales_summary_2024.pdf",
    ),

    # --- Research Agent ---
    _tool_example(
        request="Research competitor pricing strategies",
        tool_id="agent:research_agent",
        tool_args={"query": "competitor pricing analysis for SaaS products"},
        expected_output="Research complete: Found 5 competitor pricing models...",
    ),
]


# =============================================================================
# INTEGRATION TOOLS - Gmail, Slack, etc.
# =============================================================================

INTEGRATION_TOOL_EXAMPLES: list[dspy.Example] = [
    # --- Gmail ---
    _tool_example(
        request="Send an email to the team about the meeting",
        tool_id="gmail_send_email",
        tool_args={
            "to": "team@company.com",
            "subject": "Meeting Tomorrow",
            "body": "Hi team, reminder about our meeting tomorrow at 10am.",
        },
        expected_output="Email sent successfully to team@company.com",
    ),
    _tool_example(
        request="Email the weekly report to stakeholders",
        tool_id="gmail_send_email",
        tool_args={
            "to": "stakeholders@company.com",
            "subject": "Weekly Report",
            "body": "Please find attached the weekly report.",
        },
    ),
    _tool_example(
        request="Create a draft email for the client proposal",
        tool_id="gmail_create_draft",
        tool_args={
            "to": "client@example.com",
            "subject": "Proposal",
            "body": "Dear Client...",
        },
    ),

    # --- Slack ---
    _tool_example(
        request="Post an update to the #general channel",
        tool_id="slack_post_message",
        tool_args={"channel": "#general", "text": "Good morning team! Here's our daily update..."},
        expected_output="Message posted to #general",
    ),
    _tool_example(
        request="Send a message to the engineering team on Slack",
        tool_id="slack_post_message",
        tool_args={"channel": "#engineering", "text": "Deployment complete!"},
    ),
    _tool_example(
        request="Notify the team about the deployment in #releases",
        tool_id="slack_post_message",
        tool_args={"channel": "#releases", "text": "v2.1.0 deployed to production"},
    ),

    # --- Google Sheets ---
    _tool_example(
        request="Add a row to the sales spreadsheet",
        tool_id="google_sheets_append_row",
        tool_args={
            "spreadsheet_id": "sheet_123",
            "range": "Sales!A:D",
            "values": ["2024-01-15", "Acme Corp", "$5000", "Won"],
        },
        expected_output="Row added to Sales spreadsheet",
    ),
    _tool_example(
        request="Read data from the budget spreadsheet",
        tool_id="google_sheets_read",
        tool_args={"spreadsheet_id": "sheet_456", "range": "Budget!A1:D10"},
    ),

    # --- Google Calendar ---
    _tool_example(
        request="Schedule a meeting for next Tuesday at 2pm",
        tool_id="google_calendar_create_event",
        tool_args={
            "title": "Team Meeting",
            "start_time": "2024-01-16T14:00:00",
            "end_time": "2024-01-16T15:00:00",
            "attendees": ["team@company.com"],
        },
        expected_output="Event created: Team Meeting on Jan 16 at 2pm",
    ),
    _tool_example(
        request="Check my availability for tomorrow",
        tool_id="google_calendar_list_events",
        tool_args={"date": "2024-01-15"},
    ),

    # --- GitHub ---
    _tool_example(
        request="Create a new issue for the login bug",
        tool_id="github_create_issue",
        tool_args={
            "repo": "company/webapp",
            "title": "Login button not working",
            "body": "Users report the login button is unresponsive on mobile.",
            "labels": ["bug", "high-priority"],
        },
        expected_output="Issue #42 created in company/webapp",
    ),
    _tool_example(
        request="Comment on PR #123",
        tool_id="github_create_comment",
        tool_args={"repo": "company/webapp", "issue_number": 123, "body": "LGTM!"},
    ),

    # --- Notion ---
    _tool_example(
        request="Create a new page for meeting notes",
        tool_id="notion_create_page",
        tool_args={
            "parent_id": "workspace_123",
            "title": "Team Meeting Notes",
            "content": "## Agenda\n- Review Q4 goals\n- Discuss roadmap",
        },
        expected_output="Page created: Team Meeting Notes",
    ),

    # --- Stripe ---
    _tool_example(
        request="Create an invoice for the customer",
        tool_id="stripe_create_invoice",
        tool_args={"customer_id": "cus_123", "amount": 5000, "currency": "usd"},
        expected_output="Invoice inv_456 created for $50.00",
    ),

    # --- Twilio ---
    _tool_example(
        request="Send an SMS to the customer",
        tool_id="twilio_send_sms",
        tool_args={
            "to": "+15551234567",
            "body": "Your order has shipped! Tracking: ABC123",
        },
        expected_output="SMS sent to +15551234567",
    ),
]


# =============================================================================
# COMBINED EXPORTS
# =============================================================================

# Curated examples - high quality with full args/output
CURATED_TOOL_EXAMPLES: list[dspy.Example] = (
    INTERNAL_TOOL_EXAMPLES
    + FILESYSTEM_TOOL_EXAMPLES
    + SYSTEM_AGENT_EXAMPLES
    + INTEGRATION_TOOL_EXAMPLES
)

# For backwards compatibility - all examples combined
TOOL_EXAMPLES: list[dspy.Example] = CURATED_TOOL_EXAMPLES
