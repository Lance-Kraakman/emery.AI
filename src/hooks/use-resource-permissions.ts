'use client'

import { useEffect, useState } from 'react';
import { checkResourcePermissions, type ResourcePermissionCheck } from '@/app/actions/permissions';

/**
 * Hook to check multiple resource permissions at once
 *
 * @param checks - Array of permission checks with permission, resourceType, and optional resourceId
 * @returns Object containing array of permission results, isLoading state, and error
 *
 * @example
 * ```tsx
 * function ResourceActions({ appId }: { appId: number }) {
 *   const { permissions, isLoading } = useResourcePermissions([
 *     { permission: "apps:view", resourceType: "app", resourceId: appId },
 *     { permission: "apps:manage", resourceType: "app", resourceId: appId },
 *     { permission: "apps:publish", resourceType: "app", resourceId: appId },
 *   ]);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   const [canView, canManage, canPublish] = permissions;
 *
 *   return (
 *     <>
 *       {canView && <ViewButton />}
 *       {canManage && <EditButton />}
 *       {canPublish && <PublishButton />}
 *     </>
 *   );
 * }
 * ```
 */
export function useResourcePermissions(checks: ResourcePermissionCheck[]) {
  const [permissions, setPermissions] = useState<boolean[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkPerms() {
      if (!checks || checks.length === 0) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await checkResourcePermissions(checks);

        if (cancelled) return;

        if (result.success) {
          setPermissions(result.data ?? []);
        } else {
          setError(result.error ?? 'Failed to check resource permissions');
          setPermissions([]);
        }
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : 'Unknown error');
        setPermissions([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkPerms();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(checks)]); // Use JSON.stringify for array comparison

  return { permissions, isLoading, error };
}
