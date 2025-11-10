# Sidebar Refactor - Code Review & Implementation Guide

## Overview

This document provides a comprehensive review of the sidebar refactor implementation, outlining the architectural changes, new patterns introduced, and migration impacts for the Orchastrate application.

### What Changed

We migrated from a custom sidebar implementation to the **shadcn/ui Sidebar** component system, which provides:
- Modern, accessible UI components following shadcn/ui design patterns
- Collapsible sections with proper state management
- Hierarchical navigation with nested items (apps → pages)
- Inline creation of new items directly from the sidebar
- Consistent UX across all resource types (Apps, Agents, Teams, Skills, Data)

### Why We Changed

**Problems with Old Implementation:**
1. **Redundant List Pages**: Each resource type (Apps, Agents, Teams, Skills) had dedicated dashboard/list pages that duplicated functionality
2. **Poor Navigation**: Users had to navigate through list pages before accessing individual items
3. **Inconsistent Patterns**: Different resource types used different navigation patterns
4. **Scattered Creation Flow**: Creating new items required navigating to specific pages

**Benefits of New Implementation:**
1. **Direct Navigation**: All items accessible directly from sidebar, eliminating intermediate list pages
2. **Inline Creation**: Quick creation via "+ Add" buttons in sidebar with immediate navigation to new items
3. **Consistent UX**: All resource types follow the same collapsible pattern
4. **Better Information Architecture**: Hierarchical structure (e.g., Apps contain Pages)
5. **Improved Discoverability**: All resources visible at a glance in organized sections

---

## Architecture Changes

### Before: Dashboard-Centric Pattern

```
/apps/page.tsx
└─> AppsDashboardClient (list of apps)
    └─> Click app → Navigate to /apps/[id]

/agents/page.tsx
└─> AgentDashboardClient (list of agents)
    └─> Click agent → Navigate to /agents/[id]

/teams/page.tsx
└─> TeamDashboardClient (list of teams)
    └─> Click team → Navigate to /teams/[id]

/skills/page.tsx
└─> OrganizationSkillsListView (list of skills)
    └─> Click skill → Navigate to /skills/[id]
```

**Issues:**
- Extra page load for list view before accessing items
- Each dashboard component managed its own state
- Inconsistent loading states and error handling
- Creation flows required separate pages or modals

### After: Sidebar-Centric Pattern

```
AppSidebarClient (fetches all data once)
├─> Apps (collapsible section)
│   ├─> App 1
│   │   ├─> Page 1
│   │   ├─> Page 2
│   │   └─> + Add Page
│   ├─> App 2
│   └─> + Add App
├─> Agents (collapsible section)
│   ├─> Agent 1
│   ├─> Agent 2
│   └─> + Add Agent
├─> Teams (collapsible section)
│   ├─> Team 1
│   └─> + Add Team
└─> Skills (collapsible section)
    ├─> Skill 1
    └─> + Add Skill

Old routes (/apps, /agents, /teams, /skills) → Redirect to first item or mission-control
```

**Benefits:**
- Single data fetch at sidebar mount
- Centralized state management
- Immediate navigation to items
- Consistent creation pattern across all resource types

---

## Key Components

### 1. AppSidebar (`src/components/app-sidebar.tsx`)

**Purpose**: Main presentational sidebar component using shadcn/ui primitives

**Key Features:**
- Props-based data (receives apps, agents, teams, skills, databases)
- Collapsible sections with default open state based on current route
- Nested structure for apps → pages hierarchy
- Inline creation handlers for all resource types
- Active state highlighting based on pathname
- Organization switcher in header
- User profile menu in footer

**Component Structure:**
```tsx
<Sidebar>
  <SidebarHeader>
    <EmeryOrganizationModal /> {/* Organization switcher */}
  </SidebarHeader>

  <SidebarContent>
    {/* Mission Control */}
    <Collapsible defaultOpen={pathname?.startsWith("/mission-control")}>
      <SidebarGroup>...</SidebarGroup>
    </Collapsible>

    {/* Apps with nested pages */}
    <Collapsible defaultOpen={pathname?.startsWith("/apps")}>
      <SidebarGroup>
        {apps.map((app) => (
          <Collapsible key={app.id}>
            <SidebarMenuItem>
              <a href={`/apps/${app.id}`}>{app.name}</a>
              <SidebarMenuSub>
                {app.pages.map((page) => (
                  <a href={`/apps/${app.id}/pages/${page.id}`}>
                    {page.name}
                  </a>
                ))}
                <Button onClick={() => handleCreatePage(app.id)}>
                  + Add Page
                </Button>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </Collapsible>
        ))}
        <Button onClick={handleCreateApp}>+ Add App</Button>
      </SidebarGroup>
    </Collapsible>

    {/* Similar patterns for Agents, Teams, Skills, Data, Settings */}
  </SidebarContent>

  <SidebarFooter>
    {/* User profile menu with sign out */}
  </SidebarFooter>
</Sidebar>
```

**Creation Handlers:**
Each handler follows the same pattern:
1. Set loading state (`isCreating`)
2. Call server action to create default item
3. Show toast notification (success/error)
4. Navigate to new item on success
5. Clear loading state

Example:
```typescript
const handleCreateAgent = async () => {
  setIsCreating(true)
  try {
    const result = await createDefaultAgent()
    if (result.success && result.data) {
      toast.success("Agent created")
      router.push(`/agents/${result.data.id}`)
    } else {
      toast.error(result.error || "Failed to create agent")
    }
  } catch (error) {
    toast.error("Failed to create agent")
  } finally {
    setIsCreating(false)
  }
}
```

### 2. AppSidebarClient (`src/components/app-sidebar-client.tsx`)

**Purpose**: Client-side wrapper that fetches sidebar data and passes to AppSidebar

**Key Features:**
- Fetches data on mount using React hooks
- Waits for session before fetching (organization-scoped data)
- Aggregates data from multiple server actions
- Transforms data into sidebar-compatible format
- Handles loading and error states
- Re-fetches when organization changes

**Type Safety:**
Defines comprehensive TypeScript interfaces for all sidebar data:
```typescript
interface SidebarPage {
  id: number
  name: string
  appId: number
}

interface SidebarApp {
  id: number
  name: string
  pages: SidebarPage[]
}

interface SidebarAgent {
  id: number
  name: string
}

interface SidebarTeam {
  id: number
  name: string
}

interface SidebarSkill {
  id: number
  name: string
}

interface SidebarTable {
  id: number
  name: string
}

interface SidebarDatabase {
  id: number
  name: string
  tables: SidebarTable[]
}

interface SidebarData {
  apps: SidebarApp[]
  agents: SidebarAgent[]
  teams: SidebarTeam[]
  skills: SidebarSkill[]
  databases: SidebarDatabase[]
}
```

**Data Fetching Flow:**
```typescript
useEffect(() => {
  async function fetchData() {
    if (!session?.user?.currentOrganizationId) {
      setLoading(false)
      return
    }

    try {
      // 1. Fetch all resource types in parallel
      const [appsResult, agentsResult, teamsResult, skillsResult] = await Promise.all([
        getApps(),
        getAgents(),
        getTeams(),
        getSkillsByOrganization(session.user.currentOrganizationId)
      ])

      // 2. Fetch pages for each app (sequential per app, parallel across apps)
      const appsWithPages = await Promise.all(
        (appsResult || []).map(async (app) => {
          const pages = await getPages(app.id)
          return { ...app, pages: pages || [] }
        })
      )

      // 3. Transform to SidebarData format
      setData({
        apps: appsWithPages.map((app) => ({
          id: app.id,
          name: app.name,
          pages: app.pages.map((page) => ({
            id: page.id,
            name: page.name,
            appId: app.id
          }))
        })),
        agents: (agentsResult || []).map((agent) => ({
          id: agent.id,
          name: agent.name
        })),
        teams: (teamsResult || []).map((team) => ({
          id: team.id,
          name: team.name
        })),
        skills: (skillsResult?.success && skillsResult?.data ? skillsResult.data : []).map((skill) => ({
          id: skill.id,
          name: skill.name
        })),
        databases: [] // TODO: Fetch databases
      })
    } catch (error) {
      console.error("Error fetching sidebar data:", error)
    } finally {
      setLoading(false)
    }
  }

  fetchData()
}, [session?.user?.currentOrganizationId])
```

**AIDEV-NOTE:** This is a temporary client-side fetching solution. Ideally, we would fetch this data on the server (in layout or a server component) and pass it as props to avoid client-side waterfalls.

### 3. EmeryLayout (`src/components/layout/EmeryLayout.tsx`)

**Purpose**: Core layout wrapper that integrates sidebar with main content area

**Key Changes:**
- Now uses `AppSidebarClient` instead of old `EmerySidebar`
- Wraps layout in `SidebarProvider` for shadcn/ui sidebar context
- Uses `Suspense` with skeleton loaders for better loading UX

**Layout Structure:**
```tsx
<SidebarProvider>
  <div className="flex h-screen w-full overflow-hidden">
    {/* Sidebar with loading fallback */}
    <Suspense fallback={<SidebarSkeleton />}>
      <AppSidebarClient />
    </Suspense>

    {/* Main content area + Chat */}
    <SidebarInset className="flex-1 flex min-h-0">
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 overflow-y-auto">
          <MainContentWithCanvas>
            {children}
          </MainContentWithCanvas>
        </main>

        {enableChat && (
          <ChatProvider chatContext={chatContext}>
            <Suspense fallback={<ChatSkeleton />}>
              <EmeryChat />
            </Suspense>
          </ChatProvider>
        )}
      </div>
    </SidebarInset>
  </div>
</SidebarProvider>
```

---

## Server Actions - Default Creation Pattern

A key innovation in this refactor is the **default creation pattern** - allowing quick creation of items with minimal data, then immediate navigation to the detail page for editing.

### Pattern Implementation

Each resource type implements a `createDefault{Resource}` server action:

#### Example: `createDefaultAgent` (`src/app/actions/agents.ts:108-119`)

```typescript
/**
 * Create a default agent with minimal data
 * Used for quick creation from sidebar + button
 */
export async function createDefaultAgent(): Promise<Result> {
  return withAuthContext(async () => {
    const defaultData: CreateAgentClientData = {
      name: "Untitled Agent",
      role: "Assistant",
      description: "",
      persona: "",
      status: "active",
    };
    return createAgentFromClient(defaultData);
  });
}
```

#### Example: `createApp` (`src/app/actions/puck-apps.ts:147-208`)

```typescript
/**
 * Create a new Puck app
 * If no data is provided, creates a default "Untitled App" with auto-generated slug
 */
export async function createApp(
  data?: z.infer<typeof createAppSchema>,
  revalidateUrl?: string
): Promise<Result> {
  try {
    const session = await requirePermission("apps:create");
    const currentOrg = await requireCurrentOrganization();

    const validatedData = createAppSchema.parse(data || {});
    const appService = getAppApplicationService();

    // Generate defaults if not provided
    const name = validatedData.name || "Untitled App";
    let slug = validatedData.slug;

    if (!slug) {
      const slugResult = await appService.generateSlugFromName(
        OrganizationId.fromNumber(currentOrg.id),
        name
      );
      if (!slugResult.success) {
        return { success: false, error: "Failed to generate slug" };
      }
      slug = slugResult.data!;
    }

    const result = await appService.createApp({
      name,
      slug,
      description: validatedData.description,
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      createdBy: UserId.fromString(session.user.id)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create app"
      };
    }

    // Revalidate cache
    revalidatePath(revalidateUrl || '/apps');

    return {
      success: true,
      data: result.data ? AppMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('Error creating Puck app:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
      }
    }

    return { success: false, error: "Failed to create app" }
  }
}
```

**Pattern Benefits:**
1. **Minimal Input Required**: No forms or modals needed for initial creation
2. **Smart Defaults**: Auto-generates names, slugs, and other required fields
3. **Immediate Access**: User can start editing the item immediately after creation
4. **Consistent UX**: Same pattern works for all resource types
5. **Edit-in-Place**: Detail pages become the editing interface

**Implementation Checklist for New Resources:**
- [ ] Create `createDefault{Resource}` server action with sensible defaults
- [ ] Ensure auto-generation of required fields (names, slugs, identifiers)
- [ ] Return Result type with created item data (especially ID for navigation)
- [ ] Add "+ Add {Resource}" button to sidebar section
- [ ] Wire button to creation handler → navigate to detail page on success

---

## Route Changes - Redirect Pattern

### Old Pattern: List Pages

```typescript
// src/app/(app)/agents/page.tsx (OLD)
export default async function AgentsPage() {
  const agents = await getAgents();

  return <AgentDashboardClient agents={agents} />
}
```

### New Pattern: Smart Redirects

```typescript
// src/app/(app)/agents/page.tsx (NEW)
import { redirect } from 'next/navigation';
import { getAgents } from '@/app/actions/agents';

// AIDEV-NOTE: Agents list now shown in sidebar
// This page redirects to first agent or mission-control

export default async function AgentsPage() {
  const agents = await getAgents();

  // Redirect to first agent if exists, otherwise to mission-control
  if (agents && agents.length > 0) {
    redirect(`/agents/${agents[0].id}`);
  }

  redirect("/mission-control/dashboard");
}
```

**Rationale:**
1. **Backward Compatibility**: Old bookmarks/links to `/agents` still work
2. **Intuitive Behavior**: If user has agents, show the first one; if not, go to dashboard
3. **No Dead Ends**: Never show an empty list page - always navigate somewhere useful
4. **Consistent Pattern**: Same redirect logic for /apps, /agents, /teams, /skills

**Routes Modified:**
- `src/app/(app)/agents/page.tsx` - Redirect to first agent or mission-control
- `src/app/(app)/teams/page.tsx` - Redirect to first team or mission-control
- `src/app/(app)/skills/page.tsx` - Redirect to first skill or mission-control
- `src/app/(app)/apps/page.tsx` - Already had redirect pattern, no change needed

**Components Removed:**
- `src/app/(app)/apps/components/AppsDashboardClient.tsx` - Replaced by sidebar
- `src/app/(app)/agents/components/AgentDashboardClient.tsx` - Replaced by sidebar
- `src/app/(app)/teams/components/TeamDashboardClient.tsx` - Replaced by sidebar
- `src/app/(app)/skills/components/OrganizationSkillsListView.tsx` - Replaced by sidebar

---

## Data Flow

### 1. Initial Page Load

```
User visits /apps/123
  ↓
EmeryLayout renders
  ↓
<Suspense> starts loading AppSidebarClient
  ↓
AppSidebarClient useEffect triggers (session available)
  ↓
Parallel fetch:
  ├─> getApps()
  ├─> getAgents()
  ├─> getTeams()
  └─> getSkillsByOrganization()
  ↓
For each app: getPages(app.id)
  ↓
Transform to SidebarData format
  ↓
Pass to AppSidebar as props
  ↓
AppSidebar renders with active state highlighted
```

### 2. Creating New Item from Sidebar

```
User clicks "+ Add Agent" in sidebar
  ↓
handleCreateAgent() in AppSidebar
  ↓
setIsCreating(true) - disable button
  ↓
Call createDefaultAgent() server action
  ↓
Server Action Flow:
  ├─> Validate permissions (agents:manage)
  ├─> Get current organization
  ├─> Create agent with defaults:
  │     {
  │       name: "Untitled Agent",
  │       role: "Assistant",
  │       status: "active",
  │       ...
  │     }
  ├─> Save to database via AgentApplicationService
  ├─> Return Result with agent ID
  └─> Revalidate cache
  ↓
On success:
  ├─> toast.success("Agent created")
  ├─> router.push(`/agents/${result.data.id}`)
  └─> setIsCreating(false)
  ↓
Navigation to detail page
  ↓
User edits agent inline
```

### 3. Organization Change

```
User switches organization in EmeryOrganizationModal
  ↓
Session updates with new currentOrganizationId
  ↓
AppSidebarClient useEffect dependency triggers
  ↓
Re-fetch all sidebar data for new organization
  ↓
Sidebar updates with new organization's resources
```

---

## Key Patterns & Best Practices

### 1. Server Actions Result Pattern

All server actions return a consistent `Result` type:

```typescript
export type Result = {
  success: boolean
  error?: string
  data?: any
}
```

**Usage:**
```typescript
const result = await createDefaultAgent();

if (result.success && result.data) {
  // Handle success
  router.push(`/agents/${result.data.id}`);
} else {
  // Handle error
  toast.error(result.error || "Failed to create agent");
}
```

### 2. Permission Checking

All server actions check permissions before performing operations:

```typescript
// General permission
const session = await requirePermission("agents:manage");

// Resource-specific permission
const session = await requireResourcePermission("agents:manage", "agent", agentId);

// Organization context
const currentOrg = await requireCurrentOrganization();
```

### 3. Value Objects in Server Actions

Server actions use DDD Value Objects for type safety:

```typescript
// Convert plain types to Value Objects
const result = await appService.createApp({
  name,
  slug,
  description: validatedData.description,
  organizationId: OrganizationId.fromNumber(currentOrg.id), // Value Object
  createdBy: UserId.fromString(session.user.id) // Value Object
});

// Convert Value Objects back to plain types for DTOs
const dto: CreateAgentDTO = {
  ownerId: data.ownerId instanceof UserId
    ? data.ownerId.value  // Extract plain value
    : data.ownerId,       // Already plain
  // ...
};
```

### 4. Sidebar Active State Management

The sidebar uses `pathname` to determine which section should be expanded and which items are active:

```typescript
const pathname = usePathname()

// Section expansion
<Collapsible defaultOpen={pathname?.startsWith("/agents")}>

// Item active state
<SidebarMenuButton
  asChild
  isActive={pathname?.startsWith(`/agents/${agent.id}`)}
>
  <a href={`/agents/${agent.id}`}>{agent.name}</a>
</SidebarMenuButton>
```

### 5. Loading State Management

Sidebar uses a single `isCreating` state for all creation operations:

```typescript
const [isCreating, setIsCreating] = React.useState(false)

// Disable all creation buttons while any creation is in progress
<Button
  onClick={handleCreateAgent}
  disabled={isCreating}
>
  <Plus className="h-4 w-4" />
  <span>Add Agent</span>
</Button>
```

**Rationale**: Prevents users from triggering multiple simultaneous creations

### 6. Data Transformation Pattern

AppSidebarClient transforms server action results into sidebar-compatible format:

```typescript
// Server action returns full DTOs
const appsResult = await getApps();

// Transform to minimal sidebar format
apps: appsWithPages.map((app) => ({
  id: app.id,           // Only ID
  name: app.name,       // Only name
  pages: app.pages.map((page) => ({
    id: page.id,
    name: page.name,
    appId: app.id
  }))
}))
```

**Rationale**: Sidebar only needs ID and name, avoiding unnecessary data serialization

---

## Migration Notes

### For Developers Adding New Resources

When adding a new resource type to the sidebar (e.g., "Workflows"), follow this checklist:

#### 1. Create Server Actions (`src/app/actions/workflows.ts`)

```typescript
export async function getWorkflows(): Promise<WorkflowDTO[]> {
  // Fetch all workflows for current organization
}

export async function createDefaultWorkflow(): Promise<Result> {
  const defaultData = {
    name: "Untitled Workflow",
    // ... other required fields with sensible defaults
  };
  return createWorkflowFromClient(defaultData);
}
```

#### 2. Add Types to AppSidebarClient (`src/components/app-sidebar-client.tsx`)

```typescript
interface SidebarWorkflow {
  id: number
  name: string
}

interface SidebarData {
  apps: SidebarApp[]
  agents: SidebarAgent[]
  teams: SidebarTeam[]
  skills: SidebarSkill[]
  workflows: SidebarWorkflow[]  // Add new type
  databases: SidebarDatabase[]
}
```

#### 3. Fetch Data in AppSidebarClient

```typescript
const [workflowsResult, /* ... */] = await Promise.all([
  getWorkflows(),  // Add to parallel fetch
  /* ... */
])

setData({
  // ...
  workflows: (workflowsResult || []).map((workflow) => ({
    id: workflow.id,
    name: workflow.name
  })),
  // ...
})
```

#### 4. Add Props to AppSidebar (`src/components/app-sidebar.tsx`)

```typescript
interface AppSidebarProps {
  apps: AppData[]
  agents: AgentData[]
  teams: TeamData[]
  skills: SkillData[]
  workflows: WorkflowData[]  // Add new prop
  databases: DatabaseData[]
}
```

#### 5. Render Section in AppSidebar

```tsx
{/* Workflows */}
<Collapsible defaultOpen={pathname?.startsWith("/workflows")}>
  <SidebarGroup>
    <SidebarGroupLabel asChild>
      <CollapsibleTrigger>
        <Workflow className="h-4 w-4" />
        <span>Workflows</span>
      </CollapsibleTrigger>
    </SidebarGroupLabel>
    <CollapsibleContent>
      <SidebarGroupContent>
        <SidebarMenu>
          {workflows.map((workflow) => (
            <SidebarMenuItem key={workflow.id}>
              <SidebarMenuButton
                asChild
                isActive={pathname?.startsWith(`/workflows/${workflow.id}`)}
              >
                <a href={`/workflows/${workflow.id}`}>{workflow.name}</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleCreateWorkflow}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4" />
              <span>Add Workflow</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </CollapsibleContent>
  </SidebarGroup>
</Collapsible>
```

#### 6. Add Creation Handler

```typescript
const handleCreateWorkflow = async () => {
  setIsCreating(true)
  try {
    const result = await createDefaultWorkflow()
    if (result.success && result.data) {
      toast.success("Workflow created")
      router.push(`/workflows/${result.data.id}`)
    } else {
      toast.error(result.error || "Failed to create workflow")
    }
  } catch (error) {
    toast.error("Failed to create workflow")
  } finally {
    setIsCreating(false)
  }
}
```

#### 7. Add Redirect Route (`src/app/(app)/workflows/page.tsx`)

```typescript
import { redirect } from 'next/navigation';
import { getWorkflows } from '@/app/actions/workflows';

export default async function WorkflowsPage() {
  const workflows = await getWorkflows();

  if (workflows && workflows.length > 0) {
    redirect(`/workflows/${workflows[0].id}`);
  }

  redirect("/mission-control/dashboard");
}
```

### For Nested Resources (like Pages within Apps)

If your resource has a hierarchical structure:

1. Fetch child items in AppSidebarClient:
```typescript
const appsWithPages = await Promise.all(
  (appsResult || []).map(async (app) => {
    const pages = await getPages(app.id)
    return { ...app, pages: pages || [] }
  })
)
```

2. Render nested structure in AppSidebar:
```tsx
<Collapsible key={app.id}>
  <SidebarMenuItem>
    <CollapsibleTrigger asChild>
      <SidebarMenuButton asChild>
        <a href={`/apps/${app.id}`}>{app.name}</a>
      </SidebarMenuButton>
    </CollapsibleTrigger>
    {app.pages && app.pages.length > 0 && (
      <CollapsibleContent>
        <SidebarMenuSub>
          {app.pages.map((page) => (
            <SidebarMenuSubItem key={page.id}>
              <SidebarMenuSubButton asChild>
                <a href={`/apps/${app.id}/pages/${page.id}`}>
                  {page.name}
                </a>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    )}
  </SidebarMenuItem>
</Collapsible>
```

---

## Performance Considerations

### Current Implementation

**Pros:**
- ✅ Single data fetch per organization (not per route change)
- ✅ Parallel fetching of independent resources
- ✅ Client-side rendering avoids blocking page navigation
- ✅ Suspense boundaries prevent layout shift

**Cons:**
- ⚠️ Client-side fetching causes waterfall (wait for session → fetch data)
- ⚠️ Sequential page fetches per app (could be optimized)
- ⚠️ Re-fetches all data on organization change (could cache previous orgs)

### Future Optimizations

#### 1. Server-Side Data Fetching (Recommended)

Move data fetching to server component in layout:

```typescript
// src/app/(app)/layout.tsx
export default async function AppLayout({ children }) {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    return <EmeryLayout>{children}</EmeryLayout>
  }

  // Fetch on server
  const [apps, agents, teams, skills] = await Promise.all([
    getApps(),
    getAgents(),
    getTeams(),
    getSkillsByOrganization(session.user.currentOrganizationId)
  ]);

  // Fetch pages for all apps in parallel
  const appsWithPages = await Promise.all(
    apps.map(async (app) => ({
      ...app,
      pages: await getPages(app.id)
    }))
  );

  const sidebarData = {
    apps: appsWithPages,
    agents,
    teams,
    skills,
    databases: []
  };

  return (
    <EmeryLayout sidebarData={sidebarData}>
      {children}
    </EmeryLayout>
  );
}
```

**Benefits:**
- No client-side waterfall
- Faster initial render
- Better SEO (if needed)
- Reduced client bundle size

#### 2. Optimistic Updates

Add optimistic updates when creating items:

```typescript
const handleCreateAgent = async () => {
  const tempId = Date.now();
  const optimisticAgent = {
    id: tempId,
    name: "Untitled Agent"
  };

  // Immediately add to sidebar
  setData(prev => ({
    ...prev,
    agents: [...prev.agents, optimisticAgent]
  }));

  // Navigate immediately
  router.push(`/agents/${tempId}`);

  // Then create on server
  const result = await createDefaultAgent();

  if (result.success) {
    // Replace temp ID with real ID
    router.replace(`/agents/${result.data.id}`);
  } else {
    // Rollback on error
    setData(prev => ({
      ...prev,
      agents: prev.agents.filter(a => a.id !== tempId)
    }));
    toast.error("Failed to create agent");
  }
};
```

#### 3. Incremental Page Loading

For apps with many pages, load pages on-demand:

```typescript
// Only fetch pages when app section is expanded
<Collapsible
  onOpenChange={(isOpen) => {
    if (isOpen && !app.pagesLoaded) {
      loadPages(app.id);
    }
  }}
>
```

---

## Testing Strategy

### Areas to Test

#### 1. Sidebar Navigation
- [ ] All sections expand/collapse correctly
- [ ] Active states highlight correctly based on current route
- [ ] Nested items (app pages) render correctly
- [ ] Navigation to items works (apps, agents, teams, skills)

#### 2. Item Creation
- [ ] All "+ Add" buttons create items successfully
- [ ] Creation shows loading state (button disabled)
- [ ] Success creates item and navigates to detail page
- [ ] Errors show appropriate toast messages
- [ ] isCreating prevents multiple simultaneous creations

#### 3. Redirects
- [ ] /apps redirects to first app or mission-control
- [ ] /agents redirects to first agent or mission-control
- [ ] /teams redirects to first team or mission-control
- [ ] /skills redirects to first skill or mission-control
- [ ] Empty state redirects to mission-control

#### 4. Organization Switching
- [ ] Sidebar data updates when organization changes
- [ ] No stale data from previous organization
- [ ] Loading state shown during refetch

#### 5. Permissions
- [ ] Creation buttons respect permissions
- [ ] Server actions enforce permissions
- [ ] Unauthorized users see appropriate error messages

### Test Cases

```typescript
// Example integration test
describe('Sidebar Navigation', () => {
  it('should navigate to agent detail page when clicked', async () => {
    const { getByText } = render(<AppSidebarClient />);

    // Wait for sidebar to load
    await waitFor(() => getByText('Agent 1'));

    // Click agent link
    fireEvent.click(getByText('Agent 1'));

    // Verify navigation
    expect(window.location.pathname).toBe('/agents/1');
  });

  it('should create new agent and navigate to it', async () => {
    const { getByText } = render(<AppSidebarClient />);

    // Click "+ Add Agent"
    fireEvent.click(getByText('Add Agent'));

    // Wait for creation
    await waitFor(() => {
      expect(window.location.pathname).toMatch(/\/agents\/\d+/);
    });

    // Verify toast shown
    expect(screen.getByText('Agent created')).toBeInTheDocument();
  });
});
```

---

## Summary of Changes

### Files Created
- ✅ `src/components/app-sidebar.tsx` - Main sidebar component
- ✅ `src/components/app-sidebar-client.tsx` - Client wrapper with data fetching

### Files Modified
- ✅ `src/components/layout/EmeryLayout.tsx` - Updated to use AppSidebarClient
- ✅ `src/app/(app)/agents/page.tsx` - Redirect pattern
- ✅ `src/app/(app)/teams/page.tsx` - Redirect pattern
- ✅ `src/app/(app)/skills/page.tsx` - Redirect pattern
- ✅ `src/app/actions/agents.ts` - Added `createDefaultAgent`
- ✅ `src/app/actions/teams.ts` - Added `createDefaultTeam`
- ✅ `src/app/actions/skills.ts` - Added `createDefaultOrganizationSkill`
- ✅ `src/app/actions/puck-apps.ts` - Already had default creation pattern

### Files Deleted
- ✅ `src/app/(app)/apps/components/AppsDashboardClient.tsx`
- ✅ `src/app/(app)/agents/components/AgentDashboardClient.tsx`
- ✅ `src/app/(app)/teams/components/TeamDashboardClient.tsx`
- ✅ `src/app/(app)/skills/components/OrganizationSkillsListView.tsx`

### Dependencies Added
- shadcn/ui sidebar components (Sidebar, SidebarContent, SidebarGroup, etc.)
- lucide-react icons (AppWindow, Bot, Users, Workflow, etc.)

---

## Conclusion

This refactor represents a significant improvement in the application's navigation and UX patterns:

1. **Simplified Navigation**: Users can access all resources directly from the sidebar
2. **Consistent Patterns**: All resource types follow the same creation and navigation flow
3. **Improved Performance**: Single data fetch with parallel loading
4. **Better Developer Experience**: Clear patterns for adding new resources
5. **Maintainability**: Eliminated redundant dashboard components
6. **Scalability**: Easy to add new resource types following established patterns

The implementation follows DDD principles with proper separation between:
- **Presentation Layer**: React components (AppSidebar, AppSidebarClient)
- **Application Layer**: Server actions orchestrating business logic
- **Domain Layer**: Application services, value objects, and entities
- **Infrastructure Layer**: Database repositories and external services

Future enhancements should focus on moving to server-side data fetching and implementing optimistic updates for an even better user experience.
