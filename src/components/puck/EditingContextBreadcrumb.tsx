'use client';

/**
 * EditingContextBreadcrumb - Shows the current editing stack for nested content
 *
 * AIDEV-NOTE: This component displays a breadcrumb trail for nested editing contexts.
 * Shows: Page > Dialog "Login" > DataBlock "Products" > DataBlock "Reviews"
 * Separate from ComponentBreadcrumb which shows selection within current Puck editor.
 */

import React, { Fragment } from 'react';
import { ChevronRight, FileText, MessageSquare, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditingContextItem } from './types/editing-context';

interface EditingContextBreadcrumbProps {
  stack: EditingContextItem[];
  onNavigate: (index: number) => void;
}

/**
 * Get the icon for an editing context item
 */
function getItemIcon(item: EditingContextItem) {
  switch (item.type) {
    case 'page':
      return <FileText className="h-3.5 w-3.5" />;
    case 'dialog':
      return <MessageSquare className="h-3.5 w-3.5" />;
    case 'datablock':
      return <Database className="h-3.5 w-3.5" />;
  }
}

/**
 * Get the display label for an editing context item
 */
function getItemLabel(item: EditingContextItem): string {
  switch (item.type) {
    case 'page':
      return 'Page';
    case 'dialog':
      return item.dialogName;
    case 'datablock':
      return item.name;
    default: {
      // Exhaustive check - this should never happen
      const _exhaustive: never = item;
      return String(_exhaustive);
    }
  }
}

/**
 * EditingContextBreadcrumb - Renders the editing stack as a clickable breadcrumb
 */
export function EditingContextBreadcrumb({ stack, onNavigate }: EditingContextBreadcrumbProps) {
  // Don't show if we're just at page level (no nesting)
  if (stack.length <= 1) {
    return null;
  }

  return (
    <div className="bg-purple-100 dark:bg-purple-900/30 border-b border-purple-300 dark:border-purple-700 px-4 py-2 flex items-center gap-1.5 shrink-0">
      {stack.map((item, index) => {
        const isLast = index === stack.length - 1;
        const isClickable = !isLast;

        return (
          <Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-purple-400 dark:text-purple-500" />
            )}
            <button
              onClick={() => isClickable && onNavigate(index)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-1.5 text-sm px-2 py-0.5 rounded transition-colors",
                isLast
                  ? "font-medium text-purple-800 dark:text-purple-200 cursor-default"
                  : "text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/50 hover:text-purple-800 dark:hover:text-purple-200"
              )}
            >
              {getItemIcon(item)}
              <span>{getItemLabel(item)}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

export default EditingContextBreadcrumb;
