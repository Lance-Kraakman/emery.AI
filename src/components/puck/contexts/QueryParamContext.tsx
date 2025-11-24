'use client';

/**
 * QueryParamContext - Provides query parameters to Puck blocks
 *
 * Query params are extracted from the URL and made available to all blocks
 * within the Puck editor. This enables blocks to access page-level context
 * like userId, tab, filter, etc.
 *
 * Usage:
 * - Wrap Puck editor with QueryParamProvider
 * - Access params in blocks via useQueryParams() hook
 */

import { createContext, useContext, ReactNode } from 'react';

export type QueryParams = Record<string, string | number | boolean | string[] | undefined>;

const QueryParamContext = createContext<QueryParams>({});

export function QueryParamProvider({
  children,
  params
}: {
  children: ReactNode;
  params: QueryParams;
}) {
  return (
    <QueryParamContext.Provider value={params}>
      {children}
    </QueryParamContext.Provider>
  );
}

export function useQueryParams(): QueryParams {
  const context = useContext(QueryParamContext);
  if (context === undefined) {
    throw new Error('useQueryParams must be used within QueryParamProvider');
  }
  return context;
}

/**
 * Type-safe query param getter with default value
 */
export function useQueryParam<T = string>(
  key: string,
  defaultValue?: T
): T | undefined {
  const params = useQueryParams();
  return (params[key] as T) ?? defaultValue;
}
