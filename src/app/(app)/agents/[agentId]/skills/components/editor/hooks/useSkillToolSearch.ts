import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPipedreamTools, type PipedreamToolMetadata } from '@/app/actions/tools';

interface UseSkillToolSearchOptions {
  query: string;
  selectedApps: string[];
  connectedOnly: boolean;
  isOpen: boolean;
}

/**
 * Hook to manage Pipedream tool search with infinite scroll
 * Similar to useToolSearch but specifically for Pipedream/app tools
 */
export function useSkillToolSearch(options: UseSkillToolSearchOptions) {
  const {
    query,
    selectedApps,
    connectedOnly,
    isOpen,
  } = options;

  const [allTools, setAllTools] = useState<PipedreamToolMetadata[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Initial search query (resets on filter change)
  const {
    data: initialSearchResult,
    isLoading,
    error
  } = useQuery({
    queryKey: ['search-pipedream-tools-initial', query, selectedApps, connectedOnly],
    queryFn: async () => {
      const result = await searchPipedreamTools({
        query,
        appIds: selectedApps.length > 0 ? selectedApps : undefined,
        connectedOnly,
        limit: 20,
        offset: 0
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: isOpen,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });

  // Reset tools and state when initial search result changes
  useEffect(() => {
    if (initialSearchResult) {
      setAllTools(initialSearchResult.tools || []);
      setHasMore(initialSearchResult.hasMore || false);
      setOffset(initialSearchResult.tools?.length || 0);
    }
  }, [initialSearchResult]);

  // Load more tools function
  const loadMoreTools = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const result = await searchPipedreamTools({
        query,
        appIds: selectedApps.length > 0 ? selectedApps : undefined,
        connectedOnly,
        limit: 20,
        offset
      });

      if (result.success && result.data) {
        const newTools = result.data.tools || [];
        setAllTools(prev => [...prev, ...newTools]);
        setHasMore(result.data.hasMore || false);
        setOffset(prev => prev + newTools.length);
      }
    } catch (error) {
      console.error('[useSkillToolSearch] Error loading more tools:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, query, selectedApps, connectedOnly, offset]);

  return {
    allTools,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMoreTools,
  };
}
