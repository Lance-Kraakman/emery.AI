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
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  /** Optional callback for "From Template" option - if provided, shows dropdown */
  onAddFromTemplate?: () => void
  // Action callbacks
  onRename?: (item: T, newName: string) => void | Promise<void>
  onDuplicate?: (item: T) => void | Promise<void>
  onShare?: (item: T) => void | Promise<void>
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
  onAddFromTemplate,
  onRename,
  onDuplicate,
  onShare,
  onDelete,
}: SidebarSectionProps<T>) {
  const [renamingItemKey, setRenamingItemKey] = React.useState<string | number | null>(null)

  const hasActions = onRename || onDuplicate || onShare || onDelete

  const handleRename = async (item: T, newName: string) => {
    if (onRename) {
      await onRename(item, newName)
    }
    setRenamingItemKey(null)
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
            <SidebarMenu className="gap-0.5 pl-4">
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
                          <SidebarMenuButton asChild isActive={isItemActive(item, pathname)} size="sm" className="flex-1">
                            <Link href={getItemHref(item)}>
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="group-data-[collapsible=icon]:hidden">
                                {getItemName(item)}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                          {hasActions && (
                            <SidebarItemActions
                              onRename={onRename ? () => setRenamingItemKey(itemKey) : undefined}
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
              })}
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
