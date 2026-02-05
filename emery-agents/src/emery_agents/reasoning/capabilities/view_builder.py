"""
Planning guidance for view_builder capability.

This replaces prompts/capabilities/view_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## View Builder (agent:view_builder)

**Choose when**: User wants different ways to visualize or filter table data.
**Examples**: "create a filtered view", "show only active customers", "make a kanban board"

### View Types

- **Grid**: Spreadsheet display, multiple records — specify columns to show
- **Detail**: Single record, all fields — specify which fields
- **Form**: Data entry, create/edit records — specify editable fields
- **Calendar**: Date-based display — requires a date field to group by
- **Kanban**: Card-based, grouped by status — requires a single-select field to group by, specify card fields

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every view_builder step description:
1. **VIEW TYPE**: Grid, detail, form, calendar, or kanban
2. **VIEW NAME**: Exact name in quotes
3. **SOURCE TABLE**: Exact table name in quotes
4. **COLUMNS/FIELDS**: Which fields to display
5. **FILTERS/GROUPING**: If applicable — filter conditions, sort order, grouping field
6. **OUTCOME**: What the executor should verify

**Step description templates:**

Grid view:
"Create grid view '[name]' on table '[table]' with columns: [col1, col2, col3]. Filter: [field]='[value]'. Verify: view exists with correct columns and filter."

Kanban view:
"Create kanban view '[name]' on table '[table]', grouped by field '[status_field]' (columns: [Option1, Option2, Option3]). Show fields: [f1, f2, f3]. Verify: view exists with correct grouping."

Calendar view:
"Create calendar view '[name]' on table '[table]', date field: '[date_field]'. Show fields: [f1, f2]. Verify: view exists."

BAD: "Create a view for active customers"
GOOD: "Create grid view 'Active Customers' on table 'customers' with columns: full_name, email, phone, company. Filter: status='Active'. Verify: view exists with filter applied."
"""
