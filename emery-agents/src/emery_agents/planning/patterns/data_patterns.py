"""
Planning patterns for data operations (table modifications and documents).

Migrated from:
- reasoning/capabilities/table_builder.py PLANNING_GUIDANCE
- reasoning/capabilities/document_builder.py PLANNING_GUIDANCE
"""

from emery_agents.planning.pattern import AutoApprovePolicy, PlanningPattern

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


ROW_OPERATIONS_PATTERN = PlanningPattern(
    id="plan:row_operations",
    name="Row/Record Operations",
    description="Planning patterns for adding, updating, or deleting records in tables. "
    "Use for data entry and record management operations.",
    triggers=[
        "add record",
        "create entry",
        "insert data",
        "update record",
        "delete record",
        "add row",
        "edit row",
        "remove row",
        "new entry",
    ],
    capability_ids=["agent:table_builder"],
    strategy="""
1. Identify target table (check workspace_context)
2. Determine operation: create, update, or delete
3. For create/update: specify field values explicitly
4. For delete: confirm the exact record(s) to remove

OPERATIONS:
- Create: add new record with field values
- Update: modify existing record by ID
- Delete: remove record by ID (DESTRUCTIVE)

IMPORTANT:
- Always use exact table name from workspace_context
- Include record ID for update/delete operations
- Specify all required field values for create
""",
    tool_sequence=["table_builder"],
    step_templates=[
        "Add record to table '[table_name]' with values: [field]='[value]', [field]='[value]'. Verify: record created.",
        "Update record (ID: [id]) in table '[table_name]' setting [field]='[value]'. Verify: record updated.",
        "Delete record (ID: [id]) from table '[table_name]'. WARNING: Data will be lost. Verify: record deleted.",
    ],
    examples=[
        {
            "request": "Add a new client named John Smith",
            "plan_steps": [
                "Add record to table 'clients' with values: name='John Smith', status='Active'. Verify: record created.",
            ],
        },
        {
            "request": "Update the priority of task #123 to High",
            "plan_steps": [
                "Update record (ID: 123) in table 'tasks' setting priority='High'. Verify: record updated.",
            ],
        },
        {
            "request": "Delete the old test record",
            "plan_steps": [
                "Delete record (ID: 456) from table 'tests'. WARNING: Data will be lost. Verify: record deleted.",
            ],
        },
    ],
    common_mistakes=[
        "Not specifying field values for create",
        "Missing record ID for update/delete",
        "Not checking workspace_context for table name",
        "Deleting without confirmation",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values"],
)


FILE_OPERATIONS_PATTERN = PlanningPattern(
    id="plan:file_operations",
    name="File Operations",
    description="Planning patterns for uploading, managing, and linking files to records. "
    "Files can be standalone or attached to table records.",
    triggers=[
        "upload file",
        "attach file",
        "add attachment",
        "manage files",
        "link file",
        "add image",
        "upload document",
    ],
    capability_ids=["agent:file_manager"],
    strategy="""
1. Identify file source (upload or existing)
2. Determine target location (standalone or linked to record)
3. For links: identify the table/record to attach to
4. Set file metadata if needed

FILE OPERATIONS:
- Upload: add new file from source
- Link: attach existing file to a record
- Update: modify file metadata
- Delete: remove file (DESTRUCTIVE)

IMPORTANT:
- Files can be linked to records via attachment fields
- Include file type/metadata when relevant
""",
    tool_sequence=["file_manager"],
    step_templates=[
        "Upload file '[filename]' to table '[table_name]', record (ID: [id]). Verify: file attached.",
        "Link existing file (ID: [file_id]) to record (ID: [record_id]) in table '[table_name]'. Verify: file linked.",
        "Delete file (ID: [file_id]). WARNING: File will be removed. Verify: file deleted.",
    ],
    examples=[
        {
            "request": "Attach the contract PDF to client record",
            "plan_steps": [
                "Upload file 'contract.pdf' to table 'clients', record (ID: 42). Verify: file attached.",
            ],
        },
        {
            "request": "Link the existing logo to the project",
            "plan_steps": [
                "Link existing file (ID: 101) to record (ID: 55) in table 'projects'. Verify: file linked.",
            ],
        },
    ],
    common_mistakes=[
        "Not specifying target record for attachment",
        "Missing file ID for link operations",
        "Not verifying file upload success",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "additive_only"],
)


# Export all data-related patterns
DATA_PATTERNS = [
    TABLE_MODIFY_PATTERN,
    TABLE_DELETE_FIELD_PATTERN,
    DOCUMENT_CREATE_PATTERN,
    ROW_OPERATIONS_PATTERN,
    FILE_OPERATIONS_PATTERN,
]
