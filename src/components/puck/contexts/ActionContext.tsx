'use client';

/**
 * ActionContext
 *
 * Provides context for action execution in Puck elements.
 * Aggregates data from various sources (row data, form data, user, etc.)
 * to make available when actions are executed.
 *
 * AIDEV-NOTE: This context is used by the action executor to access
 * current state when executing actions from Button, Link, Form, etc.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useRowData } from './RowDataContext';
import { useLinkContext } from '../link-context';
import type { ActionContext as ActionContextType } from '../types/actions';

const ActionContext = createContext<Partial<ActionContextType>>({});

interface ActionProviderProps {
  children: ReactNode;
  userId?: string;
  pageId?: string;
  formData?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Provider component that wraps Puck render to provide action context
 * Should be placed at app/page level
 */
export function ActionProvider({
  children,
  userId,
  pageId,
  formData,
  metadata,
}: ActionProviderProps) {
  return (
    <ActionContext.Provider
      value={{
        userId,
        pageId,
        formData,
        metadata,
      }}
    >
      {children}
    </ActionContext.Provider>
  );
}

/**
 * Hook to build complete action context for execution
 *
 * Aggregates context from:
 * - ActionProvider (userId, pageId, formData, metadata)
 * - RowDataContext (current row data if in Repeat)
 * - Additional runtime context passed as argument
 *
 * @param runtimeContext - Additional context to merge (e.g., form data at submit time)
 * @returns Complete ActionContext for action execution
 *
 * @example
 * ```tsx
 * function MyButton({ actions }: { actions: Action[] }) {
 *   const buildContext = useActionContext();
 *
 *   const handleClick = async () => {
 *     const context = buildContext({ metadata: { source: 'button-click' } });
 *     await executeActions(actions, context);
 *   };
 *
 *   return <button onClick={handleClick}>Click</button>;
 * }
 * ```
 */
export function useActionContext() {
  const actionContext = useContext(ActionContext);
  const rowContext = useRowData();
  const linkContext = useLinkContext();

  console.log('[useActionContext] linkContext from useLinkContext:', {
    orgSlug: linkContext.orgSlug,
    appSlug: linkContext.appSlug,
    appId: linkContext.appId,
    pagesPresent: !!linkContext.pages,
    pagesType: linkContext.pages instanceof Map ? 'Map' : Array.isArray(linkContext.pages) ? 'Array' : typeof linkContext.pages,
  });

  return (runtimeContext?: Partial<ActionContextType>): ActionContextType => {
    return {
      ...actionContext,
      rowData: rowContext?.rowData ?? undefined,
      linkContext: {
        orgSlug: linkContext.orgSlug,
        appSlug: linkContext.appSlug,
        appId: linkContext.appId,
        pages: linkContext.pages,
        isEditing: linkContext.isEditing,
        isPreview: linkContext.isPreview,
      },
      ...runtimeContext,
    };
  };
}
