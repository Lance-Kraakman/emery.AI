"""
Planning guidance for app_builder capability.

This replaces prompts/capabilities/app_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## App Builder (agent:app_builder)

**Choose when**: User wants a visual interface, dashboard, or UI for their data.
**Examples**: "create a client portal", "build a dashboard", "make an inventory app"

### What app_builder Creates

- Apps (containers for pages)
- Pages (visual layouts with Puck blocks)
- Views (data grids, detail views, forms) embedded in pages

### View Types

- **Grid view**: Table/spreadsheet display of records — needs source table and column list
- **Detail view**: Single record with all fields — needs source table
- **Form view**: Input form for creating/editing records — needs source table and field list
- **Calendar view**: Date-based display — needs source table and date field
- **Kanban view**: Card-based grouped by status — needs source table and grouping field

### Common App Patterns
- **Single-entity app**: 1 table, 2 pages (list grid + detail/form)
- **Multi-entity CRUD**: 2-4 related tables, 1 page per table (grid views), optional dashboard
- **Pipeline app**: 1 table with status field, kanban view page + grid view page
- **Reporting app**: Existing tables, calendar/kanban views, no new tables needed

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every app_builder step description:
1. **APP NAME**: Exact name in quotes
2. **PAGES**: List each page with its name and purpose
3. **VIEWS**: For each page, specify: view type, source table name, and columns/fields to display
4. **OUTCOME**: What the executor should verify after completion

**Step description templates:**

Create app with pages:
"Create app '[name]' with pages: '[page1]' (grid view on '[table1]' table, columns: [col1, col2, col3]), '[page2]' (form view on '[table2]' table, fields: [f1, f2]). Verify: app exists with [N] pages."

Add page to existing app:
"Add page '[page_name]' to app '[app_name]' with [view_type] view on '[table_name]' table, columns: [col1, col2]. Verify: page exists in app."

BAD: "Create an app for the CRM"
GOOD: "Create app 'CRM' with pages: 'Clients' (grid view on 'clients' table, columns: full_name, email, company, status), 'Orders' (grid view on 'orders' table, columns: order_number, amount, status, client). Verify: app exists with 2 pages."
"""
