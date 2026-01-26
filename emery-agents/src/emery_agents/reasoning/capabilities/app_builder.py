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
- Views (data grids, detail views, forms)

### Before Creating an App

Ensure you have:
- App name and purpose
- Which tables/data to display
- Page structure (what pages needed)
- View types for each page (grid, detail, form)

### Step Format Examples

- "Create app 'Client Portal' with a grid view of 'clients' table"
- "Add page 'Order Details' to 'Sales Dashboard' app with detail view of 'orders' table"
- "Create app 'Inventory Manager' with pages: Dashboard (summary stats), Products (grid view of products table), Add Product (form view)"

### View Types

- **Grid view**: Table/spreadsheet display of records
- **Detail view**: Single record with all fields
- **Form view**: Input form for creating/editing records
- **Dashboard**: Summary statistics and charts
"""
