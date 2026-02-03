"""
Planning guidance for table_builder capability.

This replaces prompts/capabilities/table_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Table Builder (agent:table_builder)

**Choose when**: User needs quick modifications to existing tables.
**Examples**: "add a field to my table", "rename a column", "remove old fields"

### Tools Used by This Capability
The executor uses: **table_crud**, **field_crud**, **row_crud**.
- table_crud: Modify table properties (rename, update)
- field_crud: Add/modify/remove fields on a table
- row_crud: Create/update/delete records in a table
Set tool_call to the relevant tool (e.g., tool_call="field_crud" for adding fields, tool_call="row_crud" for adding records).

### When to Use table_builder vs schema_builder

- **table_builder**: Single table changes, quick field additions, record operations
- **schema_builder**: Complex schema design, multiple tables, relationships

### Emery Field Types

Same as schema_builder: text, number, boolean, single-select, multi-select, date, email, phone, relation.
NEVER use SQL types.

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every table_builder step description:
1. **ACTION**: Add field / Remove field / Rename field / Update records
2. **TARGET TABLE**: Exact table name in quotes (and ID if known from workspace_context)
3. **FIELD DETAILS**: Field name, type, constraints (for add/modify operations)
4. **OUTCOME**: What the executor should verify

**Step description templates:**

Add field:
"Add field '[field_name]' ([type]: [options]) to table '[table_name]'. Verify: field exists on table."

Remove field:
"Remove field '[field_name]' from table '[table_name]'. Verify: field no longer exists."

Rename field:
"Rename field '[old_name]' to '[new_name]' in table '[table_name]'. Verify: field renamed."

BAD: "Add some fields to the contacts table"
GOOD: "Add field 'priority' (single-select: High, Medium, Low) to table 'tasks'. Verify: field exists with 3 options."
"""
