"""
Planning guidance for schema_builder capability.

This replaces prompts/capabilities/schema_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Schema Builder (agent:schema_builder)

**Choose when**: User needs database tables, fields, or data structure.
**Examples**: "create a contacts table", "add fields for tracking", "set up a CRM"

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

### Step Format Examples

- "Create 'clients' table with fields: name (text), email (email), status (single-select: Active, Inactive, Pending)"
- "Create 'orders' table with fields: order_number (text), total (number), order_date (date), client_id (relation to clients)"
- "Add field 'priority' (single-select: High, Medium, Low) to 'tasks' table"

### Relationships

Use `relation` type for links between tables:
- WRONG: `client_id (INT, Foreign Key referencing Clients)`
- CORRECT: `client_id (relation to Clients)`

### Discovery First

Check workspace_context for existing tables before creating new ones.
"""
