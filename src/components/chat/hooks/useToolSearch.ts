import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchAllTools } from '@/app/actions/tools';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import type { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';

interface UseToolSearchOptions {
  query: string;
  selectedCategories: ReferenceCategory[];
  selectedApps: string[];
  connectedOnly: boolean;
  requiresConnection: boolean | undefined;
  showReferenceTools: boolean;
  toolCategories?: string[]; // Filter by tool categories (e.g., ['apps'] for Pipedream tools only)
  isOpen: boolean;
  isClient: boolean;
}

/**
 * Hook to manage tool search with infinite scroll
 * Handles initial search, load more, and result state
 */
export function useToolSearch(options: UseToolSearchOptions) {
  const {
    query,
    selectedCategories,
    selectedApps,
    connectedOnly,
    requiresConnection,
    showReferenceTools,
    toolCategories,
    isOpen,
    isClient,
  } = options;

  const [allTools, setAllTools] = useState<ToolDTO[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Initial search query (resets on filter change)
  const {
    data: initialSearchResult,
    isLoading,
    error
  } = useQuery({
    queryKey: ['search-all-tools-initial', query, selectedCategories, selectedApps, connectedOnly, requiresConnection, showReferenceTools, toolCategories],
    queryFn: async () => {
      const categories = selectedCategories.length > 0 ? selectedCategories : undefined;
      const appIds = selectedApps.length > 0 ? selectedApps : undefined;

      const result = await searchAllTools({
        query,
        categories,
        appIds,
        connectedOnly,
        ...(requiresConnection !== undefined && { requiresConnection }),
        showReferenceTools,
        ...(toolCategories && toolCategories.length > 0 && { toolCategories }),
        limit: 20,
        offset: 0
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: isOpen && isClient,
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
    if (isLoadingMore || !hasMore || !isClient) return;

    setIsLoadingMore(true);
    try {
      const categories = selectedCategories.length > 0 ? selectedCategories : undefined;
      const appIds = selectedApps.length > 0 ? selectedApps : undefined;

      const result = await searchAllTools({
        query,
        categories,
        appIds,
        connectedOnly,
        ...(requiresConnection !== undefined && { requiresConnection }),
        showReferenceTools,
        ...(toolCategories && toolCategories.length > 0 && { toolCategories }),
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
      console.error('[useToolSearch] Error loading more tools:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, isClient, query, selectedCategories, selectedApps, connectedOnly, requiresConnection, showReferenceTools, toolCategories, offset]);

  return {
    allTools,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMoreTools,
  };
}
