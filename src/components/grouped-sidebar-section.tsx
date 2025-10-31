"use client"

import * as React from "react"
import Link from "next/link"
import { LucideIcon, Plus } from "lucide-react"
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
}: GroupedSidebarSectionProps<T>) {
  // Separate ungrouped items (e.g., organization skills)
  const ungroupedItems = items.filter(isUngroupedItem)

  // Group the remaining items
  const groupedItems = items.filter(item => !isUngroupedItem(item))
  const uniqueGroupKeys = Array.from(new Set(groupedItems.map(getGroupKey)))

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
              {ungroupedItems.map((item) => (
                <SidebarMenuItem key={getItemId(item)}>
                  <SidebarMenuButton
                    asChild
                    isActive={isItemActive(item, pathname)}
                    className="h-6"
                  >
                    <Link href={getItemHref(item)}>
                      <span className="group-data-[collapsible=icon]:hidden">
                        {getItemName(item)}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Grouped items */}
              {uniqueGroupKeys.map((groupKey) => {
                const itemsInGroup = groupedItems.filter(item => getGroupKey(item) === groupKey)
                const groupName = getGroupName(itemsInGroup[0]) || `Group ${groupKey}`

                return (
                  <div key={`group-${groupKey}`} className="mt-2">
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                      {groupName}
                    </div>
                    {itemsInGroup.map(item => (
                      <SidebarMenuItem key={getItemId(item)}>
                        <SidebarMenuButton
                          asChild
                          isActive={isItemActive(item, pathname)}
                          className="h-6 pl-4"
                        >
                          <Link href={getItemHref(item)}>
                            <span className="group-data-[collapsible=icon]:hidden">
                              {getItemName(item)}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </div>
                )
              })}

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
