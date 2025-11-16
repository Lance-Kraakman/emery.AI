'use client'

import { useEffect, useState } from 'react';
import { checkResourcePermission } from '@/app/actions/permissions';

/**
 * Hook to check if the current user has a specific permission on a resource
 *
 * @param permission - Permission string (e.g., "apps:manage", "agents:execute")
 * @param resourceType - Type of resource ("app", "agent", "database", etc.)
 * @param resourceId - Optional specific resource ID (omit for scoped permissions)
 * @returns Object containing hasPermission boolean and isLoading state
 *
 * @example
 * ```tsx
 * function EditAppButton({ appId }: { appId: number }) {
 *   const { hasPermission, isLoading } = useResourcePermission(
 *     "apps:manage",
 *     "app",
 *     appId
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (!hasPermission) return null;
 *
 *   return <Button>Edit App</Button>;
 * }
 * ```
 */
export function useResourcePermission(
  permission: string,
  resourceType: string,
  resourceId?: number
) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkPerm() {
      if (!permission || !resourceType) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await checkResourcePermission(
          permission,
          resourceType,
          resourceId
        );

        if (cancelled) return;

        if (result.success) {
          setHasPermission(result.data ?? false);
        } else {
          setError(result.error ?? 'Failed to check resource permission');
          setHasPermission(false);
        }
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : 'Unknown error');
        setHasPermission(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkPerm();

    return () => {
      cancelled = true;
    };
  }, [permission, resourceType, resourceId]);

  return { hasPermission, isLoading, error };
}
