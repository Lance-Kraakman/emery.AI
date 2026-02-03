"""
Planning guidance for schema_builder capability.

This replaces prompts/capabilities/schema_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Schema Builder (agent:schema_builder)

**Choose when**: User needs database tables, fields, or data structure.
**Examples**: "create a contacts table", "add fields for tracking", "set up a CRM"

### Tools Used by This Capability
The executor uses these tools: **table_crud**, **field_crud**, **database_crud**.
- table_crud: Create/list/get/update/delete tables
- field_crud: Create/list/get/update/delete fields on a table
- database_crud: Create/list/get/update/delete databases
Set tool_call to the primary tool (e.g., tool_call="table_crud" for table creation, tool_call="field_crud" for adding fields to an existing table).

### Emery Field Types (CRITICAL - Not SQL)

| Type | Use For | Example |
|------|---------|---------|
| text | Names, descriptions, free text | name, notes, address |
| number | Quantities, amounts | age, quantity, price |
| boolean | YES/NO questions | is_active, has_consent |
| single-select | Pick ONE from options | status, category |
| multi-select | Pick MULTIPLE from options | tags, services |
| date | Dates and timestamps | birth_date, created_at |
| email | Email addresses | contact_email |
| phone | Phone numbers | mobile, work_phone |
| relation | Links between tables | client_id (relation to Clients) |

**NEVER use**: VARCHAR, INT, TEXT, BIGINT, FLOAT, PRIMARY KEY, FOREIGN KEY, ENUM, REFERENCES
**IDs are auto-generated** - don't include id fields in plans.

### Relationships

Use `relation` type for links between tables:
- WRONG: `client_id (INT, Foreign Key referencing Clients)`
- CORRECT: `client_id (relation to Clients)`
- CONSTRAINT: The target table must exist before creating a relation field to it.

### Common Patterns
- **Multi-table system** (CRM, inventory, etc.): Create base tables first, then add relation fields linking them.
- **Adding to existing**: Check workspace_context for existing tables. Modify rather than recreate.
- **Status tracking**: Use single-select with explicit option values (e.g., Active, Inactive, Pending).

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every schema_builder step description:
1. **ACTION**: Create table / Add field / Modify field / Delete field
2. **TARGET**: Exact table name (in quotes). If modifying, include table ID if known from workspace_context.
3. **FIELDS**: For each field, include: name, type (from Emery types), and constraints
   - For single-select/multi-select: include ALL option values
   - For relations: include the target table name
4. **OUTCOME**: What the executor should verify after completion

**Step description templates:**

Create table:
"Create table '[name]' with fields: [field_name] ([type]), [field_name] ([type]: [options]). Verify: table exists with [N] fields."

Add field to existing table:
"Add field '[field_name]' ([type]: [options/constraints]) to table '[table_name]'. Verify: field exists on table."

BAD: "Set up the contacts table with relevant fields"
GOOD: "Create table 'contacts' with fields: full_name (text), email (email), phone (phone), status (single-select: Active, Inactive, Lead). Verify: table exists with 4 fields."
"""
