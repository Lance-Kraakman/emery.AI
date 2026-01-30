"use client"

import * as React from "react"
import Link from "next/link"
import { LucideIcon, Plus, ChevronRight, FileText, LayoutTemplate } from "lucide-react"
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
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SidebarItemActions } from "./sidebar-item-actions"
import { InlineRename } from "./inline-rename"

interface NestedSidebarSectionProps<TParent, TChild> {
  icon: LucideIcon
  label: string
  parents: TParent[]
  pathname: string | null
  isCreating: boolean
  defaultOpen?: boolean
  openSet: Set<number>
  onToggle: (id: number) => void
  getParentId: (parent: TParent) => number
  getParentName: (parent: TParent) => string
  getParentHref: (parent: TParent) => string
  isParentActive: (parent: TParent, pathname: string | null) => boolean
  getChildren: (parent: TParent) => TChild[] | undefined
  getChildKey: (child: TChild) => number
  getChildName: (child: TChild) => string
  getChildHref: (child: TChild, parent: TParent) => string
  isChildActive: (child: TChild, parent: TParent, pathname: string | null) => boolean
  onAddParent: () => void
  onAddChild: (parentId: number) => void
  addParentLabel?: string
  addChildLabel?: string
  /** Optional callback for "From Template" parent option - if provided, shows dropdown */
  onAddParentFromTemplate?: () => void
  /** Optional callback for "From Template" child option - if provided, shows dropdown */
  onAddChildFromTemplate?: (parentId: number) => void
  // Resource type mapping for ShareButton
  parentResourceType?: string
  childResourceType?: string
  // Parent action callbacks
  onRenameParent?: (parent: TParent, newName: string) => void | Promise<void>
  onDuplicateParent?: (parent: TParent) => void | Promise<void>
  onShareParent?: (parent: TParent) => void | Promise<void>
  onDeleteParent?: (parent: TParent) => void | Promise<void>
  // Child action callbacks
  onRenameChild?: (child: TChild, parent: TParent, newName: string) => void | Promise<void>
  onDuplicateChild?: (child: TChild, parent: TParent) => void | Promise<void>
  onShareChild?: (child: TChild, parent: TParent) => void | Promise<void>
  onDeleteChild?: (child: TChild, parent: TParent) => void | Promise<void>
}

export function NestedSidebarSection<TParent, TChild>({
  icon: Icon,
  label,
  parents,
  pathname,
  isCreating,
  defaultOpen = false,
  openSet,
  onToggle,
  getParentId,
  getParentName,
  getParentHref,
  isParentActive,
  getChildren,
  getChildKey,
  getChildName,
  getChildHref,
  isChildActive,
  onAddParent,
  onAddChild,
  addParentLabel = `Add ${label.slice(0, -1)}`, // Remove trailing 's'
  addChildLabel = "Add Item",
  onAddParentFromTemplate,
  onAddChildFromTemplate,
  parentResourceType,
  childResourceType,
  onRenameParent,
  onDuplicateParent,
  onShareParent,
  onDeleteParent,
  onRenameChild,
  onDuplicateChild,
  onShareChild,
  onDeleteChild,
}: NestedSidebarSectionProps<TParent, TChild>) {
  const [renamingParentId, setRenamingParentId] = React.useState<number | null>(null)
  const [renamingChildKey, setRenamingChildKey] = React.useState<number | null>(null)

  const hasParentActions = onRenameParent || onDuplicateParent || onShareParent || onDeleteParent
  const hasChildActions = onRenameChild || onDuplicateChild || onShareChild || onDeleteChild

  const handleRenameParent = async (parent: TParent, newName: string) => {
    if (onRenameParent) {
      await onRenameParent(parent, newName)
    }
    setRenamingParentId(null)
  }

  const handleRenameChild = async (child: TChild, parent: TParent, newName: string) => {
    if (onRenameChild) {
      await onRenameChild(child, parent, newName)
    }
    setRenamingChildKey(null)
  }
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/section">
      <SidebarGroup className="py-0">
        <SidebarGroupLabel asChild className="text-[11px] text-sidebar-foreground/60">
          <CollapsibleTrigger>
            <span className="shrink-0 flex items-center">
              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/section:rotate-90" />
            </span>
            <Icon className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">{label}</span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {parents.map((parent) => {
                const parentId = getParentId(parent)
                const children = getChildren(parent)
                const isOpen = openSet.has(parentId)
                const isRenamingParent = renamingParentId === parentId

                return (
                  <Collapsible
                    key={parentId}
                    open={isOpen}
                    onOpenChange={() => onToggle(parentId)}
                  >
                    <SidebarMenuItem className="group">
                      {isRenamingParent ? (
                        <div className="flex-1 px-2 h-6">
                          <InlineRename
                            value={getParentName(parent)}
                            onSave={(newName) => handleRenameParent(parent, newName)}
                            onCancel={() => setRenamingParentId(null)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center w-full">
                          <CollapsibleTrigger className="shrink-0 p-0.5 rounded-sm hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden">
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 transition-transform duration-200",
                                isOpen && "rotate-90"
                              )}
                            />
                          </CollapsibleTrigger>
                          <SidebarMenuButton asChild isActive={isParentActive(parent, pathname)} className="h-6 flex-1">
                            <Link href={getParentHref(parent)}>
                              <span className="group-data-[collapsible=icon]:hidden">
                                {getParentName(parent)}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                          {hasParentActions && (
                            <SidebarItemActions
                              onRename={onRenameParent ? () => setRenamingParentId(parentId) : undefined}
                              onDuplicate={onDuplicateParent ? () => onDuplicateParent(parent) : undefined}
                              onShare={onShareParent ? () => onShareParent(parent) : undefined}
                              onDelete={onDeleteParent ? () => onDeleteParent(parent) : undefined}
                              shareResourceType={parentResourceType}
                              shareResourceId={parentId}
                            />
                          )}
                        </div>
                      )}
                      <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                        <SidebarMenuSub className="gap-0.5">
                          {children?.map((child) => {
                            const childKey = getChildKey(child)
                            const isRenamingChild = renamingChildKey === childKey

                            return (
                              <SidebarMenuSubItem key={childKey} className="group/child">
                                {isRenamingChild ? (
                                  <div className="flex-1 px-2 h-6">
                                    <InlineRename
                                      value={getChildName(child)}
                                      onSave={(newName) => handleRenameChild(child, parent, newName)}
                                      onCancel={() => setRenamingChildKey(null)}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 w-full">
                                    <SidebarMenuSubButton
                                      asChild
                                      size="sm"
                                      isActive={isChildActive(child, parent, pathname)}
                                      className="h-6 flex-1"
                                    >
                                      <Link href={getChildHref(child, parent)}>
                                        <FileText className="h-3 w-3 group-data-[collapsible=icon]:hidden" />
                                        <span className="group-data-[collapsible=icon]:hidden">
                                          {getChildName(child)}
                                        </span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                    {hasChildActions && (
                                      <SidebarItemActions
                                        className="opacity-0 group-hover/child:opacity-100"
                                        onRename={onRenameChild ? () => setRenamingChildKey(childKey) : undefined}
                                        onDuplicate={onDuplicateChild ? () => onDuplicateChild(child, parent) : undefined}
                                        onShare={onShareChild ? () => onShareChild(child, parent) : undefined}
                                        onDelete={onDeleteChild ? () => onDeleteChild(child, parent) : undefined}
                                        shareResourceType={childResourceType}
                                        shareResourceId={childKey}
                                      />
                                    )}
                                  </div>
                                )}
                              </SidebarMenuSubItem>
                            )
                          })}
                          <SidebarMenuSubItem>
                            {onAddChildFromTemplate ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start h-6 px-2 text-xs group-data-[collapsible=icon]:hidden"
                                    disabled={isCreating}
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span className="group-data-[collapsible=icon]:hidden">
                                      {addChildLabel}
                                    </span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                  <DropdownMenuItem onClick={() => onAddChild(parentId)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Blank
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onAddChildFromTemplate(parentId)}>
                                    <LayoutTemplate className="h-4 w-4 mr-2" />
                                    From Template
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-6 px-2 text-xs group-data-[collapsible=icon]:hidden"
                                onClick={() => onAddChild(parentId)}
                                disabled={isCreating}
                              >
                                <Plus className="h-3 w-3" />
                                <span className="group-data-[collapsible=icon]:hidden">
                                  {addChildLabel}
                                </span>
                              </Button>
                            )}
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
              {onAddParentFromTemplate ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-6 px-2 text-sm mt-0.5 group-data-[collapsible=icon]:hidden"
                      disabled={isCreating}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{addParentLabel}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={onAddParent}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Blank
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onAddParentFromTemplate}>
                      <LayoutTemplate className="h-4 w-4 mr-2" />
                      From Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start h-6 px-2 text-sm mt-0.5 group-data-[collapsible=icon]:hidden"
                  onClick={onAddParent}
                  disabled={isCreating}
                >
                  <Plus className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{addParentLabel}</span>
                </Button>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
