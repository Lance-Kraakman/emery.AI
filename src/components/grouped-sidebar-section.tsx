"use client"

import * as React from "react"
import Link from "next/link"
import { LucideIcon, Plus, LayoutTemplate, ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarItemActions } from "./sidebar-item-actions"
import { InlineRename } from "./inline-rename"

interface GroupedSidebarSectionProps<T> {
  icon: LucideIcon
  label: string
  items: T[]
  pathname: string | null
  isCreating: boolean
  defaultOpen?: boolean
  // Item functions
  getItemId: (item: T) => number
  getItemName: (item: T) => string
  getItemHref: (item: T) => string
  isItemActive: (item: T, pathname: string | null) => boolean
  // Grouping functions
  getGroupKey: (item: T) => string | number | null
  getGroupName: (item: T) => string | undefined
  isUngroupedItem: (item: T) => boolean
  // Actions
  onAdd: () => void
  addButtonLabel?: string
  /** Optional callback for "From Template" option - if provided, shows dropdown */
  onAddFromTemplate?: () => void
  // Action callbacks
  onRename?: (item: T, newName: string) => void | Promise<void>
  onDuplicate?: (item: T) => void | Promise<void>
  onShare?: (item: T) => void | Promise<void>
  onDelete?: (item: T) => void | Promise<void>
}

/**
 * Grouped Sidebar Section
 *
 * Similar to SidebarSection but supports grouping items (e.g., skills by agent).
 * Items without a group are shown at the top level, grouped items are shown under group headers.
 *
 * AIDEV-NOTE: Used for Skills section to show organization skills + agent skills grouped by agent
 */
export function GroupedSidebarSection<T>({
  icon: Icon,
  label,
  items,
  pathname,
  isCreating,
  defaultOpen = false,
  getItemId,
  getItemName,
  getItemHref,
  isItemActive,
  getGroupKey,
  getGroupName,
  isUngroupedItem,
  onAdd,
  addButtonLabel = `Add ${label.slice(0, -1)}`, // Remove trailing 's' for singular
  onAddFromTemplate,
  onRename,
  onDuplicate,
  onShare,
  onDelete,
}: GroupedSidebarSectionProps<T>) {
  const [renamingItemId, setRenamingItemId] = React.useState<number | null>(null)

  const hasActions = onRename || onDuplicate || onShare || onDelete

  const handleRename = async (item: T, newName: string) => {
    if (onRename) {
      await onRename(item, newName)
    }
    setRenamingItemId(null)
  }

  // Separate items into two categories:
  // 1. Ungrouped items (organization skills, shown at top)
  const ungroupedItems = items.filter(item => isUngroupedItem(item))

  // 2. Grouped items (agent skills, shown grouped by agent)
  const groupedItems = items.filter(item => !isUngroupedItem(item))
  const uniqueGroupKeys = Array.from(new Set(groupedItems.map(getGroupKey)))

  // Track open/close state for each agent group (default all open)
  const [openGroups, setOpenGroups] = React.useState<Set<string | number | null>>(() => {
    return new Set(uniqueGroupKeys)
  })

  const toggleGroup = (key: string | number | null) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Helper function to render an item with actions
  const renderItem = (item: T, className = "") => {
    const itemId = getItemId(item)
    const isRenaming = renamingItemId === itemId

    return (
      <SidebarMenuItem key={itemId} className="group">
        <div className="flex items-center gap-1 w-full">
          {isRenaming ? (
            <div className="flex-1 px-2">
              <InlineRename
                value={getItemName(item)}
                onSave={(newName) => handleRename(item, newName)}
                onCancel={() => setRenamingItemId(null)}
              />
            </div>
          ) : (
            <>
              <SidebarMenuButton
                asChild
                isActive={isItemActive(item, pathname)}
                size="sm"
                className={`flex-1 ${className}`}
              >
                <Link href={getItemHref(item)}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {getItemName(item)}
                  </span>
                </Link>
              </SidebarMenuButton>
              {hasActions && (
                <SidebarItemActions
                  onRename={onRename ? () => setRenamingItemId(itemId) : undefined}
                  onDuplicate={onDuplicate ? () => onDuplicate(item) : undefined}
                  onShare={onShare ? () => onShare(item) : undefined}
                  onDelete={onDelete ? () => onDelete(item) : undefined}
                />
              )}
            </>
          )}
        </div>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/section">
      <SidebarGroup className="py-0">
        <SidebarGroupLabel asChild className="text-[11px] text-sidebar-foreground/60">
          <CollapsibleTrigger>
            <span className="shrink-0 flex items-center">
              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/section:rotate-90" />
            </span>
            <span className="group-data-[collapsible=icon]:hidden">{label}</span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0 pl-2">
              {/* Ungrouped items (top level) */}
              {ungroupedItems.map((item) => renderItem(item))}

              {/* Grouped items - collapsible folders */}
              {uniqueGroupKeys.map((groupKey) => {
                const itemsInGroup = groupedItems.filter(item => getGroupKey(item) === groupKey)
                const groupName = getGroupName(itemsInGroup[0]) || `Group ${groupKey}`
                const isGroupOpen = openGroups.has(groupKey)

                return (
                  <Collapsible
                    key={`group-${groupKey}`}
                    open={isGroupOpen}
                    onOpenChange={() => toggleGroup(groupKey)}
                  >
                    <SidebarMenuItem>
                      <div className="flex items-center w-full">
                        <CollapsibleTrigger className="shrink-0 p-0.5 rounded-sm hover:bg-sidebar-accent">
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 transition-transform duration-200",
                              isGroupOpen && "rotate-90"
                            )}
                          />
                        </CollapsibleTrigger>
                        <SidebarMenuButton size="sm" className="flex-1 pointer-events-none">
                          <span className="text-xs font-medium truncate">
                            {groupName}
                          </span>
                        </SidebarMenuButton>
                      </div>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {itemsInGroup.map((item) => {
                          const itemId = getItemId(item)
                          const isRenaming = renamingItemId === itemId

                          return (
                            <SidebarMenuSubItem key={itemId} className="group">
                              {isRenaming ? (
                                <div className="flex-1 px-2">
                                  <InlineRename
                                    value={getItemName(item)}
                                    onSave={(newName) => handleRename(item, newName)}
                                    onCancel={() => setRenamingItemId(null)}
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 w-full">
                                  <SidebarMenuSubButton
                                    asChild
                                    size="sm"
                                    isActive={isItemActive(item, pathname)}
                                    className="flex-1"
                                  >
                                    <Link href={getItemHref(item)}>
                                      <Icon className="h-3.5 w-3.5 shrink-0" />
                                      <span>{getItemName(item)}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                  {hasActions && (
                                    <SidebarItemActions
                                      className="opacity-0 group-hover:opacity-100"
                                      onRename={onRename ? () => setRenamingItemId(itemId) : undefined}
                                      onDuplicate={onDuplicate ? () => onDuplicate(item) : undefined}
                                      onShare={onShare ? () => onShare(item) : undefined}
                                      onDelete={onDelete ? () => onDelete(item) : undefined}
                                    />
                                  )}
                                </div>
                              )}
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}

              {/* Add button */}
              {onAddFromTemplate ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="w-full justify-start mt-0.5 group-data-[collapsible=icon]:hidden"
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{addButtonLabel}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={onAdd}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Blank
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onAddFromTemplate}>
                      <LayoutTemplate className="h-4 w-4 mr-2" />
                      From Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                      className="w-full justify-start mt-0.5 group-data-[collapsible=icon]:hidden"
                  onClick={onAdd}
                  disabled={isCreating}
                >
                  <Plus className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{addButtonLabel}</span>
                </Button>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
