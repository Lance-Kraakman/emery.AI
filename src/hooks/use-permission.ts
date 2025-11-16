'use client'

import { useEffect, useState } from 'react';
import { checkPermission } from '@/app/actions/permissions';

/**
 * Hook to check if the current user has a specific organization-level permission
 *
 * @param permission - Permission string (e.g., "agents:manage", "apps:view")
 * @returns Object containing hasPermission boolean and isLoading state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { hasPermission, isLoading } = usePermission("agents:manage");
 *
 *   if (isLoading) return <Spinner />;
 *   if (!hasPermission) return null;
 *
 *   return <EditButton />;
 * }
 * ```
 */
export function usePermission(permission: string) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkPerm() {
      if (!permission) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await checkPermission(permission);

        if (cancelled) return;

        if (result.success) {
          setHasPermission(result.data ?? false);
        } else {
          setError(result.error ?? 'Failed to check permission');
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
  }, [permission]);

  return { hasPermission, isLoading, error };
}
