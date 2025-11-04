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
import { SidebarItemActions } from "./sidebar-item-actions"
import { InlineRename } from "./inline-rename"

interface SidebarSectionProps<T> {
  icon: LucideIcon
  label: string
  items: T[]
  pathname: string | null
  isCreating: boolean
  defaultOpen?: boolean
  getItemHref: (item: T) => string
  getItemName: (item: T) => string
  getItemKey: (item: T) => string | number
  isItemActive: (item: T, pathname: string | null) => boolean
  onAdd: () => void
  addButtonLabel?: string
  // Action callbacks
  onRename?: (item: T, newName: string) => void | Promise<void>
  onDuplicate?: (item: T) => void | Promise<void>
  onDelete?: (item: T) => void | Promise<void>
}

export function SidebarSection<T>({
  icon: Icon,
  label,
  items,
  pathname,
  isCreating,
  defaultOpen = false,
  getItemHref,
  getItemName,
  getItemKey,
  isItemActive,
  onAdd,
  addButtonLabel = `Add ${label.slice(0, -1)}`, // Remove trailing 's' for singular
  onRename,
  onDuplicate,
  onDelete,
}: SidebarSectionProps<T>) {
  const [renamingItemKey, setRenamingItemKey] = React.useState<string | number | null>(null)

  const hasActions = onRename || onDuplicate || onDelete

  const handleRename = async (item: T, newName: string) => {
    if (onRename) {
      await onRename(item, newName)
    }
    setRenamingItemKey(null)
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
              {items.map((item) => {
                const itemKey = getItemKey(item)
                const isRenaming = renamingItemKey === itemKey

                return (
                  <SidebarMenuItem key={itemKey} className="group">
                    <div className="flex items-center gap-1 w-full">
                      {isRenaming ? (
                        <div className="flex-1 px-2">
                          <InlineRename
                            value={getItemName(item)}
                            onSave={(newName) => handleRename(item, newName)}
                            onCancel={() => setRenamingItemKey(null)}
                          />
                        </div>
                      ) : (
                        <>
                          <SidebarMenuButton asChild isActive={isItemActive(item, pathname)} className="h-6 flex-1">
                            <Link href={getItemHref(item)}>
                              <span className="group-data-[collapsible=icon]:hidden">
                                {getItemName(item)}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                          {hasActions && (
                            <SidebarItemActions
                              onRename={onRename ? () => setRenamingItemKey(itemKey) : undefined}
                              onDuplicate={onDuplicate ? () => onDuplicate(item) : undefined}
                              onDelete={onDelete ? () => onDelete(item) : undefined}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </SidebarMenuItem>
                )
              })}
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
