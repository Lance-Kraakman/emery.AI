"""
Planning guidance for page_builder capability.

This replaces prompts/capabilities/page_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Page Builder (agent:page_builder)

**Choose when**: User needs to add or modify pages within an existing app.
**Examples**: "add a dashboard page", "create a contact form page"

### Tools Used by This Capability
The executor uses: **page_crud**.
- page_crud: Create/list/get/update/delete pages within an app
Set tool_call="page_crud".

### Key Block Types (Puck Blocks)

- **Hero**: Header sections with title/subtitle
- **Stats**: Numeric displays (counters, metrics)
- **Table/Grid**: Data grids bound to a table — needs source table and columns
- **Form**: Input forms bound to a table — needs source table and fields
- **Cards**: Content cards for displaying summary data
- **Detail**: Single record display — needs source table
- **Navigation**: Menus and links

### Common Page Layouts
- **Data table page**: Hero heading → Grid view block (source: table, columns: [...])
- **Dashboard page**: Hero heading → Stats row (3-4 metric blocks) → Grid view block
- **Detail page**: Hero heading → Detail view block (source: table, record: from URL param)
- **Form page**: Hero heading → Form view block (source: table, fields: [...])

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every page_builder step description:
1. **PAGE NAME**: Exact name in quotes
2. **PARENT APP**: Exact app name in quotes (or app ID if known)
3. **BLOCKS**: Ordered list of Puck blocks with their configuration
   - For data blocks (Table, Form, Detail): include source table name and fields/columns
   - For Hero blocks: include title and subtitle text
4. **OUTCOME**: What the executor should verify

**Step description templates:**

Create data page:
"Add page '[page_name]' to app '[app_name]' with blocks: Hero (title: '[title]'), Grid view (source: '[table_name]' table, columns: [col1, col2, col3]). Verify: page exists in app with grid view."

Create form page:
"Add page '[page_name]' to app '[app_name]' with blocks: Hero (title: '[title]'), Form (source: '[table_name]' table, fields: [f1, f2, f3]). Verify: page exists with form block."

BAD: "Add a dashboard page to the app"
GOOD: "Add page 'Dashboard' to app 'CRM' with blocks: Hero (title: 'Dashboard'), Stats (total clients, total orders, revenue), Grid view (source: 'orders' table, columns: order_number, amount, status, client). Verify: page exists with 3 blocks."
"""
