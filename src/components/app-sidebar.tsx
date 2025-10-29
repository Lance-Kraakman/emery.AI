"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  AppWindow,
  Bot,
  Building2,
  Database,
  Plus,
  Settings,
  Target,
  Users,
  Workflow,
  Plug,
  SlidersHorizontal,
  FileText,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LogOut } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { EmeryOrganizationModal } from "./EmeryOrganizationModal"
import { createApp } from "@/app/actions/puck-apps"
import { createPage } from "@/app/actions/puck-pages"
import { createDefaultAgent } from "@/app/actions/agents"
import { createDefaultTeam } from "@/app/actions/teams"
import { createDefaultOrganizationSkill } from "@/app/actions/skills"
import { createDatabase } from "@/app/actions/databases"
import { createTable } from "@/app/actions/tables"
import { toast } from "sonner"

// AIDEV-NOTE: New sidebar using shadcn/ui sidebar component
// Replaces EmerySidebar with modern collapsible structure
// Items are dynamically loaded from server actions

interface AppData {
  id: number
  name: string
  slug: string
  pages?: PageData[]
}

interface PageData {
  id: number
  name: string
  slug: string
  appId: number
}

interface AgentData {
  id: number
  name: string
}

interface TeamData {
  id: number
  name: string
}

interface SkillData {
  id: number
  name: string
}

interface DatabaseData {
  id: number
  name: string
  tables: TableData[]
}

interface TableData {
  id: number
  name: string
}

interface AppSidebarProps {
  apps: AppData[]
  agents: AgentData[]
  teams: TeamData[]
  skills: SkillData[]
  databases: DatabaseData[]
}

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

  const [isCreating, setIsCreating] = React.useState(false)

  const handleCreateApp = async () => {
    setIsCreating(true)
    try {
      const result = await createApp()
      if (result.success && result.data) {
        toast.success("App created")
        router.push(`/apps/${result.data.id}`)
      } else {
        toast.error(result.error || "Failed to create app")
      }
    } catch (error) {
      toast.error("Failed to create app")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreatePage = async (appId: number) => {
    setIsCreating(true)
    try {
      const result = await createPage({ appId })
      if (result.success && result.data) {
        toast.success("Page created")
        router.push(`/apps/${appId}`) // Navigate to app page to see new page
        router.refresh()
      } else {
        toast.error(result.error || "Failed to create page")
      }
    } catch (error) {
      toast.error("Failed to create page")
    } finally {
      setIsCreating(false)
    }
  }

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

  const handleCreateTeam = async () => {
    setIsCreating(true)
    try {
      const result = await createDefaultTeam()
      if (result.success && result.data) {
        toast.success("Team created")
        router.push(`/teams/${result.data.id}`)
      } else {
        toast.error(result.error || "Failed to create team")
      }
    } catch (error) {
      toast.error("Failed to create team")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateSkill = async () => {
    setIsCreating(true)
    try {
      const result = await createDefaultOrganizationSkill()
      if (result.success && result.data) {
        toast.success("Skill created")
        router.push(`/skills/${result.data.id}`)
      } else {
        toast.error(result.error || "Failed to create skill")
      }
    } catch (error) {
      toast.error("Failed to create skill")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateDatabase = async () => {
    setIsCreating(true)
    try {
      const result = await createDatabase({ name: "Untitled Database" })
      if (result.success && result.data) {
        toast.success("Database created")
        router.push(`/data`)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to create database")
      }
    } catch (error) {
      toast.error("Failed to create database")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateTable = async (databaseId: number) => {
    setIsCreating(true)
    try {
      const result = await createTable({ name: "Untitled Table", databaseId })
      if (result.success && result.data) {
        toast.success("Table created")
        router.push(`/data`)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to create table")
      }
    } catch (error) {
      toast.error("Failed to create table")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <EmeryOrganizationModal />
      </SidebarHeader>

      <SidebarContent>
        {/* Mission Control */}
        <Collapsible defaultOpen={pathname?.startsWith("/mission-control")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Target className="h-4 w-4" />
                <span>Mission Control</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/mission-control/dashboard"}
                    >
                      <a href="/mission-control/dashboard">Dashboard</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/mission-control/org-chart"}
                    >
                      <a href="/mission-control/org-chart">
                        <Building2 className="h-4 w-4" />
                        <span>Org Chart</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Apps */}
        <Collapsible defaultOpen={pathname?.startsWith("/apps")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <AppWindow className="h-4 w-4" />
                <span>Apps</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {apps.map((app) => (
                    <Collapsible key={app.id}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === `/apps/${app.id}`}
                          >
                            <a href={`/apps/${app.id}`}>{app.name}</a>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {app.pages && app.pages.length > 0 && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {app.pages.map((page) => (
                                <SidebarMenuSubItem key={page.id}>
                                  <SidebarMenuSubButton asChild>
                                    <a href={`/puck-demo${app.slug}${page.slug}`}>
                                      <FileText className="h-3 w-3" />
                                      <span>{page.name}</span>
                                    </a>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                              <SidebarMenuSubItem>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start h-8"
                                  onClick={() => handleCreatePage(app.id)}
                                  disabled={isCreating}
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Add Page</span>
                                </Button>
                              </SidebarMenuSubItem>
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  ))}
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleCreateApp}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add App</span>
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Agents */}
        <Collapsible defaultOpen={pathname?.startsWith("/agents")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Bot className="h-4 w-4" />
                <span>Agents</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {agents.map((agent) => (
                    <SidebarMenuItem key={agent.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname?.startsWith(`/agents/${agent.id}`)}
                      >
                        <a href={`/agents/${agent.id}`}>{agent.name}</a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleCreateAgent}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Agent</span>
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Teams */}
        <Collapsible defaultOpen={pathname?.startsWith("/teams")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Users className="h-4 w-4" />
                <span>Teams</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {teams.map((team) => (
                    <SidebarMenuItem key={team.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname?.startsWith(`/teams/${team.id}`)}
                      >
                        <a href={`/teams/${team.id}`}>{team.name}</a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleCreateTeam}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Team</span>
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Skills */}
        <Collapsible defaultOpen={pathname?.startsWith("/skills")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Workflow className="h-4 w-4" />
                <span>Skills</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {skills.map((skill) => (
                    <SidebarMenuItem key={skill.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname?.startsWith(`/skills/${skill.id}`)}
                      >
                        <a href={`/skills/${skill.id}`}>{skill.name}</a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleCreateSkill}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Skill</span>
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Data - Databases with nested tables */}
        <Collapsible defaultOpen={pathname?.startsWith("/data")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Database className="h-4 w-4" />
                <span>Data</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {databases.map((database) => (
                    <Collapsible key={database.id}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === `/data`}
                          >
                            <a href={`/data`}>{database.name}</a>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {database.tables && database.tables.length > 0 && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {database.tables.map((table) => (
                                <SidebarMenuSubItem key={table.id}>
                                  <SidebarMenuSubButton asChild>
                                    <a href={`/data`}>
                                      <FileText className="h-3 w-3" />
                                      <span>{table.name}</span>
                                    </a>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                              <SidebarMenuSubItem>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start h-8"
                                  onClick={() => handleCreateTable(database.id)}
                                  disabled={isCreating}
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Add Table</span>
                                </Button>
                              </SidebarMenuSubItem>
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  ))}
                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleCreateDatabase}
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Database</span>
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Settings */}
        <Collapsible defaultOpen={pathname?.startsWith("/connections") || pathname?.startsWith("/organization/settings") || pathname?.startsWith("/settings")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/connections"}>
                      <a href="/connections">
                        <Plug className="h-4 w-4" />
                        <span>OAuth Connections</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/organization/settings/permissions"}
                    >
                      <a href="/organization/settings/permissions">
                        <Users className="h-4 w-4" />
                        <span>Permissions</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/settings/system"}>
                      <a href="/settings/system">
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>System</span>
                      </a>
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
            <Button variant="ghost" className="w-full justify-start gap-4 p-2">
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
              <div className="flex flex-col items-start text-left">
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
    </Sidebar>
  )
}
