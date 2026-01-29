"""
Planning guidance for page_builder capability.

This replaces prompts/capabilities/page_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Page Builder (agent:page_builder)

**Choose when**: User needs to add or modify pages within an existing app.
**Examples**: "add a dashboard page", "create a contact form page"

### What page_builder Creates

- Pages with Puck visual blocks
- Layouts and responsive designs
- Data-bound components

### Before Creating a Page

Ensure you have:
- Page name and purpose
- Parent app (if adding to existing app)
- Block structure (what components needed)
- Data sources (which tables/views)

### Step Format Examples

- "Create page 'Dashboard' with Hero block, Stats grid, and Table view of 'orders'"
- "Add page 'Contact Form' to 'Customer Portal' app with Form block for 'inquiries' table"
- "Update 'Home' page to add navigation menu and footer blocks"

### Key Block Types

- **Hero**: Header sections with title/subtitle
- **Stats**: Numeric displays
- **Table**: Data grids
- **Form**: Input forms
- **Cards**: Content cards
- **Navigation**: Menus and links
"""
