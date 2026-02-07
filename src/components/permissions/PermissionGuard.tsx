'use client'

import React from 'react'
import { usePermission } from '@/hooks/use-permission'
import { usePermissions } from '@/hooks/use-permissions'
import { useResourcePermission } from '@/hooks/use-resource-permission'
import { useResourcePermissions } from '@/hooks/use-resource-permissions'
import { Loading } from '@/components/ui/loading'
import type { ResourcePermissionCheck } from '@/app/actions/permissions'

interface PermissionGuardProps {
  permission?: string
  permissions?: string[]
  resourcePermission?: {
    permission: string
    resourceType: string
    resourceId?: number
  }
  resourcePermissions?: ResourcePermissionCheck[]
  children: React.ReactNode
  fallback?: React.ReactNode
  loadingComponent?: React.ReactNode
  requireAll?: boolean // For multiple permissions, require all (true) or any (false)
}

/**
 * PermissionGuard - Standardized permission checker wrapper component
 * 
 * Provides consistent permission checking across the UI with proper loading states
 * and fallback rendering. Supports single permissions, multiple permissions,
 * and resource-specific permissions.
 * 
 * @example
 * ```tsx
 * // Single permission
 * <PermissionGuard permission="agents:manage">
 *   <EditAgentButton />
 * </PermissionGuard>
 * 
 * // Multiple permissions (require all)
 * <PermissionGuard 
 *   permissions={["apps:view", "apps:manage"]} 
 *   requireAll={true}
 * >
 *   <AppManagementPanel />
 * </PermissionGuard>
 * 
 * // Multiple permissions (require any)
 * <PermissionGuard 
 *   permissions={["apps:view", "apps:publish"]} 
 *   requireAll={false}
 * >
 *   <AppActions />
 * </PermissionGuard>
 * 
 * // Resource-specific permission
 * <PermissionGuard 
 *   resourcePermission={{
 *     permission: "apps:manage",
 *     resourceType: "app",
 *     resourceId: appId
 *   }}
 * >
 *   <EditAppButton />
 * </PermissionGuard>
 * 
 * // Multiple resource permissions
 * <PermissionGuard 
 *   resourcePermissions={[
 *     { permission: "apps:view", resourceType: "app", resourceId: appId },
 *     { permission: "apps:manage", resourceType: "app", resourceId: appId }
 *   ]}
 *   requireAll={true}
 * >
 *   <AppFullAccess />
 * </PermissionGuard>
 * 
 * // Custom fallback
 * <PermissionGuard 
 *   permission="apps:manage"
 *   fallback={<LockedMessage message="You don't have permission to manage this app" />}
 * >
 *   <AppSettings />
 * </PermissionGuard>
 * ```
 */
// Internal components to handle each permission type separately (hooks rules compliant)
function SinglePermissionGuard({
  permission,
  children,
  fallback,
  loadingComponent
}: {
  permission: string
  children: React.ReactNode
  fallback: React.ReactNode
  loadingComponent: React.ReactNode
}) {
  const { hasPermission, isLoading } = usePermission(permission)

  if (isLoading) return <>{loadingComponent}</>
  if (!hasPermission) return <>{fallback}</>
  return <>{children}</>
}

function MultiPermissionGuard({
  permissions,
  children,
  fallback,
  loadingComponent,
  requireAll
}: {
  permissions: string[]
  children: React.ReactNode
  fallback: React.ReactNode
  loadingComponent: React.ReactNode
  requireAll: boolean
}) {
  const { permissions: permResults, isLoading } = usePermissions(permissions)

  if (isLoading) return <>{loadingComponent}</>

  const hasRequiredPerms = requireAll
    ? permissions.every((perm: string) => permResults[perm])
    : permissions.some((perm: string) => permResults[perm])

  if (!hasRequiredPerms) return <>{fallback}</>
  return <>{children}</>
}

function SingleResourcePermissionGuard({
  resourcePermission,
  children,
  fallback,
  loadingComponent
}: {
  resourcePermission: { permission: string; resourceType: string; resourceId?: number }
  children: React.ReactNode
  fallback: React.ReactNode
  loadingComponent: React.ReactNode
}) {
  const { hasPermission, isLoading } = useResourcePermission(
    resourcePermission.permission,
    resourcePermission.resourceType,
    resourcePermission.resourceId
  )

  if (isLoading) return <>{loadingComponent}</>
  if (!hasPermission) return <>{fallback}</>
  return <>{children}</>
}

function MultiResourcePermissionGuard({
  resourcePermissions,
  children,
  fallback,
  loadingComponent,
  requireAll
}: {
  resourcePermissions: ResourcePermissionCheck[]
  children: React.ReactNode
  fallback: React.ReactNode
  loadingComponent: React.ReactNode
  requireAll: boolean
}) {
  const { permissions: permResults, isLoading } = useResourcePermissions(resourcePermissions)

  if (isLoading) return <>{loadingComponent}</>

  const hasRequiredPerms = requireAll
    ? permResults.every((perm: boolean) => perm)
    : permResults.some((perm: boolean) => perm)

  if (!hasRequiredPerms) return <>{fallback}</>
  return <>{children}</>
}

export function PermissionGuard({
  permission,
  permissions,
  resourcePermission,
  resourcePermissions,
  children,
  fallback = null,
  loadingComponent = <Loading text="Checking permissions..." />,
  requireAll = true
}: PermissionGuardProps) {
  // Route to the appropriate internal component based on which prop is provided
  if (permission) {
    return (
      <SinglePermissionGuard
        permission={permission}
        fallback={fallback}
        loadingComponent={loadingComponent}
      >
        {children}
      </SinglePermissionGuard>
    )
  }

  if (permissions && permissions.length > 0) {
    return (
      <MultiPermissionGuard
        permissions={permissions}
        fallback={fallback}
        loadingComponent={loadingComponent}
        requireAll={requireAll}
      >
        {children}
      </MultiPermissionGuard>
    )
  }

  if (resourcePermission) {
    return (
      <SingleResourcePermissionGuard
        resourcePermission={resourcePermission}
        fallback={fallback}
        loadingComponent={loadingComponent}
      >
        {children}
      </SingleResourcePermissionGuard>
    )
  }

  if (resourcePermissions && resourcePermissions.length > 0) {
    return (
      <MultiResourcePermissionGuard
        resourcePermissions={resourcePermissions}
        fallback={fallback}
        loadingComponent={loadingComponent}
        requireAll={requireAll}
      >
        {children}
      </MultiResourcePermissionGuard>
    )
  }

  // No permission checks specified, render children
  return <>{children}</>
}

/**
 * Higher-order component for wrapping components with permission checks
 * 
 * @example
 * ```tsx
 * const ProtectedEditButton = withPermission(EditButton, "apps:manage")
 * const ProtectedResourceButton = withResourcePermission(DeleteButton, "apps:delete", "app")
 * ```
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string,
  fallback?: React.ReactNode
) {
  return function WithPermissionComponent(props: P) {
    return (
      <PermissionGuard permission={permission} fallback={fallback}>
        <Component {...props} />
      </PermissionGuard>
    )
  }
}

export function withResourcePermission<P extends object & { resourceId?: number }>(
  Component: React.ComponentType<P>,
  permission: string,
  resourceType: string,
  fallback?: React.ReactNode
) {
  return function WithResourcePermissionComponent(props: P) {
    const { resourceId, ...restProps } = props
    
    return (
      <PermissionGuard
        resourcePermission={{
          permission,
          resourceType,
          resourceId
        }}
        fallback={fallback}
      >
        <Component {...(restProps as P)} />
      </PermissionGuard>
    )
  }
}