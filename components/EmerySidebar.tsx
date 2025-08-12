"use client"

import { useState, useEffect } from "react"
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
  Plus,
  SlidersHorizontal,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmeryOrganizationModal } from "./EmeryOrganizationModal"
import { useEmery } from "@/contexts/EmeryContext"
import { useDataDialogs } from "@/contexts/DataDialogsContext"

const navItems = [
  { href: "/mission-control", label: "Mission Control", icon: Target },
  { href: "/organization", label: "Orchestration", icon: Workflow },
  { href: "/connections", label: "Settings", icon: Settings },
]

const orchestrationNavItems = [
  { href: "/organization", label: "Organization Chart", icon: Building2 },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/agents", label: "Agents", icon: Bot },
]

const settingsNavItems = [
  {
    label: "OAuth Connections",
    href: "/connections",
    icon: Plug,
  },
  {
    label: "Users & Permissions",
    href: "/settings/users-and-permissions",
    icon: Users,
  },
  {
    label: "System",
    href: "/settings/system",
    icon: SlidersHorizontal,
  },
]

export function EmerySidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data, isLoading } = useEmery()
  const { setIsCreateDatabaseOpen, setIsCreateTableOpen, setSelectedDatabaseForTable } = useDataDialogs()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [openCollapsibles, setOpenCollapsibles] = useState<string[]>([])

  useEffect(() => {
    const orchestrationPaths = orchestrationNavItems.map(item => item.href)
    const settingsPaths = settingsNavItems.map(item => item.href)

    if (orchestrationPaths.includes(pathname)) {
      setOpenCollapsibles(["Orchestration"])
    } else if (settingsPaths.includes(pathname)) {
      setOpenCollapsibles(["Settings"])
    } else if (pathname.startsWith("/data")) {
      setOpenCollapsibles(["Data", ...data.databases.map(db => db.id.toString())])
    } else {
      setOpenCollapsibles([])
    }
  }, [pathname, data.databases])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const toggleCollapsible = (id: string) => {
    if (isCollapsed) return
    setOpenCollapsibles(prev => {
      const isOpen = prev.includes(id)
      if (id === "Data") {
        const dbIds = data.databases.map(db => db.id.toString())
        return isOpen
          ? prev.filter(item => item !== id && !dbIds.includes(item))
          : [...prev, id, ...dbIds]
      }
      return isOpen ? prev.filter(item => item !== id) : [...prev, id]
    })
  }

  return (
    <div
      className={`relative min-h-screen border-r transition-all duration-300 ease-in-out shadow-lg ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div
          className={`flex h-16 items-center px-4 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed && <EmeryOrganizationModal />}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
          >
            {isCollapsed ? <Bot className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
        </div>
        <ScrollArea className="flex-1 py-2">
          <nav className="grid items-start text-sm font-medium">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/mission-control' && pathname.startsWith(href))
              
              const renderSeparator = () => {
                if (label === "Orchestration") {
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
                        <Link
                          href={href}
                          className={`flex items-center w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                            isActive ? "bg-muted text-primary" : ""
                          } ${isCollapsed ? "justify-center" : "justify-between"}`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4" />
                            {!isCollapsed && label}
                          </div>
                          {!isCollapsed && <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />}
                        </Link>
                      </CollapsibleTrigger>
                      {!isCollapsed && (
                        <CollapsibleContent className="pl-7 py-1 space-y-1">
                          {orchestrationNavItems.map(item => (
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
                    
                    {/* Data Section - Show tables organized by databases */}
                    <div>
                      <Separator className="my-2" />
                      <Collapsible 
                        defaultOpen={pathname.startsWith("/mission-control") && searchParams?.has('tableId')} 
                        open={!isCollapsed && openCollapsibles.includes("Data")} 
                        onOpenChange={() => toggleCollapsible("Data")}
                      >
                        <CollapsibleTrigger asChild>
                          <Link
                            href="/data"
                            className={`flex items-center w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                              pathname.startsWith("/data") ? "bg-muted text-primary" : ""
                            } ${isCollapsed ? "justify-center" : "justify-between"}`}
                          >
                            <div className="flex items-center gap-3">
                              <Database className="h-4 w-4" />
                              {!isCollapsed && "Data"}
                            </div>
                            {!isCollapsed && <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />}
                          </Link>
                        </CollapsibleTrigger>
                        {!isCollapsed && (
                          <CollapsibleContent className="pl-7 py-1 space-y-1">
                            {isLoading ? (
                              <div className="text-xs text-muted-foreground px-3 py-2">Loading tables...</div>
                            ) : data.databases.length === 0 ? (
                              <div className="text-xs text-muted-foreground px-3 py-2">No databases yet</div>
                            ) : (
                              data.databases.map(db => (
                                <Collapsible 
                                  key={db.id} 
                                  defaultOpen={pathname.startsWith("/mission-control") && searchParams?.has('tableId')} 
                                  open={openCollapsibles.includes(db.id.toString())} 
                                  onOpenChange={() => toggleCollapsible(db.id.toString())}
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
                                        href={`/data?tableId=${table.id}`}
                                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-all hover:text-primary text-xs ${
                                          pathname === "/data" && searchParams.get('tableId') === table.id.toString() ? "bg-accent text-accent-foreground" : ""
                                        }`}
                                      >
                                        <Table className="h-3 w-3" />
                                        {table.name}
                                      </Link>
                                    ))}
                                    {/* Add Table button at the bottom of each database */}
                                    <button
                                      onClick={() => {
                                        setSelectedDatabaseForTable(db.id)
                                        setIsCreateTableOpen(true)
                                      }}
                                      className="flex items-center justify-center w-full rounded-md px-3 py-2 text-muted-foreground transition-all hover:text-primary text-xs hover:bg-accent"
                                      title="Add Table"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))
                            )}
                            {/* Add Database button at the bottom */}
                            <button
                              onClick={() => setIsCreateDatabaseOpen(true)}
                              className="flex items-center justify-center w-full rounded-md px-3 py-2 text-muted-foreground transition-all hover:text-primary text-xs hover:bg-accent mt-2"
                              title="Add Database"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    </div>
                  </div>
                )
              }
              if (label === "Settings") {
                return (
                  <div key={label}>
                    <Separator className="my-2" />
                    <Collapsible open={!isCollapsed && openCollapsibles.includes(label)} onOpenChange={() => toggleCollapsible(label)}>
                      <CollapsibleTrigger asChild>
                        <Link
                          href={href}
                          className={`flex items-center w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                            isActive ? "bg-muted text-primary" : ""
                          } ${isCollapsed ? "justify-center" : "justify-between"}`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4" />
                            {!isCollapsed && label}
                          </div>
                          {!isCollapsed && <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />}
                        </Link>
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
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 text-muted-foreground transition-all hover:text-primary ${
                      isActive ? "bg-muted text-primary" : ""
                    } ${isCollapsed ? "justify-center" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    {!isCollapsed && label}
                  </Link>
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      </div>
    </div>
  )
}
