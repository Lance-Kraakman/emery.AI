"""
Planning patterns for app, page, and view building capabilities.

Migrated from:
- reasoning/capabilities/app_builder.py PLANNING_GUIDANCE
- reasoning/capabilities/page_builder.py PLANNING_GUIDANCE
- reasoning/capabilities/view_builder.py PLANNING_GUIDANCE
"""

from emery_agents.planning.pattern import AutoApprovePolicy, PlanningPattern

APP_DESIGN_PATTERN = PlanningPattern(
    id="plan:app_design",
    name="App Design",
    description="Planning patterns for creating visual interfaces, dashboards, and multi-page apps. "
    "Apps contain pages, pages contain views (grids, forms, detail blocks).",
    triggers=[
        "create app",
        "build app",
        "make app",
        "dashboard",
        "client portal",
        "admin panel",
        "inventory app",
        "crm interface",
    ],
    capability_ids=["agent:app_builder"],
    strategy="""
1. Identify the app purpose and name
2. List required pages (one per major entity or function)
3. For each page, specify view type and source table
4. Create data tables FIRST (via schema_builder) if they don't exist

VIEW TYPES:
- Grid view: Table/spreadsheet display — needs source table + columns
- Detail view: Single record — needs source table
- Form view: Input form — needs source table + fields
- Calendar view: Date-based — needs source table + date field
- Kanban view: Card-based grouped by status — needs source table + grouping field

COMMON APP PATTERNS:
- Single-entity: 1 table, 2 pages (list grid + detail/form)
- Multi-entity CRUD: 2-4 related tables, 1 page per table
- Pipeline app: 1 table with status field, kanban + grid pages
- Reporting app: Calendar/kanban views on existing tables

ORDER: Create tables before apps. Create apps before pages.
""",
    tool_sequence=["app_builder"],
    step_templates=[
        "Create app '[name]' with pages: '[page1]' (grid view on '[table1]' table, columns: [col1, col2, col3]), '[page2]' (form view on '[table2]' table, fields: [f1, f2]). Verify: app exists with [N] pages.",
        "Add page '[page_name]' to app '[app_name]' with [view_type] view on '[table_name]' table, columns: [col1, col2]. Verify: page exists in app.",
    ],
    examples=[
        {
            "request": "Create a CRM app with clients and orders",
            "plan_steps": [
                "Create app 'CRM' with pages: 'Clients' (grid view on 'clients' table, columns: full_name, email, company, status), 'Orders' (grid view on 'orders' table, columns: order_number, amount, status, client). Verify: app exists with 2 pages.",
            ],
        },
        {
            "request": "Build a client portal dashboard",
            "plan_steps": [
                "Create app 'Client Portal' with pages: 'Dashboard' (stats + grid view on 'projects' table, columns: name, status, deadline). Verify: app exists with 1 page.",
            ],
        },
    ],
    common_mistakes=[
        "Creating app before the source tables exist",
        "Not specifying columns for grid views",
        "Not including source table name for views",
        "Vague page names like 'Main Page'",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


PAGE_DESIGN_PATTERN = PlanningPattern(
    id="plan:page_design",
    name="Page Design",
    description="Planning patterns for adding or modifying pages within existing apps. "
    "Pages are visual layouts with Puck blocks (Hero, Stats, Grid, Form, etc.).",
    triggers=[
        "add page",
        "create page",
        "dashboard page",
        "form page",
        "detail page",
        "add to app",
    ],
    capability_ids=["agent:page_builder"],
    strategy="""
1. Identify the parent app (check workspace_context)
2. Determine page purpose and name
3. List blocks in display order (top to bottom)
4. For data blocks, specify source table and columns/fields

BLOCK TYPES (Puck Blocks):
- Hero: Header sections with title/subtitle
- Stats: Numeric displays (counters, metrics)
- Table/Grid: Data grids bound to a table — needs source + columns
- Form: Input forms — needs source + fields
- Cards: Content cards for summary data
- Detail: Single record display — needs source table
- Navigation: Menus and links

COMMON PAGE LAYOUTS:
- Data table page: Hero heading → Grid view block
- Dashboard page: Hero → Stats row → Grid view
- Detail page: Hero → Detail view block
- Form page: Hero → Form view block
""",
    tool_sequence=["page_builder"],
    step_templates=[
        "Add page '[page_name]' to app '[app_name]' with blocks: Hero (title: '[title]'), Grid view (source: '[table_name]' table, columns: [col1, col2, col3]). Verify: page exists in app.",
        "Add page '[page_name]' to app '[app_name]' with blocks: Hero (title: '[title]'), Form (source: '[table_name]' table, fields: [f1, f2, f3]). Verify: page exists with form block.",
    ],
    examples=[
        {
            "request": "Add a dashboard page to the CRM app",
            "plan_steps": [
                "Add page 'Dashboard' to app 'CRM' with blocks: Hero (title: 'Dashboard'), Stats (total clients, total orders, revenue), Grid view (source: 'orders' table, columns: order_number, amount, status, client). Verify: page exists with 3 blocks.",
            ],
        },
    ],
    common_mistakes=[
        "Not specifying the parent app",
        "Missing source table for data blocks",
        "Not listing blocks in order",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


VIEW_DESIGN_PATTERN = PlanningPattern(
    id="plan:view_design",
    name="View Design",
    description="Planning patterns for creating data views (grids, forms, calendars, kanbans). "
    "Views are different ways to visualize and interact with table data.",
    triggers=[
        "create view",
        "grid view",
        "kanban view",
        "calendar view",
        "form view",
        "filtered view",
        "show only",
    ],
    capability_ids=["agent:view_builder"],
    strategy="""
1. Identify view type and purpose
2. Identify source table (check workspace_context)
3. List columns/fields to display
4. Specify filters or grouping if needed

VIEW TYPES:
- Grid: Spreadsheet display, multiple records — specify columns
- Detail: Single record, all fields — specify which fields
- Form: Data entry, create/edit — specify editable fields
- Calendar: Date-based display — requires a date field
- Kanban: Card-based, grouped by status — requires single-select field

REQUIRED FOR EACH TYPE:
- Grid: source table, columns, optional filter
- Kanban: source table, grouping field (single-select), card fields
- Calendar: source table, date field, display fields
- Form: source table, editable fields
""",
    tool_sequence=["view_builder"],
    step_templates=[
        "Create grid view '[name]' on table '[table]' with columns: [col1, col2, col3]. Filter: [field]='[value]'. Verify: view exists with correct columns and filter.",
        "Create kanban view '[name]' on table '[table]', grouped by field '[status_field]' (columns: [Option1, Option2, Option3]). Show fields: [f1, f2, f3]. Verify: view exists with correct grouping.",
        "Create calendar view '[name]' on table '[table]', date field: '[date_field]'. Show fields: [f1, f2]. Verify: view exists.",
    ],
    examples=[
        {
            "request": "Create a view for active customers only",
            "plan_steps": [
                "Create grid view 'Active Customers' on table 'customers' with columns: full_name, email, phone, company. Filter: status='Active'. Verify: view exists with filter applied.",
            ],
        },
        {
            "request": "Make a kanban board for tasks",
            "plan_steps": [
                "Create kanban view 'Task Board' on table 'tasks', grouped by field 'status' (columns: To Do, In Progress, Done). Show fields: title, assignee, due_date. Verify: view exists with correct grouping.",
            ],
        },
    ],
    common_mistakes=[
        "Not specifying the source table",
        "Missing columns for grid views",
        "Not specifying the grouping field for kanban",
        "Not specifying the date field for calendar",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


# Export all app-related patterns
APP_PATTERNS = [
    APP_DESIGN_PATTERN,
    PAGE_DESIGN_PATTERN,
    VIEW_DESIGN_PATTERN,
]
