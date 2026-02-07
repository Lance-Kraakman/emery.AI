"""
Planning patterns for data operations (table modifications and documents).

Migrated from:
- reasoning/capabilities/table_builder.py PLANNING_GUIDANCE
- reasoning/capabilities/document_builder.py PLANNING_GUIDANCE
"""

from emery_agents.planning.pattern import PlanningPattern, AutoApprovePolicy


TABLE_MODIFY_PATTERN = PlanningPattern(
    id="plan:table_modify",
    name="Table Modification",
    description="Planning patterns for quick modifications to existing tables. "
                "For complex schema design with multiple tables, use schema_builder instead.",
    triggers=[
        "add field to table",
        "add column",
        "remove field",
        "rename column",
        "update table",
        "modify table",
    ],
    capability_ids=["agent:table_builder"],
    strategy="""
1. Identify the target table (check workspace_context)
2. Determine the operation (add/remove/rename field)
3. Specify field details with Emery types
4. Verify the change

WHEN TO USE:
- table_builder: Single table changes, quick field additions
- schema_builder: Complex schema design, multiple tables, relationships

EMERY FIELD TYPES:
text, number, boolean, single-select, multi-select, date, email, phone, relation.
NEVER use SQL types.
""",
    tool_sequence=["table_builder"],
    step_templates=[
        "Add field '[field_name]' ([type]: [options]) to table '[table_name]'. Verify: field exists on table.",
        "Remove field '[field_name]' from table '[table_name]'. Verify: field no longer exists.",
        "Rename field '[old_name]' to '[new_name]' in table '[table_name]'. Verify: field renamed.",
    ],
    examples=[
        {
            "request": "Add a priority field to the tasks table",
            "plan_steps": [
                "Add field 'priority' (single-select: High, Medium, Low) to table 'tasks'. Verify: field exists with 3 options.",
            ],
        },
        {
            "request": "Remove the old_status column from orders",
            "plan_steps": [
                "Remove field 'old_status' from table 'orders'. Verify: field no longer exists.",
            ],
        },
    ],
    common_mistakes=[
        "Not specifying field type",
        "Using SQL types instead of Emery types",
        "Not verifying the change",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


TABLE_DELETE_FIELD_PATTERN = PlanningPattern(
    id="plan:table_delete_field",
    name="Field Deletion",
    description="Planning patterns for removing fields from tables. DESTRUCTIVE operation.",
    triggers=[
        "delete field",
        "remove field",
        "drop column",
    ],
    capability_ids=["agent:table_builder"],
    strategy="""
1. Confirm the exact field and table
2. Check for dependencies (other tables linking to this field)
3. Warn about data loss
4. Remove the field

DESTRUCTIVE OPERATION - Always requires user approval.
Data in this field will be permanently deleted.
""",
    tool_sequence=["table_builder"],
    step_templates=[
        "Remove field '[field_name]' from table '[table_name]'. WARNING: Data in this field will be lost. Verify: field no longer exists.",
    ],
    examples=[
        {
            "request": "Remove the deprecated_status field",
            "plan_steps": [
                "Remove field 'deprecated_status' from table 'orders'. WARNING: Data in this field will be lost. Verify: field no longer exists.",
            ],
        },
    ],
    common_mistakes=[
        "Not warning about data loss",
        "Removing fields that other tables link to",
    ],
    auto_approve_policy=AutoApprovePolicy.EXPLICIT,  # Always require approval for destructive ops
    auto_approve_conditions=[],
)


DOCUMENT_CREATE_PATTERN = PlanningPattern(
    id="plan:document_create",
    name="Document Creation",
    description="Planning patterns for creating rich-text documents, templates, and content. "
                "Documents can be standalone or linked to table records.",
    triggers=[
        "create document",
        "write document",
        "draft document",
        "create proposal",
        "write report",
        "meeting notes",
        "contract",
    ],
    capability_ids=["agent:document_builder"],
    strategy="""
1. Determine document title and purpose
2. Decide location (standalone or linked to table record)
3. Define section structure
4. Specify content for each section

DOCUMENT FEATURES:
- Rich text formatting (bold, italic, lists)
- Headings and sections
- Tables and embedded content
- Can be linked to table records via field
""",
    tool_sequence=["document_builder"],
    step_templates=[
        "Create document '[title]' in table '[table_name]', field '[field_name]'. Sections: [Section1] ([content description]), [Section2] ([content description]). Verify: document exists with [N] sections.",
        "Create document '[title]' with sections: [Section1], [Section2], [Section3]. Verify: document exists.",
    ],
    examples=[
        {
            "request": "Create a project proposal document",
            "plan_steps": [
                "Create document 'Project Proposal' in table 'proposals', field 'content'. Sections: Introduction (project overview), Scope (deliverables and timeline), Pricing (cost breakdown). Verify: document exists with 3 sections.",
            ],
        },
        {
            "request": "Write meeting notes for today's standup",
            "plan_steps": [
                "Create document 'Standup Notes - Today' with sections: Attendees, Updates, Blockers, Action Items. Verify: document exists.",
            ],
        },
    ],
    common_mistakes=[
        "Not specifying section structure",
        "Missing document location (table/field or standalone)",
        "Vague content descriptions",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


# Export all data-related patterns
DATA_PATTERNS = [
    TABLE_MODIFY_PATTERN,
    TABLE_DELETE_FIELD_PATTERN,
    DOCUMENT_CREATE_PATTERN,
]
