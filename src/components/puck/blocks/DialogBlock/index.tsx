'use client';

/**
 * DialogBlock - A modal dialog controlled by page state
 *
 * AIDEV-NOTE: Uses flat namespace for state - no containers.
 * The dialog's open/close state is controlled by a UI flag.
 *
 * Editor UX: DataBlock-style template editing
 * - Content hidden by default in editor
 * - Click "Edit" to show drop zone
 * - Click "Preview" to see actual dialog
 */

import React, { useState, useEffect, useReducer, useMemo, useRef, type ComponentType } from 'react';
import { ComponentConfig, registerOverlayPortal } from '@measured/puck';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStateContext } from '../../contexts/StateContext';
import { useLinkContext } from '../../contexts/PageContext';
import { useInterpolatedText } from '../../hooks/useInterpolatedText';
import { createVariableTextField, createStateKeyField } from '../../custom-fields';
import { MessageSquare, Pencil, Check, Eye } from 'lucide-react';

/**
 * Dialog size options
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * DialogBlock Props
 */
export interface DialogBlockProps {
  /** UI flag key that controls open/close (flat namespace) */
  stateKey: string;
  /** Dialog title (supports variable interpolation) */
  title?: string;
  /** Dialog description (supports variable interpolation) */
  description?: string;
  /** Dialog size */
  size: DialogSize;
  /** Whether clicking outside closes the dialog */
  closeOnOutsideClick: boolean;
  /** Whether pressing escape closes the dialog */
  closeOnEscape: boolean;
  /** Child content for the dialog body */
  children?: ComponentType<{
    className?: string;
    allow?: string[];
    disallow?: string[];
  }>;
}

/**
 * Get dialog content class based on size
 */
function getDialogSizeClass(size: DialogSize): string {
  switch (size) {
    case 'sm':
      return 'max-w-sm';
    case 'md':
      return 'max-w-md';
    case 'lg':
      return 'max-w-lg';
    case 'xl':
      return 'max-w-xl';
    case 'full':
      return 'max-w-[90vw] max-h-[90vh]';
    default:
      return 'max-w-lg';
  }
}

/**
 * DialogBlock - A modal dialog controlled by page state
 *
 * The dialog's open/close state is controlled by a UI flag.
 * Use toggleUIFlag or setUIFlag actions to open/close the dialog.
 *
 * In editor mode: Shows as collapsible template (like DataBlock)
 * At runtime: Renders as actual modal dialog
 *
 * @example
 * ```tsx
 * // Define showModal UI flag in Page State config
 * // Then use it in DialogBlock:
 * <Button onClick={{ type: "toggleUIFlag", key: "showModal" }}>
 *   Open Dialog
 * </Button>
 * <DialogBlock
 *   stateKey="showModal"
 *   title="My Dialog"
 *   description="This is a modal dialog"
 * >
 *   {children}
 * </DialogBlock>
 * ```
 */
function DialogBlockComponent({
  stateKey,
  title,
  description,
  size,
  closeOnOutsideClick,
  closeOnEscape,
  children: Children,
}: DialogBlockProps) {
  const stateContext = useStateContext();

  // Get editing context from page context
  const { isEditing } = useLinkContext();

  // Editor state: editing content vs preview mode
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Refs for overlay portals (interactive buttons in editor)
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes
  useEffect(() => {
    if (!stateContext) return;
    const unsubscribe = stateContext.subscribe(forceUpdate);
    return unsubscribe;
  }, [stateContext]);

  // Register overlay portals for interactive buttons
  useEffect(() => {
    if (!isEditing) return;
    if (editButtonRef.current && !isEditingContent) {
      registerOverlayPortal(editButtonRef.current);
    }
    if (doneButtonRef.current && isEditingContent) {
      registerOverlayPortal(doneButtonRef.current);
    }
    if (previewButtonRef.current) {
      registerOverlayPortal(previewButtonRef.current);
    }
  }, [isEditing, isEditingContent]);

  // Get the current open state
  const isOpen = useMemo(() => {
    if (!stateContext || !stateKey) return false;
    return stateContext.getUIFlag(stateKey);
  }, [stateContext, stateKey]);

  // Handle open change (when dialog is closed via X button, outside click, or escape)
  const handleOpenChange = (open: boolean) => {
    if (!stateContext || !stateKey) return;
    stateContext.setUIFlag(stateKey, open);
  };

  // Interpolate title and description
  const interpolatedTitle = useInterpolatedText(title || '');
  const interpolatedDescription = useInterpolatedText(description || '');

  // Handle pointer down on overlay (for closeOnOutsideClick)
  const handlePointerDownOutside = (e: Event) => {
    if (!closeOnOutsideClick) {
      e.preventDefault();
    }
  };

  // Handle escape key (for closeOnEscape)
  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    if (!closeOnEscape) {
      e.preventDefault();
    }
  };

  // Get size class
  const sizeClass = getDialogSizeClass(size);

  const hasContent = Children !== undefined;

  // Editor mode: DataBlock-style template editing
  if (isEditing) {
    // No content yet - show "Edit Dialog Content" button
    if (!hasContent && !isEditingContent) {
      return (
        <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 min-h-[120px] flex flex-col items-center justify-center gap-2 bg-purple-50/30">
          <div className="flex items-center gap-2 text-sm text-purple-700 font-medium">
            <MessageSquare className="h-4 w-4" />
            Dialog: {stateKey ? `{${stateKey}}` : '(no UI flag)'}
          </div>
          <Button
            ref={editButtonRef}
            onClick={() => setIsEditingContent(true)}
            variant="secondary"
            size="sm"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Dialog Content
          </Button>
        </div>
      );
    }

    // Has content, preview mode - show placeholder with Edit/Preview buttons
    if (!isEditingContent) {
      return (
        <div className="border-2 border-dashed border-purple-300 rounded-lg overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between p-2 bg-purple-50 border-b border-purple-200">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">
                {interpolatedTitle || 'Dialog'}
              </span>
              {stateKey && (
                <Badge variant="outline" className="text-xs font-mono">
                  {stateKey}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {size}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                ref={previewButtonRef}
                onClick={() => setIsPreviewOpen(true)}
                variant="ghost"
                size="sm"
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                ref={editButtonRef}
                onClick={() => setIsEditingContent(true)}
                variant="secondary"
                size="sm"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>

          {/* Collapsed state info */}
          <div className="p-4 text-center text-sm text-muted-foreground">
            Dialog content hidden in editor. Click Edit to modify or Preview to see.
          </div>

          {/* Preview dialog */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className={sizeClass}>
              {(interpolatedTitle || interpolatedDescription) && (
                <DialogHeader>
                  {interpolatedTitle && (
                    <DialogTitle>{interpolatedTitle}</DialogTitle>
                  )}
                  {interpolatedDescription && (
                    <DialogDescription>{interpolatedDescription}</DialogDescription>
                  )}
                </DialogHeader>
              )}
              <div className="py-4">
                {Children ? <Children /> : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // Editing mode - show drop zone with Done button
    return (
      <div className="border-2 border-dashed border-purple-300 rounded-lg overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between p-2 bg-purple-50 border-b border-purple-200">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">
              {interpolatedTitle || 'Dialog'}
            </span>
            {stateKey && (
              <Badge variant="outline" className="text-xs font-mono">
                {stateKey}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {size}
            </Badge>
          </div>
          <Button
            ref={doneButtonRef}
            onClick={() => setIsEditingContent(false)}
            size="sm"
          >
            <Check className="h-4 w-4 mr-1" />
            Done
          </Button>
        </div>

        {/* Content editing area */}
        <div className="p-4 bg-purple-50/30">
          <div className="text-xs text-muted-foreground mb-2">
            Dialog Content (renders as popup at runtime)
          </div>
          <div className="border rounded-lg bg-white p-4 shadow-sm min-h-[100px]">
            {Children ? (
              <Children />
            ) : (
              <div className="text-muted-foreground text-sm py-6 text-center border-2 border-dashed rounded">
                Drop dialog content here
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Runtime: Actual dialog
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={sizeClass}
        onPointerDownOutside={handlePointerDownOutside}
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        {(interpolatedTitle || interpolatedDescription) && (
          <DialogHeader>
            {interpolatedTitle && (
              <DialogTitle>{interpolatedTitle}</DialogTitle>
            )}
            {interpolatedDescription && (
              <DialogDescription>{interpolatedDescription}</DialogDescription>
            )}
          </DialogHeader>
        )}
        <div className="py-4">
          {Children ? <Children /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * DialogBlock Puck configuration
 */
export const DialogBlock: ComponentConfig<DialogBlockProps> = {
  label: 'Dialog',
  fields: {
    stateKey: createStateKeyField({
      label: 'UI Flag',
      placeholder: 'Select a UI flag...',
      keyType: 'uiFlag',
    }),
    title: createVariableTextField({ label: 'Title' }),
    description: createVariableTextField({ label: 'Description', multiline: true }),
    size: {
      type: 'select',
      label: 'Size',
      options: [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
        { value: 'lg', label: 'Large' },
        { value: 'xl', label: 'Extra Large' },
        { value: 'full', label: 'Full Screen' },
      ],
    },
    closeOnOutsideClick: {
      type: 'radio',
      label: 'Close on Outside Click',
      options: [
        { value: true, label: 'Yes' },
        { value: false, label: 'No' },
      ],
    },
    closeOnEscape: {
      type: 'radio',
      label: 'Close on Escape',
      options: [
        { value: true, label: 'Yes' },
        { value: false, label: 'No' },
      ],
    },
    children: {
      type: 'slot',
    },
  },

  defaultProps: {
    stateKey: '',
    title: '',
    description: '',
    size: 'md',
    closeOnOutsideClick: true,
    closeOnEscape: true,
  },

  render: DialogBlockComponent,
};
