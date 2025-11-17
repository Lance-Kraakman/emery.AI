"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AppWindow,
  Bot,
  Building2,
  Database,
  LayoutDashboard,
  Settings,
  Target,
  Users,
  Workflow,
  Plug,
  SlidersHorizontal,
  Activity,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LogOut } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { EmeryOrganizationModal } from "./EmeryOrganizationModal"
import { SidebarSection } from "./sidebar-section"
import { NestedSidebarSection } from "./nested-sidebar-section"
import { GroupedSidebarSection } from "./grouped-sidebar-section"
import { ShareDialog } from "./permissions/ShareDialog"
import { useEntityCreation } from "@/hooks/use-entity-creation"
import { useToggleSet } from "@/hooks/use-toggle-set"
import { createApp, updateApp, deleteApp, duplicateApp } from "@/app/actions/puck-apps"
import { createPage, updatePage, deletePage, duplicatePage } from "@/app/actions/puck-pages"
import { createDefaultAgent, updateAgent, deleteAgent, duplicateAgent } from "@/app/actions/agents"
import { createDefaultTeam, updateTeam, deleteTeam, duplicateTeam } from "@/app/actions/teams"
import { createDefaultOrganizationSkill, updateSkill, deleteSkill, duplicateSkill } from "@/app/actions/skills"
import { createDatabase, updateDatabase, deleteDatabase, duplicateDatabase } from "@/app/actions/databases"
import { createTable, updateTable, deleteTable, duplicateTable } from "@/app/actions/tables"
import type { AppSidebarProps, AppData, PageData, AgentData, TeamData, SkillData, DatabaseData, TableData } from "./app-sidebar-types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// AIDEV-NOTE: Refactored sidebar using reusable components
// SidebarSection handles simple list sections (Agents, Teams, Skills)
// NestedSidebarSection handles parent-child relationships (Apps/Pages, Databases/Tables)

export function AppSidebar({
  apps,
  agents,
  teams,
  skills,
  databases,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { data: sessionData } = useSession()
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Track open state for nested collapsibles
  const { openSet: openApps, toggle: toggleApp } = useToggleSet<number>()
  const { openSet: openDatabases, toggle: toggleDatabase } = useToggleSet<number>()

  // Entity creation handlers using the reusable hook
  const { handleCreate: handleCreateApp, isCreating: isCreatingApp } = useEntityCreation(
    createApp,
    {
      successMessage: "App created",
      errorMessage: "Failed to create app",
      navigateTo: undefined, // Will be set dynamically based on result
    }
  )

  const { handleCreate: handleCreateAgent, isCreating: isCreatingAgent } = useEntityCreation(
    createDefaultAgent,
    {
      successMessage: "Agent created",
      errorMessage: "Failed to create agent",
      navigateTo: undefined,
    }
  )

  const { handleCreate: handleCreateTeam, isCreating: isCreatingTeam } = useEntityCreation(
    createDefaultTeam,
    {
      successMessage: "Team created",
      errorMessage: "Failed to create team",
      navigateTo: undefined,
    }
  )

  const { handleCreate: handleCreateSkill, isCreating: isCreatingSkill } = useEntityCreation(
    createDefaultOrganizationSkill,
    {
      successMessage: "Skill created",
      errorMessage: "Failed to create skill",
      navigateTo: undefined,
    }
  )

  const { handleCreate: handleCreateDatabase, isCreating: isCreatingDatabase } = useEntityCreation(
    () => createDatabase({ name: "Untitled Database" }),
    {
      successMessage: "Database created",
      errorMessage: "Failed to create database",
      navigateTo: "/data",
      shouldRefresh: true,
    }
  )

  // Helper for creating pages and tables (requires parent ID)
  const handleCreatePage = async (appId: number) => {
    const result = await createPage({ appId })
    // Navigation handled inline for now - could be refactored further
  }

  const handleCreateTable = async (databaseId: number) => {
    const result = await createTable({ name: "Untitled Table", databaseId })
    // Navigation handled inline for now
  }

  const isCreating = isCreatingApp || isCreatingAgent || isCreatingTeam || isCreatingSkill || isCreatingDatabase

  // Delete confirmation state
  const [deletingItem, setDeletingItem] = React.useState<{
    type: 'app' | 'page' | 'agent' | 'team' | 'skill' | 'database' | 'table'
    id: number
    name: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)
  const [sharingItem, setSharingItem] = React.useState<{
    type: 'app' | 'page' | 'agent' | 'team' | 'skill' | 'database' | 'table'
    id: number
    name: string
  } | null>(null)

  // Action handlers for Apps
  const handleRenameApp = async (app: AppData, newName: string) => {
    await updateApp({ id: app.id, name: newName })
  }

  const handleDuplicateApp = async (app: AppData) => {
    await duplicateApp(app.id)
  }

  const handleShareApp = (app: AppData) => {
    setSharingItem({ type: 'app', id: app.id, name: app.name })
    setShareDialogOpen(true)
  }

  const handleDeleteApp = (app: AppData) => {
    setDeletingItem({ type: 'app', id: app.id, name: app.name })
  }

  // Action handlers for Pages
  const handleRenamePage = async (page: PageData, app: AppData, newName: string) => {
    await updatePage({ id: page.id, name: newName })
  }

  const handleDuplicatePage = async (page: PageData, app: AppData) => {
    await duplicatePage(page.id)
  }

  const handleSharePage = (page: PageData, app: AppData) => {
    setSharingItem({ type: 'page', id: page.id, name: page.name })
    setShareDialogOpen(true)
  }

  const handleDeletePage = (page: PageData, app: AppData) => {
    setDeletingItem({ type: 'page', id: page.id, name: page.name })
  }

  // Action handlers for Agents
  const handleRenameAgent = async (agent: AgentData, newName: string) => {
    await updateAgent(agent.id, { name: newName })
  }

  const handleDuplicateAgent = async (agent: AgentData) => {
    await duplicateAgent(agent.id)
  }

  const handleShareAgent = (agent: AgentData) => {
    setSharingItem({ type: 'agent', id: agent.id, name: agent.name })
    setShareDialogOpen(true)
  }

  const handleDeleteAgent = (agent: AgentData) => {
    setDeletingItem({ type: 'agent', id: agent.id, name: agent.name })
  }

  // Action handlers for Teams
  const handleRenameTeam = async (team: TeamData, newName: string) => {
    await updateTeam(team.id, { name: newName })
  }

  const handleDuplicateTeam = async (team: TeamData) => {
    await duplicateTeam(team.id)
  }

  const handleShareTeam = (team: TeamData) => {
    setSharingItem({ type: 'team', id: team.id, name: team.name })
    setShareDialogOpen(true)
  }

  const handleDeleteTeam = (team: TeamData) => {
    setDeletingItem({ type: 'team', id: team.id, name: team.name })
  }

  // Action handlers for Skills
  const handleRenameSkill = async (skill: SkillData, newName: string) => {
    await updateSkill(skill.id, { name: newName })
  }

  const handleDuplicateSkill = async (skill: SkillData) => {
    await duplicateSkill(skill.id)
  }

  const handleShareSkill = (skill: SkillData) => {
    setSharingItem({ type: 'skill', id: skill.id, name: skill.name })
    setShareDialogOpen(true)
  }

  const handleDeleteSkill = (skill: SkillData) => {
    setDeletingItem({ type: 'skill', id: skill.id, name: skill.name })
  }

  // Action handlers for Databases
  const handleRenameDatabase = async (database: DatabaseData, newName: string) => {
    await updateDatabase({ id: database.id, name: newName })
  }

  const handleDuplicateDatabase = async (database: DatabaseData) => {
    await duplicateDatabase(database.id)
  }

  const handleShareDatabase = (database: DatabaseData) => {
    setSharingItem({ type: 'database', id: database.id, name: database.name })
    setShareDialogOpen(true)
  }

  const handleDeleteDatabase = (database: DatabaseData) => {
    setDeletingItem({ type: 'database', id: database.id, name: database.name })
  }

  // Action handlers for Tables
  const handleRenameTable = async (table: TableData, database: DatabaseData, newName: string) => {
    await updateTable(table.id, { name: newName })
  }

  const handleDuplicateTable = async (table: TableData, database: DatabaseData) => {
    await duplicateTable(table.id)
  }

  const handleShareTable = (table: TableData, database: DatabaseData) => {
    setSharingItem({ type: 'table', id: table.id, name: table.name })
    setShareDialogOpen(true)
  }

  const handleDeleteTable = (table: TableData, database: DatabaseData) => {
    setDeletingItem({ type: 'table', id: table.id, name: table.name })
  }

  // Unified delete confirmation handler
  const confirmDelete = async () => {
    if (!deletingItem) return

    setIsDeleting(true)
    let result

    switch (deletingItem.type) {
      case 'app':
        result = await deleteApp(deletingItem.id)
        break
      case 'page':
        result = await deletePage(deletingItem.id)
        break
      case 'agent':
        result = await deleteAgent(deletingItem.id)
        break
      case 'team':
        result = await deleteTeam(deletingItem.id)
        break
      case 'skill':
        result = await deleteSkill(deletingItem.id)
        break
      case 'database':
        result = await deleteDatabase(deletingItem.id)
        break
      case 'table':
        result = await deleteTable(deletingItem.id)
        break
    }

    setIsDeleting(false)

    if (result?.success) {
      setDeletingItem(null)
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-12 w-12"
            >
              <img src="/assets/dashlet/logo_icon.svg" alt="Dashlet" className="h-6 w-6" />
            </Button>
          ) : (
            <EmeryOrganizationModal isCollapsed={isCollapsed} />
          )}
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Mission Control */}
        <Collapsible defaultOpen={pathname?.startsWith("/mission-control")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Target className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Mission Control</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/mission-control/dashboard"}
                      className="h-6"
                    >
                      <Link href="/mission-control/dashboard">
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/mission-control/org-chart"}
                      className="h-6"
                    >
                      <Link href="/mission-control/org-chart">
                        <Building2 className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Org Chart</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Apps */}
        <NestedSidebarSection<AppData, PageData>
          icon={AppWindow}
          label="Apps"
          parents={apps}
          pathname={pathname}
          isCreating={isCreating}
          defaultOpen={pathname?.startsWith("/apps")}
          openSet={openApps}
          onToggle={toggleApp}
          getParentId={(app) => app.id}
          getParentName={(app) => app.name}
          getParentHref={(app) => `/apps/${app.id}`}
          isParentActive={(app, path) => path === `/apps/${app.id}`}
          getChildren={(app) => app.pages}
          getChildKey={(page) => page.id}
          getChildName={(page) => page.name}
          getChildHref={(page, app) => `/apps/${app.id}/pages/${page.id}/edit`}
          isChildActive={(page, app, path) => path?.includes(`/apps/${app.id}/pages/${page.id}`) ?? false}
          onAddParent={handleCreateApp}
          onAddChild={handleCreatePage}
          addParentLabel="Add App"
          addChildLabel="Add Page"
          onRenameParent={handleRenameApp}
          onDuplicateParent={handleDuplicateApp}
          onShareParent={handleShareApp}
          onDeleteParent={handleDeleteApp}
          onRenameChild={handleRenamePage}
          onDuplicateChild={handleDuplicatePage}
          onShareChild={handleSharePage}
          onDeleteChild={handleDeletePage}
        />

        {/* Agents */}
        <SidebarSection
          icon={Bot}
          label="Agents"
          items={agents}
          pathname={pathname}
          isCreating={isCreating}
          defaultOpen={pathname?.startsWith("/agents")}
          getItemHref={(agent) => `/agents/${agent.id}`}
          getItemName={(agent) => agent.name}
          getItemKey={(agent) => agent.id}
          isItemActive={(agent, path) => path?.startsWith(`/agents/${agent.id}`) ?? false}
          onAdd={handleCreateAgent}
          addButtonLabel="Add Agent"
          onRename={handleRenameAgent}
          onDuplicate={handleDuplicateAgent}
          onShare={handleShareAgent}
          onDelete={handleDeleteAgent}
        />

        {/* Teams */}
        <SidebarSection
          icon={Users}
          label="Teams"
          items={teams}
          pathname={pathname}
          isCreating={isCreating}
          defaultOpen={pathname?.startsWith("/teams")}
          getItemHref={(team) => `/teams/${team.id}`}
          getItemName={(team) => team.name}
          getItemKey={(team) => team.id}
          isItemActive={(team, path) => path?.startsWith(`/teams/${team.id}`) ?? false}
          onAdd={handleCreateTeam}
          addButtonLabel="Add Team"
          onRename={handleRenameTeam}
          onDuplicate={handleDuplicateTeam}
          onShare={handleShareTeam}
          onDelete={handleDeleteTeam}
        />

        {/* Skills - Grouped by Organization and Agents */}
        <GroupedSidebarSection
          icon={Workflow}
          label="Skills"
          items={skills}
          pathname={pathname}
          isCreating={isCreating}
          defaultOpen={pathname?.startsWith("/skills") || pathname?.includes("/skills/")}
          getItemId={(skill) => skill.id}
          getItemName={(skill) => skill.name}
          getItemHref={(skill) =>
            skill.agentId
              ? `/agents/${skill.agentId}/skills/${skill.id}`
              : `/skills/${skill.id}`
          }
          isItemActive={(skill, path) =>
            skill.agentId
              ? path?.includes(`/agents/${skill.agentId}/skills/${skill.id}`) ?? false
              : path?.startsWith(`/skills/${skill.id}`) ?? false
          }
          getGroupKey={(skill) => skill.agentId}
          getGroupName={(skill) => skill.agentName}
          isUngroupedItem={(skill) => skill.agentId === null}
          onAdd={handleCreateSkill}
          addButtonLabel="Add Skill"
          onRename={handleRenameSkill}
          onDuplicate={handleDuplicateSkill}
          onShare={handleShareSkill}
          onDelete={handleDeleteSkill}
        />

        {/* Data - Databases with nested tables */}
        <NestedSidebarSection
          icon={Database}
          label="Data"
          parents={databases}
          pathname={pathname}
          isCreating={isCreating}
          defaultOpen={pathname?.startsWith("/data")}
          openSet={openDatabases}
          onToggle={toggleDatabase}
          getParentId={(db) => db.id}
          getParentName={(db) => db.name}
          getParentHref={() => `/data`}
          isParentActive={(db, path) => {
            // Database is active if any of its tables are selected
            const tables = db.tables || []
            return tables.some(table => path?.includes(`/data/${table.id}`))
          }}
          getChildren={(db) => db.tables}
          getChildKey={(table) => table.id}
          getChildName={(table) => table.name}
          getChildHref={(table) => `/data/${table.id}`}
          isChildActive={(table, _, path) => path?.includes(`/data/${table.id}`) ?? false}
          onAddParent={handleCreateDatabase}
          onAddChild={handleCreateTable}
          addParentLabel="Add Database"
          addChildLabel="Add Table"
          onRenameParent={handleRenameDatabase}
          onDuplicateParent={handleDuplicateDatabase}
          onShareParent={handleShareDatabase}
          onDeleteParent={handleDeleteDatabase}
          onRenameChild={handleRenameTable}
          onDuplicateChild={handleDuplicateTable}
          onShareChild={handleShareTable}
          onDeleteChild={handleDeleteTable}
        />

        {/* Settings */}
        <Collapsible defaultOpen={pathname?.startsWith("/connections") || pathname?.startsWith("/organization/settings") || pathname?.startsWith("/settings")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Settings className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Settings</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/connections"} className="h-6">
                      <Link href="/connections">
                        <Plug className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">OAuth Connections</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/organization/settings/permissions"}
                      className="h-6"
                    >
                      <Link href="/organization/settings/permissions">
                        <Users className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Permissions</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/settings/usage"} className="h-6">
                      <Link href="/settings/usage">
                        <Activity className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Usage & Billing</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/settings/system"} className="h-6">
                      <Link href="/settings/system">
                        <SlidersHorizontal className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">System</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-4 p-2 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={sessionData?.user?.image || undefined}
                  alt={sessionData?.user?.name || "User"}
                />
                <AvatarFallback className="text-xs">
                  {sessionData?.user?.name?.charAt(0).toUpperCase() ||
                    sessionData?.user?.email?.charAt(0).toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left group-data-[collapsible=icon]:hidden">
                <span className="text-base font-semibold text-foreground">
                  {sessionData?.user?.name || "User"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {sessionData?.user?.email}
                </span>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" side="top" align="end">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={sessionData?.user?.image || undefined}
                    alt={sessionData?.user?.name || "User"}
                  />
                  <AvatarFallback>
                    {sessionData?.user?.name?.charAt(0).toUpperCase() ||
                      sessionData?.user?.email?.charAt(0).toUpperCase() ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {sessionData?.user?.name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {sessionData?.user?.email}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
      <SidebarRail />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deletingItem?.type === 'app' && 'the app'}
              {deletingItem?.type === 'page' && 'the page'}
              {deletingItem?.type === 'agent' && 'the agent'}
              {deletingItem?.type === 'team' && 'the team'}
              {deletingItem?.type === 'skill' && 'the skill'}
              {deletingItem?.type === 'database' && 'the database'}
              {deletingItem?.type === 'table' && 'the table'} "{deletingItem?.name}"
              {(deletingItem?.type === 'app' || deletingItem?.type === 'database') && ' and all its contents'}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      {sharingItem && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={(open) => {
            setShareDialogOpen(open)
            if (!open) setSharingItem(null)
          }}
          resourceType={sharingItem.type}
          resourceId={sharingItem.id}
          resourceName={sharingItem.name}
        />
      )}
    </Sidebar>
  )
}
