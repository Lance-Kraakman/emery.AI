"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/src/components/ui/button"
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
  LogOut,
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible"
import { Separator } from "@/src/components/ui/separator"
import { ScrollArea } from "@/src/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar"
import { EmeryOrganizationModal } from "./EmeryOrganizationModal"
import { useEmeryStore } from "@/src/contexts/EmeryStoreProvider"
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors } from '@/src/stores/ui-state.store'
import { storeActions, uiStateActions } from '@/src/stores/actions'
import { useLayout } from "@/src/components/layout/LayoutProvider"

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
    label: "Permissions",
    href: "/organization/settings/permissions",
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
  const { data: sessionData } = useSession()
  const { data, isLoading } = useEmeryStore()
  // Use TanStack Store for collapsible state management
  const globalOpenCollapsibles = useStore(uiStateStore, uiStateSelectors.openCollapsibles)
  const { sidebarState, toggleSidebar, isMobile } = useLayout()
  // Use store state instead of local state
  const openCollapsibles = globalOpenCollapsibles
  
  // Determine if sidebar is collapsed based on layout state
  const isCollapsed = sidebarState === 'collapsed'

  useEffect(() => {
    const orchestrationPaths = orchestrationNavItems.map(item => item.href)
    const settingsPaths = settingsNavItems.map(item => item.href)

    if (!pathname) {
      uiStateActions.setOpenCollapsibles([])
      return
    }

    if (orchestrationPaths.includes(pathname)) {
      uiStateActions.setOpenCollapsibles(["Orchestration"])
    } else if (settingsPaths.includes(pathname)) {
      uiStateActions.setOpenCollapsibles(["Settings"])
    } else if (pathname?.startsWith("/data")) {
      uiStateActions.setOpenCollapsibles(["Data", ...data.databases.map(db => db.id.toString())])
    } else {
      uiStateActions.setOpenCollapsibles([])
    }
  }, [pathname, data.databases])

  // Remove local toggle function - use layout context instead

  const toggleCollapsible = (id: string) => {
    // Don't allow collapsible toggling when sidebar is collapsed or on mobile
    if (isCollapsed || isMobile) return
    
    const isOpen = openCollapsibles.includes(id)
    if (id === "Data") {
      const dbIds = data.databases.map(db => db.id.toString())
      const newCollapsibles = isOpen
        ? openCollapsibles.filter(item => item !== id && !dbIds.includes(item))
        : [...openCollapsibles, id, ...dbIds]
      uiStateActions.setOpenCollapsibles(newCollapsibles)
    } else {
      const newCollapsibles = isOpen 
        ? openCollapsibles.filter(item => item !== id) 
        : [...openCollapsibles, id]
      uiStateActions.setOpenCollapsibles(newCollapsibles)
    }
  }

  return (
    <div
      className={`relative h-screen border-r transition-all duration-300 ease-in-out shadow-lg ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-screen max-h-screen flex-col gap-2">
        <div className="flex h-16 items-center border-b px-4 justify-between">
          <div className="flex items-center gap-2">
            <EmeryOrganizationModal isCollapsed={isCollapsed} />
          </div>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 py-2">
          <nav className="grid items-start text-sm font-medium">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/mission-control' && pathname?.startsWith(href))
              
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
                          className={`flex items-center w-full gap-3 rounded-lg px-3 py-2 text-foreground/70 transition-all hover:text-primary hover:bg-muted ${
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
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-foreground/60 transition-all hover:text-primary text-xs hover:bg-muted ${
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
                        defaultOpen={pathname?.startsWith("/mission-control") && searchParams?.has('tableId')} 
                        open={!isCollapsed && openCollapsibles.includes("Data")} 
                        onOpenChange={() => toggleCollapsible("Data")}
                      >
                        <CollapsibleTrigger asChild>
                          <Link
                            href="/data"
                            className={`flex items-center w-full gap-3 rounded-lg px-3 py-2 text-foreground/70 transition-all hover:text-primary hover:bg-muted ${
                              pathname?.startsWith("/data") ? "bg-muted text-primary" : ""
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
                                  defaultOpen={pathname?.startsWith("/mission-control") && searchParams?.has('tableId')} 
                                  open={openCollapsibles.includes(db.id.toString())} 
                                  onOpenChange={() => toggleCollapsible(db.id.toString())}
                                >
                                  <CollapsibleTrigger asChild>
                                    <button className="flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2 text-foreground/60 transition-all hover:text-primary text-xs hover:bg-muted">
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
                                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-foreground/60 transition-all hover:text-primary text-xs hover:bg-muted ${
                                          pathname === "/data" && searchParams?.get('tableId') === table.id.toString() ? "bg-accent text-accent-foreground" : ""
                                        }`}
                                      >
                                        <Table className="h-3 w-3" />
                                        {table.name}
                                      </Link>
                                    ))}
                                    {/* Add Table button at the bottom of each database */}
                                    <button
                                      onClick={() => storeActions.openTableForm(db.id)}
                                      className="flex items-center justify-center w-full rounded-md px-3 py-2 text-foreground/60 transition-all hover:text-primary text-xs hover:bg-muted"
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
                              onClick={() => storeActions.openDatabaseForm()}
                              className="flex items-center justify-center w-full rounded-md px-3 py-2 text-foreground/60 transition-all hover:text-primary text-xs hover:bg-muted mt-2"
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
                          className={`flex items-center w-full gap-3 rounded-lg px-3 py-2 text-foreground/70 transition-all hover:text-primary hover:bg-muted ${
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
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-foreground/60 transition-all hover:text-primary text-xs hover:bg-muted ${
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
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 text-foreground/70 transition-all hover:text-primary hover:bg-muted ${
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
        
        {/* User Avatar and Menu at Bottom */}
        <div className="mt-auto p-4 border-t border-border">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full p-2 h-auto ${
                  isCollapsed ? "justify-center" : "justify-start gap-4"
                }`}
              >
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
                {!isCollapsed && (
                  <div className="flex flex-col items-start text-left">
                    <span className="text-base font-semibold text-foreground">
                      {sessionData?.user?.name || "User"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {sessionData?.user?.email}
                    </span>
                  </div>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-56 p-0" 
              side={isCollapsed ? "right" : "top"} 
              align={isCollapsed ? "start" : "end"}
            >
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
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
