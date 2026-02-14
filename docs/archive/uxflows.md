# Emery.AI UX Flows & Feature Documentation

**Version**: 1.0
**Last Updated**: 2025-11-04
**Purpose**: Comprehensive documentation of all user-facing features, behaviors, and workflows

---

## Table of Contents

1. [Navigation & Layout](#navigation--layout)
2. [Agents](#agents)
3. [Teams](#teams)
4. [Organization](#organization)
5. [Data Management](#data-management)
6. [Users & Permissions](#users--permissions)
7. [Connections](#oauth-connections)
8. [Chat & AI Assistant](#chat--ai-assistant)
9. [Tasks & Execution](#tasks--execution)
10. [Authentication & Onboarding](#authentication--onboarding)

---

## Navigation & Layout

### Sidebar Navigation

**Component**: `EmerySidebar`
**Location**: Left side of all authenticated pages
**State**: Collapsible (w-64 expanded, w-16 collapsed)

**Structure**:
```
┌─ User Profile (top)
├─ Organization Switcher
├─ Main Navigation
│  ├─ Mission Control (dashboard)
│  ├─ Orchestration
│  │  ├─ Organization Chart
│  │  ├─ Teams
│  │  └─ Agents
│  ├─ Data (hierarchical)
│  │  └─ Databases → Tables
│  └─ Settings
│     ├─ Connections
│     ├─ Users & Permissions
│     └─ System Settings
└─ Sign Out (bottom)
```

**Behaviors**:
- Sidebar persists across all authenticated pages
- Collapsible via hamburger icon
- Organization switcher at top allows switching between orgs
- Data section dynamically shows databases and tables from current organization
- Active route highlighted in navigation
- Mobile: Sidebar converts to overlay menu

**Routes**:
- `/mission-control` - Dashboard
- `/organization` - Organization Chart
- `/teams` - Teams Management
- `/agents` - Agents Management
- `/data` - Data Browser
- `/connections` - Connections
- `/organization/settings/permissions` - Users & Permissions
- `/settings/system` - System Settings

### Canvas Layout

**Architecture**: All main pages use expandable/collapsible canvas

**Components**:
- Main content area (left/center)
- Chat panel (right side, collapsible)
- Canvas controls for expand/collapse

**Pages Using Canvas**:
- Mission Control
- Agents
- Teams
- Organization Chart
- Data Browser

**Behaviors**:
- Chat panel can be collapsed to maximize main content area
- Canvas state persists in global store
- Responsive to screen size

---

## Agents

### Overview
Agents are intelligent automation entities that can execute multi-step workflows, use tools, and be scheduled to run automatically.

### Agent Dashboard

**Route**: `/agents`
**Layout**: Split-pane (agent list left, details right)

**Features**:
- **Agent List**: Scrollable list of all agents in organization
- **Search**: Filter agents by name in real-time
- **Agent Cards**: Show agent name, role, status badge
- **Create Button**: Opens agent creation form
- **Empty State**: Shown when no agents exist

**Agent Card Components**:
```
[Agent Icon] Agent Name
            Role: {role}
            Status: [Active | Inactive | Archived]
```

### Agent Creation

**Component**: `AgentCreateView`
**Trigger**: Click "Create Agent" button

**Form Fields**:
1. **Name** (required) - Text input
2. **Role** (required) - Text input (e.g., "Data Analyst", "Customer Support")
3. **Description** (optional) - Textarea
4. **Persona** (optional) - Textarea for agent personality/behavior
5. **Status** (default: active) - Select dropdown
   - Options: active, inactive, archived

**Validation**:
- Name must not be empty
- Role must not be empty
- Validates on submit

**Flow**:
```
Click "Create Agent"
→ Form Opens
→ Fill Fields
→ Submit
→ Validation
→ Server Action
→ DB Insert
→ List Updates
→ View New Agent
```

**File**: `components/emery/agents/AgentCreateView.tsx`

### Agent Details

**Component**: `AgentDetailsView`
**Display**: Read-only view of agent information

**Sections**:
1. **Basic Info**
   - Name
   - Role
   - Status badge
   - Description

2. **Capabilities** (multi-step workflows)
   - List of configured capabilities
   - Each capability shows:
     - Name
     - Description
     - Steps count
     - Tools used

3. **Schedule** (if configured)
   - RRule-based schedule display
   - Calendar visualization
   - Next run time

4. **Actions**
   - Edit Agent
   - Execute Task
   - View Tasks
   - Delete Agent

### Capability Management

**Component**: `CapabilityManager`
**Purpose**: CRUD manager for agent capabilities

**Capability Structure**:
```typescript
{
  name: string;              // e.g., "Analyze Sales Data"
  description: string;       // What the capability does
  steps: StepConfig[];       // Ordered list of steps
}
```

**Step Structure**:
```typescript
{
  name: string;              // Step name
  tool: ToolConfig;          // Tool to use
  config: Record<string, any>; // Tool-specific configuration
}
```

**Features**:
- Add new capability
- Edit existing capability
- Delete capability
- Reorder steps within capability
- Configure tools for each step

**Flow**:
```
Open Capability Manager
→ Add Capability
→ Configure Steps
→ Select Tools per Step
→ Save
→ Capability Available for Execution
```

### Schedule Management

**Component**: `ScheduleManager`
**Purpose**: Calendar-based scheduling using RRule

**Features**:
- Visual calendar interface
- RRule string generation
- Repeat patterns:
  - Daily
  - Weekly (with day selection)
  - Monthly
  - Custom (RRule string)
- Time selection
- Timezone handling

**Display**:
- Calendar view showing scheduled runs
- Next run time preview
- RRule string display

**Flow**:
```
Open Schedule Manager
→ Select Repeat Pattern
→ Configure Days/Times
→ Preview Next Run
→ Save
→ Agent Runs Automatically per Schedule
```

### Task Execution from Agent

**Component**: `TaskFormDialog`
**Trigger**: Click "Execute" button on agent

**Form Fields**:
1. **Instructions** (required) - Textarea
   - Natural language instructions for the agent
   - Can reference data tables, files, etc.
2. **Capability** (optional) - Select dropdown
   - Choose from agent's configured capabilities
   - If not selected, agent uses default behavior

**Flow**:
```
Click "Execute"
→ Task Form Opens
→ Enter Instructions
→ Select Capability (optional)
→ Submit
→ Task Created
→ gRPC Worker Executes
→ Progress Streams to UI
→ View Results
```

**Execution Path**:
1. User submits task form
2. Server action creates Task entity in database
3. Task dispatched to Python gRPC worker
4. Worker streams progress updates via gRPC
5. NextJS streams to client via Server-Sent Events (SSE)
6. UI updates in real-time with progress
7. Results displayed when complete

**Files**:
- `components/emery/tasks/TaskFormDialog.tsx`
- `app/api/agents/[id]/execute/route.ts`
- `app/api/tasks/[id]/stream/route.ts`

### Agent Status Management

**Statuses**:
- **Active**: Agent can be executed and scheduled
- **Inactive**: Agent visible but cannot execute
- **Archived**: Agent hidden from main list

**Status Change Flow**:
```
Select Agent
→ Click Status Dropdown
→ Select New Status
→ Server Action Updates DB
→ UI Updates
```

### Team Assignment

**Feature**: Assign agents to teams for organizational structure

**Flow**:
```
View Agent Details
→ Click "Assign to Team"
→ Select Team from Dropdown
→ Save
→ Agent Shows in Organization Chart under Team
```

---

## Teams

### Overview
Teams are organizational units that contain members (users) and agents. They enable structured collaboration and role-based workflows.

### Teams Dashboard

**Route**: `/teams`
**Layout**: Split-pane (team list left, details right)

**Features**:
- **Team List**: All teams in organization
- **Search**: Filter teams by name
- **Team Cards**: Show team name, member count, agent count
- **Create Button**: Opens team creation form
- **Empty State**: Shown when no teams exist

### Team Creation

**Component**: `TeamFormDialog`
**Trigger**: Click "Create Team" button

**Form Fields**:
1. **Name** (required) - Text input
2. **Purpose** (optional) - Textarea
3. **Description** (optional) - Textarea
4. **Responsibilities** (optional) - Array of text inputs
5. **Goals** (optional) - Array of text inputs

**Array Fields**:
- Click "Add" to add new item
- Click "Remove" to delete item
- Reorderable via drag-drop

**Flow**:
```
Click "Create Team"
→ Form Opens
→ Fill Fields
→ Add Responsibilities/Goals
→ Submit
→ Team Created
→ List Updates
→ View New Team
```

**File**: `components/emery/teams/TeamFormDialog.tsx`

### Team Details

**Component**: `TeamDetailsView`

**Sections**:
1. **Basic Info**
   - Name
   - Purpose
   - Description

2. **Responsibilities**
   - Bulleted list of team responsibilities
   - Empty state if none configured

3. **Goals**
   - Bulleted list of team goals
   - Empty state if none configured

4. **Members** (via `TeamMembersPanel`)
   - List of team members (users)
   - User avatar, name, email
   - Role in team
   - Add/remove member actions

5. **Assigned Agents**
   - List of agents assigned to this team
   - Agent name, role, status
   - Link to agent details

6. **Activity** (via `TeamActivityPanel`)
   - Recent tasks executed by team agents
   - Team events and changes
   - Timeline view

**Actions**:
- Edit Team
- Add Members
- Assign Agents
- Delete Team

### Team Membership

**Component**: `TeamMembersPanel`

**Features**:
- **Add Member**: Select user from organization, assign role
- **Remove Member**: Click remove icon
- **Change Role**: Dropdown to change member's team role

**Member Display**:
```
[Avatar] Name
         Email
         Role: [Dropdown]
         [Remove Icon]
```

**Flow**:
```
View Team Details
→ Click "Add Member"
→ Select User
→ Assign Role
→ Save
→ Member Added to Team
```

### Agent Assignment to Team

**Flow**:
```
View Team Details
→ Click "Assign Agent"
→ Select Agent from Dropdown
→ Save
→ Agent Now Part of Team
→ Shows in Organization Chart
```

**Reverse Flow** (from Agent):
```
View Agent Details
→ Click "Assign to Team"
→ Select Team
→ Save
→ Agent Added to Team
```

---

## Organization

### Overview
Multi-tenant organization management with visual hierarchy display and switching capabilities.

### Organization Switcher

**Component**: `EmeryOrganizationModal`
**Location**: Top of sidebar
**Display**: Current organization name with dropdown icon

**Features**:
- **Current Org Display**: Shows active organization
- **Org List**: Dropdown showing all accessible organizations
- **Switch Org**: Click org name to switch (page reloads)
- **Create Org**: Button at bottom of dropdown

**Flow**:
```
Click Current Org Name
→ Dropdown Opens
→ Select Different Org
→ Server Action Updates Session
→ Page Reloads with New Org Context
```

**Create Organization Flow**:
```
Open Org Switcher
→ Click "Create Organization"
→ Form Opens (name, mission)
→ Submit
→ Org Created
→ User Added as Admin
→ Switch to New Org
```

### Organization Chart

**Route**: `/organization`
**Component**: `OrganizationChartClient`
**Library**: ReactFlow

**Visual Layout**:
```
[Team Node] ──┬── [Agent Node]
              ├── [Agent Node]
              └── [Agent Node]

[Team Node] ──┬── [Agent Node]
              └── [Agent Node]
```

**Features**:
1. **Interactive Graph**
   - Drag nodes to reposition
   - Pan canvas
   - Zoom in/out
   - Fit view button

2. **Node Types**
   - **Team Nodes**: Rectangular, blue
     - Shows team name
     - Member count badge
     - Click to view details
   - **Agent Nodes**: Rounded, green
     - Shows agent name, role
     - Status indicator
     - Click to view details

3. **Connections**
   - Edges from teams to agents show assignment
   - Visual hierarchy of organization

4. **Controls**
   - Search bar to filter nodes
   - View/Edit/Activity mode toggle
   - Fit view button
   - Zoom controls

5. **Activity Panel** (right side)
   - Shows tasks for selected node
   - Recent activity
   - Quick actions

**Modes**:
- **View Mode**: Read-only visualization
- **Edit Mode**: Drag to reorganize, edit assignments
- **Activity Mode**: Focus on task activity for selected entity

**Flow**:
```
Navigate to Organization Chart
→ View Teams and Agents as Graph
→ Click Node to Select
→ View Details/Activity in Panel
→ Edit Connections in Edit Mode
```

**Files**:
- `app/(authenticated)/organization/page.tsx`
- `components/emery/organization-chart/OrganizationChartClient.tsx`
- `components/emery/organization-chart/nodes/TeamNode.tsx`
- `components/emery/organization-chart/nodes/AgentNode.tsx`

---

## Data Management

### Overview
Dynamic database and table system with Baserow-compatible field naming and full CRUD operations.

### Data Browser

**Route**: `/data`
**Layout**: Sidebar shows databases → tables hierarchy, main area shows table content

**Sidebar Structure**:
```
Data
└─ Database 1
   ├─ Table A
   ├─ Table B
   └─ Table C
└─ Database 2
   ├─ Table X
   └─ Table Y
```

**Features**:
- Hierarchical database/table browser
- Create database button
- Create table button (within database)
- Click table to view in main area
- Empty state when no databases exist

### Database Management

**Create Database**:
```
Component: CreateDatabaseDialog
Trigger: Click "Create Database" in sidebar

Form:
- Name (required)
- Description (optional)

Flow:
Click "Create Database"
→ Form Opens
→ Enter Name
→ Submit
→ DB Created in PostgreSQL
→ Sidebar Updates
→ Can Create Tables
```

**Database Actions**:
- Rename database
- Delete database (with confirmation)
- View database info

### Table Management

**Create Table**:
```
Component: CreateTableDialog
Trigger: Click "Create Table" within database

Form:
- Name (required)
- Database (pre-selected from context)

Flow:
Click "Create Table"
→ Form Opens
→ Enter Name
→ Submit
→ Table Created
→ Sidebar Updates
→ Table Opens for Field Creation
```

**Table Actions**:
- Rename table
- Manage fields
- Delete table (with confirmation)
- Export data (future)

### Field Management

**Component**: `FieldManagerDialog`
**Trigger**: Click "Manage Fields" button in table view

**Supported Field Types**:
1. **text** - Single-line text
2. **number** - Numeric values
3. **boolean** - True/false checkbox
4. **date** - Date picker
5. **email** - Email with validation
6. **url** - URL with validation
7. **jsonb** - JSON object storage
8. **file** - File attachment
9. **document** - Rich text editor
10. **relation** - Foreign key to another table

**Field Properties**:
- Name (required)
- Type (required)
- Required flag (optional)
- Default value (optional)
- Order index (optional)
- Relation config (for relation type):
  - Target table
  - Display field

**Create Field Flow**:
```
Open Field Manager
→ Click "Add Field"
→ Enter Field Name
→ Select Field Type
→ Configure Type-Specific Options
→ Set Required Flag
→ Save
→ Field Added to Table
→ Column Appears in Table View
```

**Field Naming Convention**:
- Internal: `field_{id}` (Baserow-compatible)
- Display: User-provided name
- Example: `field_42` stored as "Customer Name" for display

**Delete Field Flow**:
```
Open Field Manager
→ Find Field
→ Click Delete Icon
→ Confirmation Dialog
→ Confirm
→ Field Removed from Schema
→ Column Data Deleted
```

### Row Management

**Table View Component**: `DynamicDataTable`

**Features**:
1. **Column Headers**
   - Sortable (click header to sort)
   - Filterable (future)
   - Resizable columns

2. **Inline Cell Editing**
   - Click cell to edit
   - Type-specific editors:
     - Text: Input field
     - Number: Number input
     - Boolean: Checkbox
     - Date: Date picker
     - Email: Email input with validation
     - URL: URL input with validation
     - File: Upload dialog
     - Document: Rich text editor
     - Relation: Dropdown of related records
   - Auto-save on blur or Enter
   - Cancel on Escape

3. **Row Actions**
   - View full row (modal)
   - Edit full row (modal)
   - Delete row (confirmation)
   - Duplicate row (future)

4. **Toolbar**
   - Add row button
   - Delete selected rows
   - Search/filter
   - Export (future)

**Create Row Flow**:
```
Click "Add Row" Button
→ Row Editor Modal Opens
→ Form with All Fields
→ Type-Specific Inputs
→ Fill Fields
→ Submit
→ Row Created in DB
→ Table Refreshes
→ New Row Appears
```

**Edit Row Flow (Inline)**:
```
Click Cell
→ Editor Appears
→ Modify Value
→ Press Enter or Blur
→ Auto-saves to DB
→ Cell Updates
```

**Edit Row Flow (Modal)**:
```
Click "Edit" Icon on Row
→ Row Editor Modal Opens
→ All Fields Displayed
→ Modify Fields
→ Submit
→ Row Updated in DB
→ Table Refreshes
→ Changes Appear
```

**Delete Row Flow**:
```
Select Row(s)
→ Click Delete Button
→ Confirmation Dialog
→ Confirm
→ Row(s) Deleted from DB
→ Table Refreshes
```

**View Row Flow**:
```
Click "View" Icon on Row
→ Row Viewer Modal Opens
→ All Fields Displayed (Read-Only)
→ Related Records Expanded
→ File/Document Preview
→ Close to Return
```

**Files**:
- `components/emery/tables/DynamicDataTable.tsx`
- `components/emery/tables/EditableCell.tsx`
- `components/emery/tables/RowEditorModal.tsx`
- `components/emery/tables/RowViewerModal.tsx`

### Field Type Components

**Text Field**:
- Component: `<Input type="text" />`
- Validation: Max length (configurable)

**Number Field**:
- Component: `<Input type="number" />`
- Validation: Min/max (configurable)

**Boolean Field**:
- Component: `<Checkbox />`
- Display: Checkmark or empty

**Date Field**:
- Component: `<DatePicker />`
- Format: ISO 8601
- Display: Localized date string

**Email Field**:
- Component: `<Input type="email" />`
- Validation: Email format
- Display: Clickable mailto link

**URL Field**:
- Component: `<Input type="url" />`
- Validation: URL format
- Display: Clickable external link

**JSONB Field**:
- Component: JSON editor (Monaco/CodeMirror)
- Validation: Valid JSON
- Display: Formatted JSON preview

**File Field**:
- Component: `FileField`
- Features:
  - Upload via drag-drop or file picker
  - Multiple file support
  - File preview (images)
  - Download link
  - Delete file
- Storage: S3 or local filesystem

**Document Field**:
- Component: `DocumentField`
- Editor: Rich text editor (Tiptap/Lexical)
- Features:
  - Bold, italic, underline
  - Lists (ordered/unordered)
  - Links
  - Headings
  - Code blocks
- Storage: HTML or Markdown in database

**Relation Field**:
- Component: `RelationField`
- Display: Dropdown or autocomplete
- Features:
  - Search related records
  - Display field from related table
  - Create new related record (future)
  - Multiple relations (future)

### Mission Control Table View

**Route**: `/mission-control?tableId={id}`
**Purpose**: View and edit tables directly from dashboard

**Features**:
- Same `DynamicDataTable` component
- Full CRUD operations
- Embedded in Mission Control page
- Quick access to frequently used tables

**Flow**:
```
Mission Control Dashboard
→ Click Table Card or Link
→ URL Updates with tableId Query Param
→ Table Loads in Main Area
→ Edit Inline or via Modals
```

---

## Users & Permissions

### Overview
Role-based access control (RBAC) system with fine-grained permissions and resource scoping.

### Permissions Management Page

**Route**: `/organization/settings/permissions`
**Layout**: Tabbed interface

**Tabs**:
1. **Roles** - Manage custom roles and permissions
2. **Users** - Manage user assignments and access

### Roles Tab

**Component**: `RolesTab`

**Features**:
1. **Role List**
   - All custom roles in organization
   - Built-in roles (Admin, Member, Guest) shown separately
   - Role name, permission count, user count

2. **Create Role**
   - Opens `RoleWizard` component
   - Step-by-step role creation

3. **Edit Role**
   - Modify permissions
   - Rename role
   - Add/remove permissions

4. **Delete Role**
   - Confirmation required
   - Cannot delete if users assigned

**Role Wizard Flow**:
```
Click "Create Role"
→ Step 1: Enter Role Name
→ Step 2: Select Permissions
→ Step 3: Scope to Resources (optional)
→ Step 4: Review & Create
→ Role Created
→ Available for User Assignment
```

**Permission Categories**:
- **Agents**: `agents:manage`, `agents:execute`, `agents:view`
- **Data**: `data:create`, `data:read`, `data:write`, `data:delete`
- **Teams**: `teams:manage`, `teams:view`
- **Roles**: `roles:manage`
- **Organization**: `organization:admin`, `organization:settings`
- **Tasks**: `tasks:create`, `tasks:view`, `tasks:cancel`
- **Connections**: `connections:manage`

**Permission Scoping**:
- **Global**: Applies to all resources
- **Scoped**: Applies to specific agents, teams, or tables
- **Resource Selector**: Choose specific resources for permission

**Example Scoped Permission**:
```
Role: "Sales Agent Manager"
Permission: agents:manage
Scope: Only "Sales Outreach Agent" and "Lead Qualification Agent"
Result: User can manage only these two agents
```

### Users Tab

**Component**: `UsersTab`

**Features**:
1. **User List**
   - All users in organization
   - User avatar, name, email
   - Assigned roles
   - Last active timestamp

2. **Invite User**
   - Opens invitation form
   - Sends email with token link

3. **Edit User Roles**
   - Multi-select dropdown
   - Assign/remove roles
   - Changes apply immediately

4. **Remove User**
   - Removes from organization
   - Confirmation required
   - User loses access

**Invite User Flow**:
```
Click "Invite User"
→ Form Opens
→ Enter Email
→ Select Initial Roles
→ Send Invitation
→ Email Sent with Token Link
→ User Receives Email
→ User Clicks Link
→ Invitation Accepted
→ User Added to Organization
→ User Gains Role Permissions
```

**Edit User Roles Flow**:
```
Find User in List
→ Click "Edit Roles"
→ Multi-Select Opens
→ Select/Deselect Roles
→ Save
→ User Permissions Updated
→ Takes Effect Immediately
```

**Built-in Roles**:
- **Admin**: Full organization access
- **Member**: Standard user access
- **Guest**: Read-only access

---

## Connections

### Overview
Manage external service integrations via OAuth 2.0 for use in agents and workflows.

### Connections Page

**Route**: `/connections`
**Component**: `ConnectionsManager`

**Layout**: Grid of connection cards

**Supported Services** (configurable):
- Pipedream
- GitHub
- Google
- Slack
- Linear
- Notion
- Airtable
- And more via configuration

### Connection Card

**Component**: `AppConnectionCard`

**Display**:
```
[App Icon] App Name
           Status: [Connected | Not Connected]
           [Connect Button | Disconnect Button]
           Health: [✓ | ✗]
```

**Card States**:
1. **Not Connected**
   - Shows "Connect" button
   - Icon grayed out
   - No health indicator

2. **Connected**
   - Shows "Disconnect" button
   - Icon in full color
   - Health indicator (✓ = healthy, ✗ = error)
   - Connection info (email, account name)

3. **Error**
   - Shows "Reconnect" button
   - Warning icon
   - Error message

### Connect Service Flow

```
Navigate to Connections
→ Find Service Card
→ Click "Connect" Button
→ Redirects to OAuth Provider
→ User Authorizes App
→ Redirects Back with Code
→ Server Exchanges Code for Token
→ Token Stored in Database
→ Connection Status Updates to "Connected"
→ Service Available in Agents
```

**OAuth Flow Details**:
1. Client initiates: `/api/connections/oauth/[provider]/authorize`
2. Redirects to provider authorization URL
3. User grants permission
4. Provider redirects to: `/api/connections/oauth/[provider]/callback?code={code}`
5. Server exchanges code for access token
6. Token stored encrypted in database
7. Connection entity created with status "active"

### Disconnect Service Flow

```
Find Connected Service
→ Click "Disconnect" Button
→ Confirmation Dialog
→ Confirm
→ Token Revoked (if supported)
→ Token Deleted from DB
→ Connection Status Updates
→ Service No Longer Available
```

### Using Connections in Agents

**Agent Configuration**:
```
Create/Edit Agent
→ Configure Capability
→ Add Step
→ Select Tool Requiring OAuth
→ Tool Automatically Uses Connection Token
→ Agent Executes with Authorized Access
```

**Example**: Agent using Google Sheets connection
```
Agent: "Sales Report Generator"
Capability: "Generate Weekly Report"
Step 1: Fetch data from database (no auth)
Step 2: Write to Google Sheets (uses Google OAuth token)
Step 3: Send notification to Slack (uses Slack OAuth token)
```

### Health Check

**Feature**: Automatic health monitoring of connections

**Behavior**:
- Every 30 seconds, connection health checked
- If token expired, status updates to "error"
- User sees error indicator on connection card
- User can reconnect to refresh token

**Implementation**: Worker service pings OAuth endpoints with token

---

## Chat & AI Assistant

### Overview
Context-aware AI chat assistant integrated throughout the application using LlamaIndex.

### Chat Panel

**Location**: Right side of all canvas pages (Mission Control, Agents, Teams, etc.)
**Component**: `EmeryChat`
**State**: Collapsible

**Layout**:
```
┌─ Chat History Dropdown
├─ Tool Selection Panel
├─ Messages Area (scrollable)
│  ├─ User Message
│  ├─ Assistant Message
│  ├─ Tool Usage Display
│  └─ References
├─ References Panel (collapsible)
└─ Input Area
   ├─ Tool Dropdown
   └─ Text Input + Send Button
```

**Features**:
1. **Context Awareness**
   - Chat knows current page context
   - Automatically includes relevant data (current agent, team, table)
   - Can reference entities in current view

2. **Tool Selection**
   - Dropdown showing available tools for current domain
   - Tools filtered by page context
   - User can manually select tools

3. **Real-Time Streaming**
   - LlamaIndex streams responses token-by-token
   - Progress indicators for long operations
   - Cancel button for in-progress responses

4. **References**
   - Documents and files referenced in conversation
   - Click to view full document
   - File previews (images, PDFs)

5. **Chat History**
   - Dropdown to load previous conversations
   - Auto-saves on every message
   - Search through history

### Chat Input

**Component**: `CustomChatInput`

**Features**:
- Multi-line text input (expands as user types)
- Tool autocomplete via dropdown
- @ mentions for entities (agents, teams, tables)
- File attachment (drag-drop or click)
- Send button or Enter to submit
- Shift+Enter for new line

**Input Syntax**:
```
@agent-name analyze this data in @table-name

Attach: [file-upload]
Tools: [selected-tools]
```

### Tool Panel

**Component**: `ToolPanel`

**Display**:
- List of tools available in current context
- Tool name, description, parameters
- Visual indicator when tool is in use

**Tool Types**:
- Database query tools
- Agent execution tools
- File manipulation tools
- External API tools (via connections)

**Tool Selection Flow**:
```
Click Tool Dropdown
→ Type to Search
→ Select Tool
→ Tool Added to Context
→ Chat Can Use Tool
```

### References Panel

**Component**: `ReferencesPanel`

**Display**:
- Documents referenced in conversation
- Files uploaded or generated
- Tables queried
- Agents mentioned

**Reference Card**:
```
[Icon] Document Name
       Type: Document/File/Table
       Last Updated: timestamp
       [View Button]
```

**Click Reference**:
```
Click Reference Card
→ Modal Opens
→ Full Content Displayed
→ Can Edit (if editable)
→ Close to Return
```

### Chat History

**Component**: `ChatHistoryDropdown`

**Features**:
- List of recent conversations
- Search by content or timestamp
- Load previous conversation
- Delete conversation
- Export conversation (future)

**History Card**:
```
[Icon] First User Message (truncated)
       Timestamp
       Message Count
```

**Load History Flow**:
```
Click Chat History Dropdown
→ Select Conversation
→ Chat Clears
→ Previous Messages Load
→ Can Continue Conversation
```

### Canvas Integration

**Feature**: Chat panel can collapse to maximize main content

**Behaviors**:
- Click collapse icon to hide chat
- Main content area expands
- Chat icon remains visible to reopen
- Canvas state persists across navigation

**Flow**:
```
Chat Open (Default)
→ Click Collapse Icon
→ Chat Slides Out
→ Main Content Expands
→ Click Chat Icon
→ Chat Slides In
```

---

## Tasks & Execution

### Overview
Task system for executing agent workflows with real-time progress monitoring.

### Task Creation

**Triggers**:
1. Manual execution from agent page
2. Scheduled execution via agent schedule
3. Triggered by external event (webhook, connection)
4. Created via API

**Task Properties**:
- **Agent**: Agent executing the task
- **Instructions**: Natural language description of what to do
- **Capability**: Optional specific capability to use
- **Status**: queued → running → completed | failed | cancelled
- **Priority**: high | medium | low
- **Created By**: User who created task
- **Organization**: Owner organization

### Task Execution Flow

**End-to-End Process**:
```
1. User/System Creates Task
   ↓
2. Task Saved to PostgreSQL (status: queued)
   ↓
3. WorkerRegistry Discovers Python gRPC Worker
   ↓
4. Task Dispatched to Worker via gRPC
   ↓
5. Worker Executes (status: running)
   ↓
6. Worker Streams Progress via gRPC
   ↓
7. NextJS Receives gRPC Stream
   ↓
8. NextJS Re-streams to Client via SSE
   ↓
9. UI Updates in Real-Time
   ↓
10. Task Completes (status: completed/failed)
    ↓
11. Results Saved to Database
    ↓
12. UI Shows Final Results
```

**Technical Stack**:
- **PostgreSQL**: Task entity storage
- **gRPC**: NextJS ↔ Python communication
- **SSE (Server-Sent Events)**: NextJS ↔ Browser streaming
- **Protocol Buffers**: Type-safe message format

### Task Progress Streaming

**Component**: Task detail view or dashboard

**Progress Display**:
```
Task: "Analyze Sales Data"
Status: Running
Progress: 45%

Steps:
[✓] Fetch data from database
[→] Analyze trends (in progress)
[ ] Generate report
[ ] Send to Slack

Logs:
14:23:10 - Started task execution
14:23:12 - Fetched 1,245 rows
14:23:15 - Running analysis...
```

**Stream Format**:
- Step updates (step started, step completed)
- Progress percentage
- Log messages
- Intermediate results
- Error messages

**SSE Event Types**:
```typescript
{
  type: 'progress',
  data: { percent: 45 }
}

{
  type: 'step',
  data: { name: 'Analyze trends', status: 'running' }
}

{
  type: 'log',
  data: { message: 'Processing...', timestamp: '...' }
}

{
  type: 'result',
  data: { output: {...} }
}

{
  type: 'error',
  data: { message: 'Error details' }
}

{
  type: 'complete',
  data: { status: 'completed', result: {...} }
}
```

### Task Monitoring

**Component**: Task list or dashboard

**Task Card Display**:
```
[Agent Icon] Agent Name
             Task: "Instructions preview..."
             Status: [Running | Completed | Failed]
             Created: timestamp
             Duration: X min
             [View Details] [Cancel (if running)]
```

**Task List Features**:
- Filter by status
- Filter by agent
- Sort by created date, status, duration
- Pagination
- Real-time status updates

**View Task Details**:
```
Click Task Card
→ Details Modal Opens
→ Shows Full Instructions
→ Shows Progress (if running)
→ Shows Logs
→ Shows Results (if complete)
→ Shows Error (if failed)
→ Actions: Re-run, Cancel, Delete
```

### Task Results

**Component**: `TaskResultDisplay`

**Display Types**:
1. **Text Result**: Simple text output
2. **Structured Data**: JSON formatted display
3. **File/Document**: Download link or preview
4. **Table Data**: Rows returned from query
5. **Chart/Graph**: Visualization (future)

**Result Actions**:
- Download result
- Copy to clipboard
- Share result (future)
- Use in next task (future)

### Task Cancellation

**Flow**:
```
Task Running
→ Click "Cancel" Button
→ Confirmation Dialog
→ Confirm
→ Cancellation Signal Sent to Worker
→ Worker Stops Execution
→ Status Updates to "cancelled"
→ Partial Results Saved
```

### Task Logs

**Component**: `TaskLogsPanel`

**Features**:
- Real-time log streaming
- Auto-scroll to latest
- Filter by log level (info, warning, error)
- Search logs
- Export logs

**Log Format**:
```
[14:23:10] [INFO] Started task execution
[14:23:12] [INFO] Fetched 1,245 rows from database
[14:23:15] [INFO] Running analysis...
[14:24:30] [WARNING] Missing data for 12 records
[14:25:00] [INFO] Analysis complete
[14:25:02] [ERROR] Failed to send Slack notification
```

### Scheduled Tasks

**Feature**: Tasks created automatically per agent schedule

**Behavior**:
- Scheduler runs every minute
- Checks for agents with active schedules
- Creates task if schedule matches current time
- Task executes as if manually triggered

**Scheduler Components**:
- `TaskSchedulingApplicationService`
- RRule-based scheduling
- Timezone support
- Skip if previous task still running (configurable)

---

## Authentication & Onboarding

### Overview
Multi-provider authentication with automatic organization setup for first-time users.

### Sign In Page

**Route**: `/auth/signin`
**Component**: NextAuth sign-in page

**Authentication Methods**:
1. **OAuth Providers**
   - GitHub
   - Google
   - More via configuration

2. **Email (Magic Link)** (optional)
   - Enter email
   - Receive magic link
   - Click link to sign in

**Sign In Flow**:
```
Navigate to /auth/signin
→ Click OAuth Provider Button
→ Redirect to Provider
→ Authorize App
→ Redirect Back with Token
→ NextAuth Creates Session
→ Check if User Has Organization
→ If Yes: Redirect to /mission-control
→ If No: Redirect to /setup
```

### Organization Setup

**Route**: `/(auth)/setup`
**Shown**: Only to users without an organization

**Setup Form**:
1. **Organization Name** (required)
2. **Organization Mission** (optional)
3. **Initial Settings**:
   - Timezone
   - Default language

**Setup Flow**:
```
First-Time User Signs In
→ Redirected to /setup
→ Fill Organization Details
→ Submit
→ Organization Created
→ User Added as Admin
→ Default Team Created
→ Welcome Email Sent (optional)
→ Redirect to /mission-control
```

### Session Management

**Provider**: NextAuth with JWT strategy

**Session Data**:
```typescript
{
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
  };
  currentOrganizationId: string;
  availableOrganizations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  permissions: string[];
}
```

**Session Usage**:
- Available in all server components via `getServerSession()`
- Available in client components via `useSession()` hook
- Used for authorization checks
- Used for organization scoping

### Invitation Acceptance

**Route**: `/(auth)/invitations/[token]`
**Purpose**: Process invitation tokens

**Flow**:
```
User Receives Invitation Email
→ Clicks Link with Token
→ Navigates to /auth/invitations/[token]
→ If Not Signed In: Redirect to /auth/signin?callbackUrl=...
→ If Signed In: Process Token
→ Validate Token (not expired, not used)
→ Add User to Organization
→ Assign Initial Role
→ Mark Token as Used
→ Redirect to Organization Dashboard
→ Show Welcome Message
```

**Error Cases**:
- Token expired: Show error, offer to request new invite
- Token already used: Show error, redirect to sign in
- Invalid token: Show error, redirect to home

### Sign Out

**Trigger**: Click "Sign Out" in sidebar

**Flow**:
```
Click "Sign Out"
→ Confirmation (optional)
→ NextAuth Sign Out
→ Session Destroyed
→ Redirect to /auth/signin
```

---

## State Management Architecture

### Client-Side State (TanStack Store)

**Stores**:

1. **agentsStore** (`stores/agentsStore.ts`)
   - Agent list
   - Selected agent ID
   - Search query
   - Panel collapse state
   - Loading states

2. **teamsStore** (`stores/teamsStore.ts`)
   - Team list
   - Selected team ID
   - Search query
   - Form dialog state
   - Loading states

3. **orgChartStore** (`stores/orgChartStore.ts`)
   - Organization chart nodes
   - Organization chart edges
   - Selected node
   - Tasks for selected node
   - View mode (view/edit/activity)
   - Zoom/pan state

4. **uiStateStore** (`stores/uiStateStore.ts`)
   - Sidebar collapsed state
   - Chat panel visibility
   - Canvas expanded state
   - Mobile detection
   - Theme preference

**Store Pattern**:
```typescript
import { Store } from '@tanstack/store';

interface AgentsState {
  agents: Agent[];
  selectedAgentId: string | null;
  searchQuery: string;
  isPanelCollapsed: boolean;
}

export const agentsStore = new Store<AgentsState>({
  agents: [],
  selectedAgentId: null,
  searchQuery: '',
  isPanelCollapsed: false,
});

// Usage in component
import { useStore } from '@tanstack/react-store';
import { agentsStore } from '@/stores/agentsStore';

function AgentsList() {
  const agents = useStore(agentsStore, (state) => state.agents);
  const searchQuery = useStore(agentsStore, (state) => state.searchQuery);

  // ...
}
```

**Benefits**:
- Fine-grained subscriptions (components only re-render when subscribed state changes)
- No provider needed (global store)
- TypeScript-first
- Minimal boilerplate

### Server-Side State

**Database (Drizzle ORM)**:
- PostgreSQL for all persistent data
- Static schema for core entities
- Dynamic tables for user-created data

**Session (NextAuth)**:
- JWT-based session storage
- Server-only session access
- Automatic session refresh

### Data Fetching Patterns

**Server Actions**:
```typescript
// app/actions/agents.ts
'use server';

export async function getAgents() {
  const session = await getServerSession();
  const container = getDIContainer();
  const agentService = container.getAgentApplicationService();

  const result = await agentService.getAllAgents(
    OrganizationId.fromString(session.currentOrganizationId)
  );

  return result;
}
```

**Client Usage**:
```typescript
'use client';

import { getAgents } from '@/app/actions/agents';
import { agentsStore } from '@/stores/agentsStore';

async function loadAgents() {
  const agents = await getAgents();
  agentsStore.setState((state) => ({
    ...state,
    agents,
  }));
}
```

**API Routes** (for streaming):
```typescript
// app/api/tasks/[id]/stream/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Stream task progress via SSE
  streamTaskProgress(params.id, writer);

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## API Reference

### Agent APIs

**Get All Agents** (Server Action)
```typescript
getAgents(): Promise<Agent[]>
```

**Create Agent** (Server Action)
```typescript
createAgent(data: CreateAgentInput): Promise<Result<Agent>>

interface CreateAgentInput {
  name: string;
  role: string;
  description?: string;
  persona?: string;
  status?: 'active' | 'inactive' | 'archived';
}
```

**Update Agent** (Server Action)
```typescript
updateAgent(id: string, data: UpdateAgentInput): Promise<Result<Agent>>
```

**Delete Agent** (Server Action)
```typescript
deleteAgent(id: string): Promise<Result<void>>
```

**Execute Agent** (API Route)
```typescript
POST /api/agents/[id]/execute
Body: {
  instructions: string;
  capabilityId?: string;
}
Response: { taskId: string }
```

### Task APIs

**Get Tasks** (Server Action)
```typescript
getTasks(filters?: TaskFilters): Promise<Task[]>

interface TaskFilters {
  agentId?: string;
  status?: TaskStatus;
  createdBy?: string;
}
```

**Stream Task Progress** (API Route - SSE)
```typescript
GET /api/tasks/[id]/stream
Headers: {
  Accept: 'text/event-stream'
}
Response: SSE stream with events:
  - progress
  - step
  - log
  - result
  - error
  - complete
```

**Cancel Task** (API Route)
```typescript
PATCH /api/tasks/[id]/cancel
Response: { success: boolean }
```

### Table APIs

**Get Tables** (Server Action)
```typescript
getTables(databaseId?: string): Promise<Table[]>
```

**Create Table** (Server Action)
```typescript
createTable(data: CreateTableInput): Promise<Result<Table>>

interface CreateTableInput {
  name: string;
  databaseId: string;
}
```

**Create Row** (API Route)
```typescript
POST /api/rows
Body: {
  tableId: string;
  data: Record<string, any>;
}
Response: { rowId: string }
```

**Update Row** (API Route)
```typescript
PATCH /api/rows/[id]
Body: {
  data: Record<string, any>;
}
Response: { success: boolean }
```

**Delete Row** (API Route)
```typescript
DELETE /api/rows/[id]
Response: { success: boolean }
```

### Field APIs

**Get Fields** (Server Action)
```typescript
getFields(tableId: string): Promise<Field[]>
```

**Create Field** (Server Action)
```typescript
createField(data: CreateFieldInput): Promise<Result<Field>>

interface CreateFieldInput {
  tableId: string;
  name: string;
  type: FieldType;
  required?: boolean;
  order?: number;
}
```

**Delete Field** (Server Action)
```typescript
deleteField(id: string): Promise<Result<void>>
```

### Team APIs

**Get Teams** (Server Action)
```typescript
getTeams(): Promise<Team[]>
```

**Create Team** (Server Action)
```typescript
createTeam(data: CreateTeamInput): Promise<Result<Team>>

interface CreateTeamInput {
  name: string;
  purpose?: string;
  description?: string;
  responsibilities?: string[];
  goals?: string[];
}
```

**Update Team** (Server Action)
```typescript
updateTeam(id: string, data: UpdateTeamInput): Promise<Result<Team>>
```

**Delete Team** (Server Action)
```typescript
deleteTeam(id: string): Promise<Result<void>>
```

### Organization APIs

**Get Organization KPIs** (API Route)
```typescript
GET /api/organizations/[id]/kpis
Response: {
  totalAgents: number;
  activeAgents: number;
  totalTeams: number;
  totalTasks: number;
  completedTasks: number;
}
```

---

## Component File Reference

### Core Layout
- `components/emery/sidebar/EmerySidebar.tsx` - Main navigation sidebar
- `components/emery/providers/EmeryProviders.tsx` - Root providers
- `components/emery/organization/EmeryOrganizationModal.tsx` - Org switcher

### Agents
- `components/emery/agents/AgentDashboardClient.tsx` - Agent dashboard
- `components/emery/agents/AgentDetailsView.tsx` - Agent details
- `components/emery/agents/AgentCreateView.tsx` - Agent creation form
- `components/emery/agents/CapabilityManager.tsx` - Capability CRUD
- `components/emery/agents/ScheduleManager.tsx` - Agent scheduling

### Teams
- `components/emery/teams/TeamDashboardClient.tsx` - Team dashboard
- `components/emery/teams/TeamDetailsView.tsx` - Team details
- `components/emery/teams/TeamFormDialog.tsx` - Team form
- `components/emery/teams/TeamMembersPanel.tsx` - Member management
- `components/emery/teams/TeamActivityPanel.tsx` - Activity view

### Organization
- `components/emery/organization-chart/OrganizationChartClient.tsx` - ReactFlow chart
- `components/emery/organization-chart/nodes/TeamNode.tsx` - Team node
- `components/emery/organization-chart/nodes/AgentNode.tsx` - Agent node
- `components/emery/organization-chart/ActivityPanel.tsx` - Activity panel

### Data Management
- `components/emery/tables/DynamicDataTable.tsx` - Table view
- `components/emery/tables/EditableCell.tsx` - Inline editing
- `components/emery/tables/RowEditorModal.tsx` - Row editor
- `components/emery/tables/RowViewerModal.tsx` - Row viewer
- `components/emery/tables/FieldManagerDialog.tsx` - Field management
- `components/emery/fields/DocumentField.tsx` - Rich text field
- `components/emery/fields/FileField.tsx` - File upload field
- `components/emery/fields/RelationField.tsx` - Foreign key field

### Tasks
- `components/emery/tasks/TaskFormDialog.tsx` - Task creation
- `components/emery/tasks/TaskCard.tsx` - Task card
- `components/emery/tasks/TaskLogsPanel.tsx` - Task logs
- `components/emery/tasks/TaskResultDisplay.tsx` - Task results

### Permissions
- `components/emery/permissions/PermissionsManager.tsx` - Main manager
- `components/emery/permissions/RolesTab.tsx` - Roles tab
- `components/emery/permissions/UsersTab.tsx` - Users tab
- `components/emery/permissions/RoleWizard.tsx` - Role creation wizard
- `components/emery/permissions/PermissionSelector.tsx` - Permission picker
- `components/emery/permissions/ResourceSelector.tsx` - Resource scoping

### Chat
- `components/emery/chat/EmeryChat.tsx` - Main chat component
- `components/emery/chat/ChatCanvas.tsx` - Canvas controls
- `components/emery/chat/CustomChatInput.tsx` - Chat input
- `components/emery/chat/ChatHistoryDropdown.tsx` - History dropdown
- `components/emery/chat/ToolPanel.tsx` - Tool display
- `components/emery/chat/ReferencesPanel.tsx` - References panel
- `components/emery/chat/ToolDropdown.tsx` - Tool selector

### Connections
- `components/emery/connections/ConnectionsManager.tsx` - Connections page
- `components/emery/connections/UnifiedConnectionsGrid.tsx` - Grid layout
- `components/emery/connections/AppConnectionCard.tsx` - Connection card

---

## Next Steps for UX Enhancements

### Potential Features (Not Yet Implemented)
1. **Bulk Operations**: Select multiple rows/agents/teams and perform actions
2. **Export/Import**: Export tables to CSV/JSON, import data
3. **Advanced Filters**: More filter options for tables and lists
4. **Webhooks**: Trigger agents via external webhooks
5. **Notifications**: In-app and email notifications for task completion
6. **Audit Log**: Track all changes for compliance
7. **Version History**: Track changes to agents, teams, data
8. **Collaboration**: Real-time collaboration on tables
9. **Comments**: Add comments to rows, agents, tasks
10. **Dashboards**: Custom dashboards with widgets
11. **Reports**: Generate PDF/Excel reports from data
12. **Mobile App**: Native mobile experience

### Known UX Improvements
1. **Loading States**: More granular loading indicators
2. **Error Handling**: Better error messages and recovery flows
3. **Onboarding**: Interactive tutorial for new users
4. **Keyboard Shortcuts**: Power user keyboard navigation
5. **Accessibility**: Full WCAG 2.1 AA compliance
6. **Performance**: Virtual scrolling for large tables
7. **Offline Mode**: Service worker for offline access

---

**End of Documentation**
