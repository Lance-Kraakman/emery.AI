"use client"

import React from "react"
import { MoreVertical, Edit, Copy, Trash2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShareButton } from "@/components/permissions/ShareButton"

export interface SidebarItemActionsProps {
  onRename?: () => void
  onDuplicate?: () => void
  onShare?: () => void
  onDelete?: () => void
  className?: string
  // Props for ShareButton when using resource-specific sharing
  shareResourceType?: string
  shareResourceId?: number
}

/**
 * Reusable dropdown menu for sidebar item actions (rename, duplicate, share, delete)
 * Shows a "..." button that appears on hover
 */
export function SidebarItemActions({
  onRename,
  onDuplicate,
  onShare,
  onDelete,
  className = "",
  shareResourceType,
  shareResourceId
}: SidebarItemActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
          aria-label="Item actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onRename && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
            <Edit className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
        )}
        {onShare && shareResourceType && shareResourceId ? (
          <div className="px-1 py-0.5">
            <ShareButton
              resourceType={shareResourceType}
              resourceId={shareResourceId}
              onShare={() => onShare()}
              variant="ghost"
              size="icon"
            />
          </div>
        ) : onShare ? (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
        ) : null}
        {(onRename || onDuplicate || onShare) && onDelete && <DropdownMenuSeparator />}
        {onDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
