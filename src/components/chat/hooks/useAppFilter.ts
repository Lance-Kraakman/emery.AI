import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAvailableApps } from '@/app/actions/connections';

/**
 * Hook to manage app filter dropdown state
 * Handles app search, selection, and available apps loading
 */
export function useAppFilter() {
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [showAppDropdown, setShowAppDropdown] = useState(false);

  // Load available apps
  const {
    data: availableApps,
    isLoading: isLoadingApps,
  } = useQuery({
    queryKey: ['available-apps'],
    queryFn: async () => {
      const result = await getAvailableApps();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - apps don't change often
    retry: 1,
  });

  // Filter apps based on search query
  const filteredApps = useMemo(() => {
    if (!availableApps) return [];
    if (!appSearchQuery.trim()) return availableApps;

    const searchLower = appSearchQuery.toLowerCase();
    return availableApps.filter(app =>
      app.name.toLowerCase().includes(searchLower) ||
      app.id.toLowerCase().includes(searchLower)
    );
  }, [availableApps, appSearchQuery]);

  return {
    appSearchQuery,
    setAppSearchQuery,
    showAppDropdown,
    setShowAppDropdown,
    availableApps,
    filteredApps,
    isLoadingApps,
  };
}
