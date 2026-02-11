"""
Planning patterns for schema_builder capability.

Migrated from: reasoning/capabilities/schema_builder.py PLANNING_GUIDANCE
"""

from emery_agents.planning.pattern import AutoApprovePolicy, PlanningPattern

SCHEMA_DESIGN_PATTERN = PlanningPattern(
    id="plan:schema_design",
    name="Database Schema Design",
    description="Planning patterns for creating database tables and fields. "
    "Use Emery field types (text, number, boolean, single-select, etc.), "
    "NOT SQL types (VARCHAR, INT, etc.).",
    triggers=[
        "create table",
        "database schema",
        "track data",
        "store information",
        "data structure",
        "add fields",
        "set up a CRM",
        "build a database",
    ],
    capability_ids=["agent:schema_builder"],
    strategy="""
1. Identify entities (what nouns need tables)
2. Identify relationships (how entities connect)
3. Define fields per entity with EXPLICIT Emery types
4. Create tables in dependency order (referenced tables first for relations)

EMERY FIELD TYPES (CRITICAL - Not SQL):
- text: Names, descriptions, free text
- number: Quantities, amounts
- boolean: YES/NO questions
- single-select: Pick ONE from options
- multi-select: Pick MULTIPLE from options
- date: Dates and timestamps
- email: Email addresses
- phone: Phone numbers
- relation: Links between tables

NEVER use: VARCHAR, INT, TEXT, BIGINT, FLOAT, PRIMARY KEY, FOREIGN KEY, ENUM, REFERENCES
IDs are auto-generated - don't include id fields in plans.

RELATIONSHIPS:
- WRONG: client_id (INT, Foreign Key referencing Clients)
- CORRECT: client_id (relation to Clients)
- Target table must exist before creating a relation field to it
""",
    tool_sequence=["schema_builder"],
    step_templates=[
        "Create table '[name]' with fields: [field_name] ([type]), [field_name] ([type]: [options]). Verify: table exists with [N] fields.",
        "Add field '[field_name]' ([type]: [options/constraints]) to table '[table_name]'. Verify: field exists on table.",
    ],
    examples=[
        {
            "request": "Add a phone field to the contacts table",
            "plan_steps": [
                "Add field 'phone' (phone) to table 'contacts'. Verify: phone field exists."
            ],
        },
        {
            "request": "Create a contacts table with name and email",
            "plan_steps": [
                "Create table 'contacts' with fields: name (text), email (email). Verify: table exists with 2 fields."
            ],
        },
        {
            "request": "Track clients and their projects",
            "plan_steps": [
                "Create table 'clients' with fields: name (text), email (email), status (single-select: Active, Inactive). Verify: clients table exists.",
                "Create table 'projects' with fields: name (text), client_id (relation to clients), deadline (date), status (single-select: Planning, In Progress, Completed). Verify: projects table exists with client relation.",
            ],
        },
    ],
    common_mistakes=[
        "Creating relation fields before the target table exists",
        "Not specifying field types explicitly (inferring instead of stating)",
        "Using SQL types instead of Emery types (VARCHAR instead of text)",
        "Including id fields (they're auto-generated)",
        "Writing vague step descriptions ('set up the table with relevant fields')",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


SCHEMA_MODIFICATION_PATTERN = PlanningPattern(
    id="plan:schema_modify",
    name="Schema Modification",
    description="Patterns for modifying existing tables - adding, updating, or removing fields. "
    "Check workspace_context for existing tables before modifying.",
    triggers=[
        "add field",
        "add column",
        "modify field",
        "update field",
        "change field type",
        "add to existing table",
    ],
    capability_ids=["agent:schema_builder"],
    strategy="""
1. Check workspace_context for existing table and its fields
2. Identify what changes are needed
3. For additions: specify field name, type, and constraints
4. For modifications: include table ID from workspace_context if known

IMPORTANT:
- Modify rather than recreate existing tables
- Use exact table/field names from workspace_context
- Include table ID when available for faster lookup
""",
    tool_sequence=["schema_builder"],
    step_templates=[
        "Add field '[field_name]' ([type]) to table '[table_name]' (ID: [table_id]). Verify: field exists.",
        "Modify field '[field_name]' on table '[table_name]' to type [new_type]. Verify: field type updated.",
    ],
    examples=[
        {
            "request": "Add a phone number to my contacts",
            "plan_steps": [
                "Add field 'phone' (phone) to table 'contacts'. Verify: phone field exists on contacts."
            ],
        },
    ],
    common_mistakes=[
        "Not checking workspace_context for existing table structure",
        "Recreating a table that already exists",
        "Not specifying the exact field type",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


SCHEMA_DELETE_PATTERN = PlanningPattern(
    id="plan:schema_delete",
    name="Schema Deletion",
    description="Patterns for deleting tables or fields. DESTRUCTIVE operations that always require approval.",
    triggers=[
        "delete table",
        "remove table",
        "drop table",
        "delete field",
        "remove field",
    ],
    capability_ids=["agent:schema_builder"],
    strategy="""
1. Confirm the exact table/field to delete
2. Check for dependent relations (other tables linking to this one)
3. Warn about data loss implications
4. Include table/field ID for precise targeting

DESTRUCTIVE OPERATION - Always requires user approval.
""",
    tool_sequence=["schema_builder"],
    step_templates=[
        "Delete table '[table_name]' (ID: [table_id]). WARNING: All data will be lost. Verify: table no longer exists.",
        "Remove field '[field_name]' from table '[table_name]'. Verify: field no longer exists.",
    ],
    examples=[
        {
            "request": "Delete the old_data table",
            "plan_steps": [
                "Delete table 'old_data'. WARNING: All data will be permanently deleted. Verify: table no longer exists."
            ],
        },
    ],
    common_mistakes=[
        "Not warning about data loss",
        "Deleting tables that have dependent relations",
    ],
    auto_approve_policy=AutoApprovePolicy.EXPLICIT,  # Always require approval
    auto_approve_conditions=[],  # No auto-approve for destructive ops
)


DATABASE_CREATE_PATTERN = PlanningPattern(
    id="plan:database_create",
    name="Database Creation",
    description="Planning patterns for creating new databases (containers for tables). "
    "Databases are organizational containers that group related tables together.",
    triggers=[
        "create database",
        "new database",
        "set up database",
        "initialize database",
        "add database",
    ],
    capability_ids=["agent:schema_builder"],
    strategy="""
1. Define database name and purpose
2. Identify tables to create within the database
3. Create database first, then add tables

DATABASE STRUCTURE:
- Databases contain tables
- Tables are organized by domain/purpose
- Create database before adding tables to it

NAMING:
- Use clear, descriptive names
- Reflect the business domain (e.g., 'CRM', 'Inventory', 'HR')
""",
    tool_sequence=["schema_builder"],
    step_templates=[
        "Create database '[name]' with description: '[purpose]'. Verify: database exists.",
        "Create database '[name]'. Then create tables: [table1], [table2]. Verify: database and tables exist.",
    ],
    examples=[
        {
            "request": "Create a CRM database",
            "plan_steps": [
                "Create database 'CRM' with description: 'Customer relationship management'. Verify: database exists.",
            ],
        },
        {
            "request": "Set up an inventory tracking database with products and suppliers",
            "plan_steps": [
                "Create database 'Inventory' with description: 'Product and supplier management'. Verify: database exists.",
                "Create table 'products' with fields: name (text), sku (text), quantity (number), price (number). Verify: products table exists.",
                "Create table 'suppliers' with fields: name (text), email (email), phone (phone). Verify: suppliers table exists.",
            ],
        },
    ],
    common_mistakes=[
        "Not specifying database purpose/description",
        "Creating tables before the database exists",
        "Vague database names",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


# Export all schema patterns
SCHEMA_PATTERNS = [
    SCHEMA_DESIGN_PATTERN,
    SCHEMA_MODIFICATION_PATTERN,
    SCHEMA_DELETE_PATTERN,
    DATABASE_CREATE_PATTERN,
]
