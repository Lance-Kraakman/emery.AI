"""
Planning guidance for table_builder capability.

This replaces prompts/capabilities/table_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Table Builder (agent:table_builder)

**Choose when**: User needs quick modifications to existing tables.
**Examples**: "add a field to my table", "rename a column", "remove old fields"

### When to Use table_builder vs schema_builder

- **table_builder**: Single table changes, quick field additions
- **schema_builder**: Complex schema design, multiple tables, relationships

### Before Modifying a Table

Ensure you have:
- Existing table ID or name
- Field(s) to add/modify/remove
- Field types (Emery types, not SQL)

### Step Format Examples

- "Add field 'priority' (single-select: High, Medium, Low) to table ID 42"
- "Remove field 'legacy_code' from 'customers' table"
- "Rename field 'fname' to 'first_name' in 'contacts' table"

### Emery Field Types

Same as schema_builder: text, number, boolean, single-select, multi-select, date, email, phone, relation
"""
