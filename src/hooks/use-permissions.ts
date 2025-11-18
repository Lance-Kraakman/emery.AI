'use client'

import { useEffect, useState } from 'react';
import { checkPermissions } from '@/app/actions/permissions';

/**
 * Hook to check multiple organization-level permissions at once
 *
 * @param permissions - Array of permission strings (e.g., ["agents:manage", "apps:view"])
 * @returns Object containing permissions Record, isLoading state, and error
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { permissions, isLoading } = usePermissions([
 *     "agents:manage",
 *     "apps:view",
 *     "teams:create"
 *   ]);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {permissions["agents:manage"] && <EditAgentButton />}
 *       {permissions["apps:view"] && <ViewAppsLink />}
 *       {permissions["teams:create"] && <CreateTeamButton />}
 *     </>
 *   );
 * }
 * ```
 */
export function usePermissions(permissionList: string[]) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkPerms() {
      if (!permissionList || permissionList.length === 0) {
        setPermissions({});
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await checkPermissions(permissionList);

        if (cancelled) return;

        if (result.success) {
          setPermissions(result.data ?? {});
        } else {
          setError(result.error ?? 'Failed to check permissions');
          setPermissions({});
        }
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : 'Unknown error');
        setPermissions({});
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
  }, [JSON.stringify(permissionList)]); // Use JSON.stringify for array comparison

  return { permissions, isLoading, error };
}
