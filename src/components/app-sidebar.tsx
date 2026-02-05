"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AppWindow,
  Bot,
  ChevronRight,
  Database,
  Table2,
  Users,
  Workflow,
  Plug,
  SlidersHorizontal,
  FileText,
  CreditCard,
  ScrollText,
  LayoutTemplate,
  Globe,
  ShieldCheck,
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
import { useSession } from "next-auth/react"
import { secureSignOut } from "@/lib/auth/sign-out"
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
import { createDatabase, updateDatabase, deleteDatabase, cascadeDeleteDatabase, duplicateDatabase } from "@/app/actions/databases"
import { createTable, updateTable, deleteTable, duplicateTable } from "@/app/actions/tables"
import { applyBuiltinSkillTemplate, applyBuiltinDatabaseTemplate, applyBuiltinAgentTemplate, applyBuiltinTableTemplate } from "@/app/actions/templates"
import { toast } from "sonner"
import type { AppSidebarProps, AppData, PageData, AgentData, TeamData, SkillData, DatabaseData, TableData } from "./app-sidebar-types"
import { CascadeDeleteDialog, type ChildCounts, type ChildItem } from "@/components/dialogs/CascadeDeleteDialog"
import { TemplatePickerDialog } from "./templates/TemplatePickerDialog"
import type { TemplateEntityType } from "@/ddd/domain/templates/types"
import { useRouter } from "next/navigation"

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
  const router = useRouter()
  const { data: sessionData } = useSession()
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Track open state for nested collapsibles
  const { openSet: openApps, toggle: toggleApp } = useToggleSet<number>()
  const { openSet: openDatabases, toggle: toggleDatabase } = useToggleSet<number>()

  // Template picker state
  const [templatePicker, setTemplatePicker] = React.useState<{
    type: TemplateEntityType;
    parentId?: number;  // For tables: databaseId
  } | null>(null)

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
    childCounts?: ChildCounts
    childItems?: ChildItem[]
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
    const pageCount = app.pages?.length ?? 0
    setDeletingItem({
      type: 'app',
      id: app.id,
      name: app.name,
      childCounts: pageCount > 0 ? { pages: pageCount } : undefined,
      childItems: pageCount > 0 ? app.pages!.map(p => ({ type: 'page' as const, name: p.name, id: p.id })) : undefined
    })
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
    // Count skills assigned to this agent
    const agentSkills = skills.filter(s => s.agentId === agent.id)
    // Count databases assigned to this agent
    const agentDatabases = databases.filter(d => {
      // Note: DatabaseData doesn't have agentId in sidebar types, so we can't count them here
      // This would need to be enhanced in the data passed to sidebar
      return false
    })
    const skillCount = agentSkills.length
    const hasChildren = skillCount > 0

    setDeletingItem({
      type: 'agent',
      id: agent.id,
      name: agent.name,
      childCounts: hasChildren ? { skills: skillCount } : undefined,
      childItems: hasChildren ? agentSkills.map(s => ({ type: 'skill' as const, name: s.name, id: s.id })) : undefined
    })
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
    const tableCount = database.tables?.length ?? 0
    setDeletingItem({
      type: 'database',
      id: database.id,
      name: database.name,
      childCounts: tableCount > 0 ? { tables: tableCount } : undefined,
      childItems: tableCount > 0 ? database.tables.map(t => ({ type: 'table' as const, name: t.name, id: t.id })) : undefined
    })
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

  // Template handlers
  const handleCreateAgentFromTemplate = () => {
    setTemplatePicker({ type: 'agent' })
  }

  const handleCreateSkillFromTemplate = () => {
    setTemplatePicker({ type: 'skill' })
  }

  const handleCreateDatabaseFromTemplate = () => {
    setTemplatePicker({ type: 'database' })
  }

  const handleCreateTableFromTemplate = (databaseId: number) => {
    setTemplatePicker({ type: 'table', parentId: databaseId })
  }

  const handleSelectBuiltinTemplate = async (templateId: string) => {
    if (!templatePicker) return
    switch (templatePicker.type) {
      case 'skill': {
        const result = await applyBuiltinSkillTemplate(templateId)
        if (result.success && result.data) {
          toast.success(`Created "${result.data.skillName}" skill`)
        } else {
          toast.error(result.error || 'Failed to create skill')
        }
        break
      }
      case 'agent': {
        const result = await applyBuiltinAgentTemplate(templateId)
        if (result.success && result.data) {
          toast.success(`Created "${result.data.name}" agent`)
        } else {
          toast.error(result.error || 'Failed to create agent')
        }
        break
      }
      case 'database': {
        const result = await applyBuiltinDatabaseTemplate(templateId)
        if (result.success && result.data) {
          toast.success(`Created "${result.data.name}" database`)
        } else {
          toast.error(result.error || 'Failed to create database')
        }
        break
      }
      case 'table': {
        if (!templatePicker.parentId) {
          toast.error('No database selected')
          break
        }
        const result = await applyBuiltinTableTemplate(templateId, templatePicker.parentId)
        if (result.success && result.data) {
          toast.success(`Created "${result.data.name}" table`)
        } else {
          toast.error(result.error || 'Failed to create table')
        }
        break
      }
    }
    setTemplatePicker(null)
  }

  const handleSelectSavedTemplate = async (templateId: number) => {
    if (!templatePicker) return
    // Navigate to the appropriate creation page with template param
    switch (templatePicker.type) {
      case 'skill':
        router.push(`/skills/new?templateId=${templateId}`)
        break
      case 'agent':
        router.push(`/organization?templatePicker=agent&templateId=${templateId}`)
        break
      case 'database':
        router.push(`/organization?templatePicker=database&templateId=${templateId}`)
        break
      case 'table':
        router.push(`/data?templatePicker=table&databaseId=${templatePicker.parentId}&templateId=${templateId}`)
        break
    }
    setTemplatePicker(null)
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
        // Use cascade delete if database has tables
        if (deletingItem.childCounts?.tables && deletingItem.childCounts.tables > 0) {
          result = await cascadeDeleteDatabase(deletingItem.id)
        } else {
          result = await deleteDatabase(deletingItem.id)
        }
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
      <SidebarHeader className="border-b px-2 py-2">
        <div className="flex items-center justify-between">
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8"
            >
              <img src="/assets/enhancd/logo2.svg" alt="enhancd.ai" className="h-8 w-8" />
            </Button>
          ) : (
            <EmeryOrganizationModal isCollapsed={isCollapsed} />
          )}
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      {/* Organization - fixed at top, not scrollable */}
      <div className="flex-shrink-0 border-b border-sidebar-border">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/organization" || pathname?.startsWith("/organization")}
              >
                <Link href="/organization">
                  <Users className="h-4 w-4" />
                  <span>Organization</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </div>

      <SidebarContent>
        {/* Apps */}
        <NestedSidebarSection<AppData, PageData>
          icon={AppWindow}
          childIcon={FileText}
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
          isParentActive={(app, path) => path?.startsWith(`/apps/${app.id}`) ?? false}
          getChildren={(app) => app.pages}
          getChildKey={(page) => page.id}
          getChildName={(page) => page.name}
          getChildHref={(page, app) => `/apps/${app.id}/pages/${page.id}/edit`}
          isChildActive={(page, app, path) => {
            const pattern = new RegExp(`/apps/${app.id}/pages/${page.id}(/|$)`)
            return pattern.test(path ?? '')
          }}
          onAddParent={handleCreateApp}
          onAddChild={handleCreatePage}
          addParentLabel="Add App"
          addChildLabel="Add Page"
          parentResourceType="app"
          childResourceType="page"
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
          onAddFromTemplate={handleCreateAgentFromTemplate}
          addButtonLabel="Add Agent"
          onRename={handleRenameAgent}
          onDuplicate={handleDuplicateAgent}
          onShare={handleShareAgent}
          onDelete={handleDeleteAgent}
        />

        {/* Teams - Coming Soon
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
        */}

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
          isItemActive={(skill, path) => {
            if (skill.agentId) {
              const pattern = new RegExp(`/agents/${skill.agentId}/skills/${skill.id}(/|$)`)
              return pattern.test(path ?? '')
            }
            return path?.startsWith(`/skills/${skill.id}`) ?? false
          }}
          getGroupKey={(skill) => skill.agentId}
          getGroupName={(skill) => skill.agentName}
          isUngroupedItem={(skill) => skill.agentId === null}
          onAdd={handleCreateSkill}
          addButtonLabel="Add Skill"
          onAddFromTemplate={handleCreateSkillFromTemplate}
          onRename={handleRenameSkill}
          onDuplicate={handleDuplicateSkill}
          onShare={handleShareSkill}
          onDelete={handleDeleteSkill}
        />

        {/* Data - Databases with nested tables */}
        <NestedSidebarSection
          icon={Database}
          childIcon={Table2}
          label="Data"
          parents={databases}
          pathname={pathname}
          isCreating={isCreating}
          defaultOpen={pathname?.startsWith("/data")}
          openSet={openDatabases}
          onToggle={toggleDatabase}
          getParentId={(db) => db.id}
          getParentName={(db) => db.name}
          getParentHref={(db) => db.tables?.[0] ? `/data/${db.tables[0].id}` : `/data`}
          isParentActive={(db, path) => {
            // Database is active if any of its tables are selected
            const tables = db.tables || []
            return tables.some(table => {
              const pattern = new RegExp(`/data/${table.id}(/|$)`)
              return pattern.test(path ?? '')
            })
          }}
          getChildren={(db) => db.tables}
          getChildKey={(table) => table.id}
          getChildName={(table) => table.name}
          getChildHref={(table) => `/data/${table.id}`}
          isChildActive={(table, _, path) => {
            const pattern = new RegExp(`/data/${table.id}(/|$)`)
            return pattern.test(path ?? '')
          }}
          onAddParent={handleCreateDatabase}
          onAddChild={handleCreateTable}
          addParentLabel="Add Database"
          addChildLabel="Add Table"
          onAddParentFromTemplate={handleCreateDatabaseFromTemplate}
          onAddChildFromTemplate={handleCreateTableFromTemplate}
          parentResourceType="database"
          childResourceType="table"
          onRenameParent={handleRenameDatabase}
          onDuplicateParent={handleDuplicateDatabase}
          onShareParent={handleShareDatabase}
          onDeleteParent={handleDeleteDatabase}
          onRenameChild={handleRenameTable}
          onDuplicateChild={handleDuplicateTable}
          onShareChild={handleShareTable}
          onDeleteChild={handleDeleteTable}
        />

      </SidebarContent>

      {/* Settings - fixed at bottom, expands upward */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        <Collapsible defaultOpen={pathname?.startsWith("/connections") || pathname?.startsWith("/organization/settings") || pathname?.startsWith("/settings") || pathname?.startsWith("/templates")} className="group/settings">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <span className="shrink-0 flex items-center">
                  <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/settings:rotate-90" />
                </span>
                <span className="group-data-[collapsible=icon]:hidden">Settings</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupContent>
                <div className="max-h-[40vh] overflow-y-auto">
                  <SidebarMenu className="gap-0 ml-1 border-l border-sidebar-border pl-2">
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/templates"} size="sm">
                        <Link href="/templates">
                          <LayoutTemplate className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">Templates</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/connections"} size="sm">
                        <Link href="/connections">
                          <Plug className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">Connections</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/organization/settings/permissions"}
                        size="sm"
                      >
                        <Link href="/organization/settings/permissions">
                          <Users className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">Permissions</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/organization/settings/security"}
                        size="sm"
                      >
                        <Link href="/organization/settings/security">
                          <ShieldCheck className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">Security</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/organization/settings/audit-log"}
                        size="sm"
                      >
                        <Link href="/organization/settings/audit-log">
                          <ScrollText className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">Audit Log</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === "/organization/settings/published-agents"}
                        size="sm"
                      >
                        <Link href="/organization/settings/published-agents">
                          <Globe className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">Published Agents</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/settings/billing"} size="sm">
                        <Link href="/settings/billing">
                          <CreditCard className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">Billing</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/settings/system"} size="sm">
                        <Link href="/settings/system">
                          <SlidersHorizontal className="h-4 w-4" />
                          <span className="group-data-[collapsible=icon]:hidden">System</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </div>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </div>

      <SidebarFooter className="border-t px-2 py-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 px-1.5 py-1 h-auto group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={sessionData?.user?.image || undefined}
                  alt={sessionData?.user?.name || "User"}
                />
                <AvatarFallback className="text-[10px]">
                  {sessionData?.user?.name?.charAt(0).toUpperCase() ||
                    sessionData?.user?.email?.charAt(0).toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium truncate group-data-[collapsible=icon]:hidden">
                {sessionData?.user?.name || "User"}
              </span>
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
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium">
                    {sessionData?.user?.name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {sessionData?.user?.email}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                onClick={() => secureSignOut("/auth/signin")}
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
      {deletingItem && (
        <CascadeDeleteDialog
          isOpen={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
          entityType={deletingItem.type}
          entityName={deletingItem.name}
          childCounts={deletingItem.childCounts}
          childItems={deletingItem.childItems}
        />
      )}

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

      {/* Template Picker Dialog */}
      <TemplatePickerDialog
        isOpen={!!templatePicker}
        onClose={() => setTemplatePicker(null)}
        entityType={templatePicker?.type ?? 'skill'}
        onSelectBuiltin={handleSelectBuiltinTemplate}
        onSelectSaved={handleSelectSavedTemplate}
      />
    </Sidebar>
  )
}
