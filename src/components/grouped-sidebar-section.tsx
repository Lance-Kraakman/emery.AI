"use client"

import * as React from "react"
import Link from "next/link"
import { LucideIcon, Plus, Lock, ChevronRight } from "lucide-react"
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
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
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
  isSystemItem?: (item: T) => boolean  // For system items (read-only, grouped separately)
  // Actions
  onAdd: () => void
  addButtonLabel?: string
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
  isSystemItem = () => false,  // Default to no system items
  onAdd,
  addButtonLabel = `Add ${label.slice(0, -1)}`, // Remove trailing 's' for singular
  onRename,
  onDuplicate,
  onShare,
  onDelete,
}: GroupedSidebarSectionProps<T>) {
  const [renamingItemId, setRenamingItemId] = React.useState<number | null>(null)
  const [systemSectionOpen, setSystemSectionOpen] = React.useState(false)

  const hasActions = onRename || onDuplicate || onShare || onDelete

  const handleRename = async (item: T, newName: string) => {
    if (onRename) {
      await onRename(item, newName)
    }
    setRenamingItemId(null)
  }

  // Separate items into three categories:
  // 1. System items (read-only, shown in collapsible section at bottom)
  const systemItems = items.filter(item => isSystemItem(item))

  // 2. Ungrouped items (organization skills, shown at top)
  const ungroupedItems = items.filter(item => !isSystemItem(item) && isUngroupedItem(item))

  // 3. Grouped items (agent skills, shown grouped by agent)
  const groupedItems = items.filter(item => !isSystemItem(item) && !isUngroupedItem(item))
  const uniqueGroupKeys = Array.from(new Set(groupedItems.map(getGroupKey)))

  // Helper function to render an item with actions
  const renderItem = (item: T, className = "") => {
    const itemId = getItemId(item)
    const isRenaming = renamingItemId === itemId
    const isSystem = isSystemItem(item)

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
                className={`h-6 flex-1 ${className}`}
              >
                <Link href={getItemHref(item)}>
                  <span className="group-data-[collapsible=icon]:hidden">
                    {getItemName(item)}
                  </span>
                </Link>
              </SidebarMenuButton>
              {/* System items: show lock icon instead of actions */}
              {isSystem ? (
                <Lock className="h-3 w-3 mr-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : hasActions && (
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
    <Collapsible defaultOpen={defaultOpen}>
      <SidebarGroup className="py-0">
        <SidebarGroupLabel asChild className="text-[11px] text-sidebar-foreground/60">
          <CollapsibleTrigger>
            <Icon className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">{label}</span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {/* Ungrouped items (top level) */}
              {ungroupedItems.map((item) => renderItem(item))}

              {/* Grouped items */}
              {uniqueGroupKeys.map((groupKey) => {
                const itemsInGroup = groupedItems.filter(item => getGroupKey(item) === groupKey)
                const groupName = getGroupName(itemsInGroup[0]) || `Group ${groupKey}`

                return (
                  <div key={`group-${groupKey}`} className="mt-2">
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                      {groupName}
                    </div>
                    {itemsInGroup.map(item => renderItem(item, "pl-4"))}
                  </div>
                )
              })}

              {/* System items section */}
              {systemItems.length > 0 && (
                <Collapsible open={systemSectionOpen} onOpenChange={setSystemSectionOpen} className="mt-2">
                  <CollapsibleTrigger className="flex items-center gap-1 px-2 py-1 w-full text-xs text-muted-foreground font-medium hover:text-foreground transition-colors">
                    <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${systemSectionOpen ? 'rotate-90' : ''}`} />
                    <Lock className="h-3 w-3" />
                    <span>System</span>
                    <span className="ml-auto text-[10px] opacity-60">{systemItems.length}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {systemItems.map(item => renderItem(item, "pl-4"))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Add button */}
              <Button
                variant="ghost"
                className="w-full justify-start h-6 px-2 text-sm mt-0.5 group-data-[collapsible=icon]:hidden"
                onClick={onAdd}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">{addButtonLabel}</span>
              </Button>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
