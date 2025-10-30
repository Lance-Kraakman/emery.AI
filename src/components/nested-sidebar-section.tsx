"use client"

import * as React from "react"
import Link from "next/link"
import { LucideIcon, Plus, ChevronRight, ChevronDown, FileText } from "lucide-react"
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
import { Button } from "@/components/ui/button"

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
}: NestedSidebarSectionProps<TParent, TChild>) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <SidebarGroup className="py-0">
        <SidebarGroupLabel asChild className="text-[11px] text-sidebar-foreground/60">
          <CollapsibleTrigger>
            <Icon className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">{label}</span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {parents.map((parent) => {
                const parentId = getParentId(parent)
                const children = getChildren(parent)
                const isOpen = openSet.has(parentId)

                return (
                  <Collapsible
                    key={parentId}
                    open={isOpen}
                    onOpenChange={() => onToggle(parentId)}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger className="w-full">
                        <SidebarMenuButton asChild isActive={isParentActive(parent, pathname)} className="h-6">
                          <div className="flex items-center justify-between w-full">
                            <Link href={getParentHref(parent)} className="flex-1">
                              <span className="group-data-[collapsible=icon]:hidden">
                                {getParentName(parent)}
                              </span>
                            </Link>
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 ml-auto" />
                            ) : (
                              <ChevronRight className="h-4 w-4 ml-auto" />
                            )}
                          </div>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="gap-0.5">
                          {children?.map((child) => (
                            <SidebarMenuSubItem key={getChildKey(child)}>
                              <SidebarMenuSubButton
                                asChild
                                size="sm"
                                isActive={isChildActive(child, parent, pathname)}
                                className="h-6"
                              >
                                <Link href={getChildHref(child, parent)}>
                                  <FileText className="h-3 w-3" />
                                  <span className="group-data-[collapsible=icon]:hidden">
                                    {getChildName(child)}
                                  </span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                          <SidebarMenuSubItem>
                            <Button
                              variant="ghost"
                              className="w-full justify-start h-6 px-2 text-xs"
                              onClick={() => onAddChild(parentId)}
                              disabled={isCreating}
                            >
                              <Plus className="h-3 w-3" />
                              <span className="group-data-[collapsible=icon]:hidden">
                                {addChildLabel}
                              </span>
                            </Button>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
              <Button
                variant="ghost"
                className="w-full justify-start h-6 px-2 text-sm mt-0.5"
                onClick={onAddParent}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">{addParentLabel}</span>
              </Button>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
