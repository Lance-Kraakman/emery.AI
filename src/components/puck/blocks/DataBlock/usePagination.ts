'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { executeView } from '@/app/actions/views';

interface UsePaginationOptions {
  viewId: number;
  initialRows: Record<string, unknown>[];
  totalCount: number;
  pageSize: number;
}

/**
 * Hook for managing pagination state in DataBlock
 *
 * Encapsulates all pagination logic including:
 * - Page navigation (fetchPage)
 * - Load more (append rows)
 * - Loading states via useTransition
 *
 * Uses server action directly instead of API route.
 */
export function usePagination({
  viewId,
  initialRows,
  totalCount,
  pageSize,
}: UsePaginationOptions) {
  const [displayedRows, setDisplayedRows] = useState(initialRows);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasMore = displayedRows.length < totalCount;

  // Reset when initial data changes (view selection, etc)
  useEffect(() => {
    setDisplayedRows(initialRows);
    setCurrentPage(1);
  }, [initialRows]);

  // Fetch specific page (replaces current rows)
  const fetchPage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;

      startTransition(async () => {
        const offset = (page - 1) * pageSize;
        const result = await executeView(viewId, undefined, {
          pageSize,
          offset,
        });
        if (result?.rows) {
          setDisplayedRows(result.rows);
          setCurrentPage(page);
        }
      });
    },
    [viewId, pageSize, totalPages]
  );

  // Load more (appends to current rows)
  const loadMore = useCallback(() => {
    if (!hasMore) return;

    startTransition(async () => {
      const nextPage = currentPage + 1;
      const offset = currentPage * pageSize; // Current page count * size = next offset
      const result = await executeView(viewId, undefined, { pageSize, offset });
      if (result?.rows) {
        setDisplayedRows((prev) => [...prev, ...result.rows]);
        setCurrentPage(nextPage);
      }
    });
  }, [viewId, pageSize, currentPage, hasMore]);

  return {
    displayedRows,
    currentPage,
    totalPages,
    isLoading: isPending,
    hasMore,
    fetchPage,
    loadMore,
  };
}
