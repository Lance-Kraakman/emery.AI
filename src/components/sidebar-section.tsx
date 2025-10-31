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
}: SidebarSectionProps<T>) {
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
              {items.map((item) => (
                <SidebarMenuItem key={getItemKey(item)}>
                  <SidebarMenuButton asChild isActive={isItemActive(item, pathname)} className="h-6">
                    <Link href={getItemHref(item)}>
                      <span className="group-data-[collapsible=icon]:hidden">
                        {getItemName(item)}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
