"""
Planning guidance for view_builder capability.

This replaces prompts/capabilities/view_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## View Builder (agent:view_builder)

**Choose when**: User wants different ways to visualize or filter table data.
**Examples**: "create a filtered view", "show only active customers", "make a kanban board"

### What view_builder Creates

- Grid views (spreadsheet-like)
- Detail views (single record)
- Form views (data entry)
- Filtered/sorted views

### Before Creating a View

Ensure you have:
- Source table for the view
- View type (grid, detail, form, etc.)
- Columns/fields to include
- Filters or sorting (if any)

### Step Format Examples

- "Create grid view 'Active Customers' from 'customers' table filtered by status='Active'"
- "Create detail view for 'orders' table showing all fields"
- "Create form view 'New Lead' for 'leads' table with fields: name, email, source"

### View Types

- **Grid**: Spreadsheet display, multiple records
- **Detail**: Single record, all fields
- **Form**: Data entry, create/edit records
- **Calendar**: Date-based display
- **Kanban**: Card-based, grouped by status
"""
