'use client';

/**
 * PageDialogsPanel - Panel for managing page-level dialogs
 *
 * AIDEV-NOTE: Provides UI to add, edit, and remove dialogs that are
 * controlled by state variables. Each dialog has its own Puck content.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronDown, ChevronRight, MessageSquare, Settings } from 'lucide-react';
import {
  type PageDialog,
  type PageDialogsConfig,
  type DialogSize,
  createEmptyDialog,
  createEmptyPageDialogsConfig,
} from '@/ddd/domain/puck/value-objects/page-dialogs';
import type { PageStateConfig } from '@/components/puck/types/state';

interface PageDialogsPanelProps {
  pageDialogs?: PageDialogsConfig;
  pageState?: PageStateConfig;
  onChange: (config: PageDialogsConfig) => void;
  onEditContent?: (dialogId: string) => void;
}

const DIALOG_SIZES: { value: DialogSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
  { value: 'full', label: 'Full Screen' },
];

/**
 * Get boolean state variables from page state
 */
function getBooleanStateVariables(pageState?: PageStateConfig): string[] {
  if (!pageState?.variables) return [];
  return pageState.variables
    .filter(v => v.type === 'boolean')
    .map(v => v.name);
}

/**
 * Individual dialog editor
 */
function DialogEditor({
  dialog,
  stateVariables,
  onChange,
  onDelete,
  onEditContent,
}: {
  dialog: PageDialog;
  stateVariables: string[];
  onChange: (dialog: PageDialog) => void;
  onDelete: () => void;
  onEditContent?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span className="font-medium text-sm">{dialog.name || 'Unnamed Dialog'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {dialog.stateKey && (
                <code className="bg-muted px-1.5 py-0.5 rounded">{dialog.stateKey}</code>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-4 border-t">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-xs">Dialog Name</Label>
              <Input
                value={dialog.name}
                onChange={(e) => onChange({ ...dialog, name: e.target.value })}
                placeholder="Enter dialog name"
                className="h-8"
              />
            </div>

            {/* State Key (Trigger) */}
            <div className="space-y-2">
              <Label className="text-xs">Trigger Variable (Boolean)</Label>
              <Select
                value={dialog.stateKey}
                onValueChange={(val) => onChange({ ...dialog, stateKey: val })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select state variable" />
                </SelectTrigger>
                <SelectContent>
                  {stateVariables.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No boolean variables defined
                    </div>
                  ) : (
                    stateVariables.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Dialog opens when this variable is true
              </p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-xs">Title</Label>
              <Input
                value={dialog.title}
                onChange={(e) => onChange({ ...dialog, title: e.target.value })}
                placeholder="Dialog title"
                className="h-8"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={dialog.description || ''}
                onChange={(e) => onChange({ ...dialog, description: e.target.value || undefined })}
                placeholder="Brief description"
                className="h-8"
              />
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label className="text-xs">Size</Label>
              <Select
                value={dialog.size}
                onValueChange={(val) => onChange({ ...dialog, size: val as DialogSize })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIALOG_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Close behavior */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Close on outside click</Label>
                <Switch
                  checked={dialog.closeOnOutsideClick}
                  onCheckedChange={(checked) =>
                    onChange({ ...dialog, closeOnOutsideClick: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Close on Escape key</Label>
                <Switch
                  checked={dialog.closeOnEscape}
                  onCheckedChange={(checked) =>
                    onChange({ ...dialog, closeOnEscape: checked })
                  }
                />
              </div>
            </div>

            {/* Edit Content Button */}
            {onEditContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEditContent}
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                Edit Dialog Content
              </Button>
            )}

            {/* Delete Button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Dialog
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * PageDialogsPanel - Main panel component
 */
export function PageDialogsPanel({
  pageDialogs,
  pageState,
  onChange,
  onEditContent,
}: PageDialogsPanelProps) {
  const config = pageDialogs ?? createEmptyPageDialogsConfig();
  const stateVariables = getBooleanStateVariables(pageState);

  const addDialog = () => {
    const id = `dialog_${Date.now()}`;
    const newDialog = createEmptyDialog(id);
    onChange({
      ...config,
      dialogs: [...config.dialogs, newDialog],
    });
  };

  const updateDialog = (index: number, dialog: PageDialog) => {
    const newDialogs = [...config.dialogs];
    newDialogs[index] = dialog;
    onChange({ ...config, dialogs: newDialogs });
  };

  const deleteDialog = (index: number) => {
    const newDialogs = config.dialogs.filter((_, i) => i !== index);
    onChange({ ...config, dialogs: newDialogs });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Page Dialogs</h3>
          <p className="text-xs text-muted-foreground">
            Define dialogs controlled by state variables
          </p>
        </div>
      </div>

      {config.dialogs.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed rounded-lg">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No dialogs defined</p>
          <Button variant="outline" size="sm" onClick={addDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Dialog
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {config.dialogs.map((dialog, index) => (
            <DialogEditor
              key={dialog.id}
              dialog={dialog}
              stateVariables={stateVariables}
              onChange={(updated) => updateDialog(index, updated)}
              onDelete={() => deleteDialog(index)}
              onEditContent={onEditContent ? () => onEditContent(dialog.id) : undefined}
            />
          ))}

          <Button variant="outline" size="sm" onClick={addDialog} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Dialog
          </Button>
        </div>
      )}

      {stateVariables.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          Tip: Add boolean state variables in Page State panel to use as dialog triggers.
        </p>
      )}
    </div>
  );
}

export default PageDialogsPanel;
