'use client';

/**
 * PageDialogsRenderer - Renders page-level dialogs controlled by state
 *
 * AIDEV-NOTE: This component renders all dialogs defined in pageDialogs config.
 * Each dialog is controlled by a boolean state variable.
 */

import React from 'react';
import { Render, type Data as PuckData } from '@measured/puck';
import { config } from '@/components/puck/config';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useBooleanState, useStateContext } from '../contexts/StateContext';
import { useValueResolutionContext } from '../hooks/useResolveValue';
import { interpolateText } from '../utils/text-interpolation';
import type { PageDialog, PageDialogsConfig, DialogSize } from '@/ddd/domain/puck/value-objects/page-dialogs';

interface PageDialogsRendererProps {
  pageDialogs?: PageDialogsConfig;
  children: React.ReactNode;
}

/**
 * Map dialog size to CSS class
 * All sizes include max-height to prevent viewport overflow
 */
function getSizeClass(size: DialogSize): string {
  const baseClass = 'max-h-[90vh] overflow-hidden flex flex-col';
  switch (size) {
    case 'sm': return `sm:max-w-sm ${baseClass}`;
    case 'md': return `sm:max-w-md ${baseClass}`;
    case 'lg': return `sm:max-w-lg ${baseClass}`;
    case 'xl': return `sm:max-w-xl ${baseClass}`;
    case 'full': return `sm:max-w-[90vw] sm:h-[90vh] ${baseClass}`;
    default: return `sm:max-w-md ${baseClass}`;
  }
}

/**
 * Individual dialog renderer
 */
function PageDialogRenderer({ dialog }: { dialog: PageDialog }) {
  const isOpen = useBooleanState(dialog.stateKey);
  const stateContext = useStateContext();
  const resolutionContext = useValueResolutionContext();

  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    if (!open && stateContext) {
      stateContext.setValueWithUrlSync(dialog.stateKey, false);
    }
  };

  // Interpolate title and description
  const title = interpolateText(dialog.title, resolutionContext);
  const description = dialog.description
    ? interpolateText(dialog.description, resolutionContext)
    : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={getSizeClass(dialog.size)}
        onPointerDownOutside={(e) => {
          if (!dialog.closeOnOutsideClick) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!dialog.closeOnEscape) {
            e.preventDefault();
          }
        }}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}

        {/* Render Puck content - with overflow handling */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <Render config={config} data={dialog.content as PuckData} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * PageDialogsRenderer - Wraps page content and renders dialogs
 */
export function PageDialogsRenderer({ pageDialogs, children }: PageDialogsRendererProps) {
  // If no dialogs config, just render children
  if (!pageDialogs?.dialogs?.length) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Render all dialogs */}
      {pageDialogs.dialogs.map((dialog) => (
        <PageDialogRenderer key={dialog.id} dialog={dialog} />
      ))}
    </>
  );
}

export default PageDialogsRenderer;
