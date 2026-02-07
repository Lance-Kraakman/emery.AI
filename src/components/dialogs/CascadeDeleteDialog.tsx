'use client';

/**
 * CascadeDeleteDialog Component
 *
 * A reusable delete confirmation dialog that supports cascade delete with typed confirmation.
 * Shows a preview of what will be deleted and requires typing "I-understand-delete-all"
 * when deleting entities with children.
 */

import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Bot, Sparkles, Database, Table2, Clock, Loader2 } from 'lucide-react';

const CONFIRMATION_PHRASE = 'I-understand-delete-all';

export type EntityType = 'app' | 'page' | 'agent' | 'team' | 'skill' | 'database' | 'table';

export interface ChildItem {
  type: 'skill' | 'database' | 'table' | 'automation' | 'page';
  name: string;
  id?: number;
}

export interface ChildCounts {
  skills?: number;
  databases?: number;
  tables?: number;
  automations?: number;
  pages?: number;
}

interface CascadeDeleteDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed (cancel) */
  onClose: () => void;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Whether deletion is in progress */
  isDeleting?: boolean;
  /** Type of entity being deleted */
  entityType: EntityType;
  /** Name of the entity being deleted */
  entityName: string;
  /** Summary counts of child items (triggers typed confirmation if any > 0) */
  childCounts?: ChildCounts;
  /** Detailed list of child items to show in preview */
  childItems?: ChildItem[];
}

const entityTypeLabels: Record<EntityType, string> = {
  app: 'App',
  page: 'Page',
  agent: 'Agent',
  team: 'Team',
  skill: 'Skill',
  database: 'Database',
  table: 'Table',
};

const childTypeIcons: Record<ChildItem['type'], React.ReactNode> = {
  skill: <Sparkles className="h-3 w-3 text-violet-500" />,
  database: <Database className="h-3 w-3 text-slate-500" />,
  table: <Table2 className="h-3 w-3 text-blue-500" />,
  automation: <Clock className="h-3 w-3 text-orange-500" />,
  page: <Database className="h-3 w-3 text-green-500" />,
};

export function CascadeDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  entityType,
  entityName,
  childCounts,
  childItems,
}: CascadeDeleteDialogProps) {
  const [confirmationInput, setConfirmationInput] = useState('');

  // Reset confirmation input when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmationInput('');
    }
  }, [isOpen]);

  // Determine if we have child items that require typed confirmation
  const hasChildItems =
    (childCounts?.skills ?? 0) > 0 ||
    (childCounts?.databases ?? 0) > 0 ||
    (childCounts?.tables ?? 0) > 0 ||
    (childCounts?.automations ?? 0) > 0 ||
    (childCounts?.pages ?? 0) > 0;

  const isConfirmationValid = !hasChildItems || confirmationInput === CONFIRMATION_PHRASE;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {entityTypeLabels[entityType]}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                This will permanently delete the {entityTypeLabels[entityType].toLowerCase()}{' '}
                <span className="font-medium text-foreground">&quot;{entityName}&quot;</span>
                {hasChildItems && ' and all its contents'}.
              </p>

              {/* Show child counts summary */}
              {hasChildItems && childCounts && (
                <div className="bg-muted/50 rounded-md p-3 space-y-2">
                  <p className="font-medium text-foreground text-xs">This will also delete:</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {(childCounts.skills ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        {childTypeIcons.skill}
                        {childCounts.skills} skill{childCounts.skills !== 1 ? 's' : ''}
                      </li>
                    )}
                    {(childCounts.databases ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        {childTypeIcons.database}
                        {childCounts.databases} database{childCounts.databases !== 1 ? 's' : ''}
                      </li>
                    )}
                    {(childCounts.tables ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        {childTypeIcons.table}
                        {childCounts.tables} table{childCounts.tables !== 1 ? 's' : ''}
                      </li>
                    )}
                    {(childCounts.automations ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        {childTypeIcons.automation}
                        {childCounts.automations} automation{childCounts.automations !== 1 ? 's' : ''}
                      </li>
                    )}
                    {(childCounts.pages ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        {childTypeIcons.page}
                        {childCounts.pages} page{childCounts.pages !== 1 ? 's' : ''}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Show detailed child items list if provided */}
              {childItems && childItems.length > 0 && (
                <div className="max-h-[150px] overflow-y-auto space-y-1">
                  {childItems.map((item, index) => (
                    <div key={`${item.type}-${item.id ?? index}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                      {childTypeIcons[item.type]}
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-destructive font-medium">This action cannot be undone.</p>

              {/* Typed confirmation for cascade delete */}
              {hasChildItems && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Type <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{CONFIRMATION_PHRASE}</code> to confirm:
                  </p>
                  <Input
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder={CONFIRMATION_PHRASE}
                    className="font-mono text-sm"
                    disabled={isDeleting}
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting || !isConfirmationValid}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Permanently'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CascadeDeleteDialog;
