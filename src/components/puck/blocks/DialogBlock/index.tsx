'use client';

import React, { useEffect, useReducer, useMemo, type ComponentType } from 'react';
import { ComponentConfig } from '@measured/puck';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useStateContext } from '../../contexts/StateContext';
import { useInterpolatedText } from '../../hooks/useInterpolatedText';
import {
  createStateContainerField,
  createStateKeyField,
  createVariableTextField,
} from '../../custom-fields';

/**
 * Dialog size options
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * DialogBlock Props
 */
export interface DialogBlockProps {
  /** State container name that controls the dialog */
  stateContainer: string;
  /** UI state key that controls open/close */
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
 * DialogBlock - A modal dialog controlled by StateBlock
 *
 * The dialog's open/close state is controlled by a UI state flag in a StateBlock.
 * Use toggleUIState or setUIState actions to open/close the dialog.
 *
 * @example
 * ```tsx
 * <StateBlock name="ui" uiState={[{ name: "showModal", defaultValue: false }]}>
 *   <Button onClick={{ type: "toggleUIState", container: "ui", key: "showModal" }}>
 *     Open Dialog
 *   </Button>
 *   <DialogBlock
 *     stateContainer="ui"
 *     stateKey="showModal"
 *     title="My Dialog"
 *     description="This is a modal dialog"
 *   >
 *     {children}
 *   </DialogBlock>
 * </StateBlock>
 * ```
 */
function DialogBlockComponent({
  stateContainer,
  stateKey,
  title,
  description,
  size,
  closeOnOutsideClick,
  closeOnEscape,
  children: Children,
}: DialogBlockProps) {
  const stateContext = useStateContext();

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes
  useEffect(() => {
    if (!stateContext || !stateContainer) return;
    const unsubscribe = stateContext.subscribe(stateContainer, forceUpdate);
    return unsubscribe;
  }, [stateContext, stateContainer]);

  // Get the current open state
  const isOpen = useMemo(() => {
    if (!stateContext || !stateContainer || !stateKey) return false;
    return stateContext.getUIState(stateContainer, stateKey);
  }, [stateContext, stateContainer, stateKey]);

  // Handle open change (when dialog is closed via X button, outside click, or escape)
  const handleOpenChange = (open: boolean) => {
    if (!stateContext || !stateContainer || !stateKey) return;
    stateContext.setUIState(stateContainer, stateKey, open);
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
    stateContainer: createStateContainerField({
      label: 'State Container',
    }),
    stateKey: createStateKeyField({
      label: 'State Key (UI State)',
      containerProp: 'stateContainer',
      filterType: 'uiState', // Only show UI state flags for dialogs
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
    stateContainer: '',
    stateKey: '',
    title: '',
    description: '',
    size: 'md',
    closeOnOutsideClick: true,
    closeOnEscape: true,
  },

  render: DialogBlockComponent,
};
