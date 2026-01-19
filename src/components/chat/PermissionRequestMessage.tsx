'use client'

import React from 'react'
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PermissionRequestEvent } from '@/lib/chat/types/sse-events'

interface PermissionRequestMessageProps {
  permissionRequest: PermissionRequestEvent
  onAllow: () => void
  onDeny: () => void
  disabled?: boolean
}

/**
 * PermissionRequestMessage - Inline permission request UI
 *
 * Displayed when the agent encounters a permission error (RBAC 403)
 * in interactive mode. Shows the required permission and allows the
 * user to grant or deny access.
 *
 * AIDEV-NOTE: This component renders in the chat area when a tool
 * receives a 403 permission error from the API. The Python agent layer
 * emits a permission_request event which triggers this UI.
 */
export function PermissionRequestMessage({
  permissionRequest,
  onAllow,
  onDeny,
  disabled = false,
}: PermissionRequestMessageProps) {
  const {
    permission,
    resource,
    resourceId,
    action,
    context,
  } = permissionRequest

  // Format permission for display
  const formatPermission = (perm: string) => {
    return perm.replace(/_/g, ' ').replace(/:/g, ' > ')
  }

  // Build resource description
  const resourceDescription = resourceId
    ? `${resource} #${resourceId}`
    : resource || 'this resource'

  return (
    <div className={cn(
      "flex flex-col gap-3 p-4 rounded-lg border",
      "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
      disabled && "opacity-50 pointer-events-none"
    )}>
      {/* Header with icon */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h4 className="font-medium text-amber-900 dark:text-amber-100">
          Permission Required
        </h4>
      </div>

      {/* Context description */}
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {context || `Agent needs permission to continue.`}
      </p>

      {/* Permission details */}
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-amber-700 dark:text-amber-300">Required permission:</span>
          <code className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-mono">
            {formatPermission(permission)}
          </code>
        </div>
        {(resource || resourceId) && (
          <div className="flex items-center gap-2">
            <span className="text-amber-700 dark:text-amber-300">Resource:</span>
            <span className="text-amber-900 dark:text-amber-100">
              {resourceDescription}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="default"
          size="sm"
          onClick={onAllow}
          disabled={disabled}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <ShieldCheck className="h-4 w-4 mr-1" />
          Allow Access
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDeny}
          disabled={disabled}
          className="border-amber-300 dark:border-amber-700"
        >
          <ShieldX className="h-4 w-4 mr-1" />
          Deny
        </Button>
      </div>
    </div>
  )
}
