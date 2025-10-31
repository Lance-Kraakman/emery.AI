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
import { useEntityCreation } from "@/hooks/use-entity-creation"
import { useToggleSet } from "@/hooks/use-toggle-set"
import { createApp } from "@/app/actions/puck-apps"
import { createPage } from "@/app/actions/puck-pages"
import { createDefaultAgent } from "@/app/actions/agents"
import { createDefaultTeam } from "@/app/actions/teams"
import { createDefaultOrganizationSkill } from "@/app/actions/skills"
import { createDatabase } from "@/app/actions/databases"
import { createTable } from "@/app/actions/tables"
import type { AppSidebarProps, AppData, PageData } from "./app-sidebar-types"

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
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/mission-control/dashboard"}
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
          isParentActive={(_, path) => path === `/data` && !path.includes('tableId')}
          getChildren={(db) => db.tables}
          getChildKey={(table) => table.id}
          getChildName={(table) => table.name}
          getChildHref={(table) => `/data?tableId=${table.id}`}
          isChildActive={(table, _, path) => path?.includes(`tableId=${table.id}`) ?? false}
          onAddParent={handleCreateDatabase}
          onAddChild={handleCreateTable}
          addParentLabel="Add Database"
          addChildLabel="Add Table"
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
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/connections"}>
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
                    >
                      <Link href="/organization/settings/permissions">
                        <Users className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Permissions</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/settings/system"}>
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
    </Sidebar>
  )
}
