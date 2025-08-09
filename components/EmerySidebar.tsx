"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Settings,
  Bot,
  Database,
  PanelLeft,
  Building2,
  ChevronDown,
  TableIcon as Table,
  Users,
  Target,
  Workflow,
  Plug,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmeryOrganizationModal } from "./EmeryOrganizationModal"
import { useEmeryData } from "@/hooks/useEmeryData"

const navItems = [
  { href: "/dashboard", label: "Mission Control", icon: Target },
  { href: "/dashboard/manage", label: "Orchestration", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
]

const orchestrationNavItems = [
  { href: "/dashboard/manage?tab=organization", label: "Organization", icon: Building2 },
  { href: "/dashboard/manage?tab=teams", label: "Teams", icon: Users },
  { href: "/dashboard/manage?tab=agents", label: "Agents", icon: Bot },
]

const settingsNavItems = [
  {
    label: "OAuth Connections",
    href: "/dashboard/connections", 
    icon: Plug,
  },
  {
    label: "Users & Permissions",
    href: "/settings/users-and-permissions", 
    icon: Users,
  },
]

export function EmerySidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data, isLoading } = useEmeryData()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [openCollapsibles, setOpenCollapsibles] = useState<string[]>(
    pathname === "/dashboard" ? ["Data", ...data.databases.map(db => db.id)] : []
  )

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const toggleCollapsible = (id: string) => {
    setOpenCollapsibles(prev => {
      const isOpen = prev.includes(id)
      if (id === "Data") {
        const dbIds = data.databases.map(db => db.id)
        return isOpen
          ? prev.filter(item => item !== id && !dbIds.includes(item))
          : [...prev, id, ...dbIds]
      }
      return isOpen ? prev.filter(item => item !== id) : [...prev, id]
    })
  }

  return (
    <div
      className={`relative min-h-screen border-r bg-card transition-all duration-300 ease-in-out shadow-lg ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-16 items-center px-4">
          {!isCollapsed && <EmeryOrganizationModal />}
          {isCollapsed && (
            <div className="flex-1 flex justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            className={`h-8 w-8 ${!isCollapsed ? 'ml-auto' : ''}`}
            onClick={toggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 py-2">
          <nav className="grid items-start px-4 text-sm font-medium">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              
              const renderSeparator = () => {
                if (label === "Orchestration" || label === "Settings") {
                  return <Separator className="my-2" />
                }
                return null
              }

              if (label === "Orchestration") {
                return (
                  <div key={label}>
                    {renderSeparator()}
                    <Collapsible open={!isCollapsed && openCollapsibles.includes(label)} onOpenChange={() => toggleCollapsible(label)}>
                      <CollapsibleTrigger asChild>
                        <button
                          className={`flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                            isActive ? "bg-muted text-primary" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4" />
                            {!isCollapsed && label}
                          </div>
                          {!isCollapsed && <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />}
                        </button>
                      </CollapsibleTrigger>
                      {!isCollapsed && (
                        <CollapsibleContent className="pl-7 py-1 space-y-1">
                          {orchestrationNavItems.map(item => (
                            <Link
                              key={item.label}
                              href={item.href}
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-all hover:text-primary text-xs ${
                                pathname === "/dashboard/manage" && searchParams.get('tab') === item.href.split("=")[1] ? "bg-accent text-accent-foreground" : ""
                              }`}
                            >
                              <item.icon className="h-3 w-3" />
                              {item.label}
                            </Link>
                          ))}
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  </div>
                )
              }
              if (label === "Settings") {
                return (
                  <div key={label}>
                    {renderSeparator()}
                    <Collapsible open={!isCollapsed && openCollapsibles.includes(label)} onOpenChange={() => toggleCollapsible(label)}>
                      <CollapsibleTrigger asChild>
                        <button
                          className={`flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                            isActive ? "bg-muted text-primary" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4" />
                            {!isCollapsed && label}
                          </div>
                          {!isCollapsed && <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />}
                        </button>
                      </CollapsibleTrigger>
                      {!isCollapsed && (
                        <CollapsibleContent className="pl-7 py-1 space-y-1">
                          {settingsNavItems.map(item => (
                            <Link
                              key={item.label}
                              href={item.href}
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-all hover:text-primary text-xs ${
                                pathname === item.href ? "bg-accent text-accent-foreground" : ""
                              }`}
                            >
                              <item.icon className="h-3 w-3" />
                              {item.label}
                            </Link>
                          ))}
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  </div>
                );
              }
              return (
                <div key={label}>
                  {renderSeparator()}
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                      isActive ? "bg-muted text-primary" : ""
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {!isCollapsed && label}
                  </Link>
                </div>
              );
            })}

            {/* Data Section - Show tables organized by databases */}
            <div>
              <Separator className="my-2" />
              <Collapsible 
                defaultOpen={pathname === "/dashboard"} 
                open={!isCollapsed && openCollapsibles.includes("Data")} 
                onOpenChange={() => toggleCollapsible("Data")}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={`flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                      pathname === "/dashboard" ? "bg-muted text-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4" />
                      {!isCollapsed && "Data"}
                    </div>
                    {!isCollapsed && <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />}
                  </button>
                </CollapsibleTrigger>
                {!isCollapsed && (
                  <CollapsibleContent className="pl-7 py-1 space-y-1">
                    {isLoading ? (
                      <div className="text-xs text-muted-foreground px-3 py-2">Loading tables...</div>
                    ) : data.databases.length === 0 ? (
                      <div className="text-xs text-muted-foreground px-3 py-2">No tables yet</div>
                    ) : (
                      data.databases.map(db => (
                        <Collapsible 
                          key={db.id} 
                          defaultOpen={pathname === "/dashboard"} 
                          open={openCollapsibles.includes(db.id)} 
                          onOpenChange={() => toggleCollapsible(db.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary text-xs">
                              <div className="flex items-center gap-2">
                                <Database className="h-3 w-3" />
                                {db.name}
                              </div>
                              <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-4 py-1 space-y-1">
                            {db.tables.map(table => (
                              <Link
                                key={table.id}
                                href={`/dashboard?tableId=${table.id}`}
                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-all hover:text-primary text-xs ${
                                  pathname === "/dashboard" && searchParams.get('tableId') === table.id.toString() ? "bg-accent text-accent-foreground" : ""
                                }`}
                              >
                                <Table className="h-3 w-3" />
                                {table.name}
                              </Link>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </CollapsibleContent>
                )}
              </Collapsible>
            </div>

          </nav>
        </ScrollArea>
      </div>
    </div>
  )
}