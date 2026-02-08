'use client';

/**
 * DeleteConfirmationDialog Component
 *
 * Shows a confirmation dialog with impact preview before deleting entities.
 * Lists all data that will be permanently deleted.
 */

import React, { useMemo, useState, useEffect } from 'react';
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
import { AlertTriangle, Bot, Sparkles, Database, Clock, Loader2, Table2 } from 'lucide-react';
import type { OrgChartNode, OrgChartNodeType, AgentContainerNodeData, DatabaseNodeData } from '../types';

interface DeleteImpactItem {
  type: OrgChartNodeType;
  id: string;
  name: string;
  entityId: number;
  details?: string;
  children?: {
    skills: number;
    databases: number;
    automations: number;
    tables?: number;
  };
  /** List of child entity names for detailed preview */
  childDetails?: Array<{ type: 'skill' | 'database' | 'table' | 'automation'; name: string }>;
}

const CONFIRMATION_PHRASE = 'I-understand-delete-all';

interface DeleteConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed (cancel) */
  onClose: () => void;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Whether deletion is in progress */
  isDeleting?: boolean;
  /** Items to be deleted */
  itemsToDelete: DeleteImpactItem[];
}

const typeIcons: Record<OrgChartNodeType, React.ReactNode> = {
  agent: <Bot className="h-4 w-4 text-emerald-500" />,
  skill: <Sparkles className="h-4 w-4 text-violet-500" />,
  database: <Database className="h-4 w-4 text-slate-500" />,
  sticky: <Database className="h-4 w-4 text-yellow-500" />,
  org_resources: <Database className="h-4 w-4 text-blue-500" />,
};

const typeLabels: Record<OrgChartNodeType, string> = {
  agent: 'Agent',
  skill: 'Skill',
  database: 'Database',
  sticky: 'Note',
  org_resources: 'Resource',
};

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  itemsToDelete,
}: DeleteConfirmationDialogProps) {
  // State for typed confirmation
  const [confirmationInput, setConfirmationInput] = useState('');

  // Reset confirmation input when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmationInput('');
    }
  }, [isOpen]);

  // Count total items
  const itemCount = itemsToDelete.length;
  const isSingleItem = itemCount === 1;
  const singleItem = isSingleItem ? itemsToDelete[0] : null;

  // Calculate total child items being deleted
  const totalChildItems = useMemo(() => {
    let skills = 0;
    let databases = 0;
    let automations = 0;
    let tables = 0;

    for (const item of itemsToDelete) {
      if (item.children) {
        skills += item.children.skills;
        databases += item.children.databases;
        automations += item.children.automations;
        tables += item.children.tables ?? 0;
      }
    }

    return { skills, databases, automations, tables };
  }, [itemsToDelete]);

  const hasChildItems =
    totalChildItems.skills > 0 ||
    totalChildItems.databases > 0 ||
    totalChildItems.automations > 0 ||
    totalChildItems.tables > 0;

  // Check if confirmation input matches required phrase
  const isConfirmationValid = !hasChildItems || confirmationInput === CONFIRMATION_PHRASE;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {isSingleItem ? typeLabels[singleItem!.type] : `${itemCount} items`}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>This will permanently delete:</p>

              {/* List of items to delete */}
              <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                {itemsToDelete.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {typeIcons[item.type]}
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">({typeLabels[item.type]})</span>
                    </div>
                    {item.children && (
                      <div className="ml-6 text-xs text-muted-foreground space-y-0.5">
                        {item.children.skills > 0 && (
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {item.children.skills} skill{item.children.skills !== 1 ? 's' : ''}
                          </div>
                        )}
                        {item.children.databases > 0 && (
                          <div className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {item.children.databases} database{item.children.databases !== 1 ? 's' : ''}
                          </div>
                        )}
                        {item.children.tables !== undefined && item.children.tables > 0 && (
                          <div className="flex items-center gap-1">
                            <Table2 className="h-3 w-3" />
                            {item.children.tables} table{item.children.tables !== 1 ? 's' : ''}
                          </div>
                        )}
                        {item.children.automations > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.children.automations} automation{item.children.automations !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                    {item.details && (
                      <div className="ml-6 text-xs text-muted-foreground">{item.details}</div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Summary for multi-select */}
              {!isSingleItem && hasChildItems && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <p className="font-medium">Total impact:</p>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {totalChildItems.skills > 0 && (
                      <span>{totalChildItems.skills} skill{totalChildItems.skills !== 1 ? 's' : ''}</span>
                    )}
                    {totalChildItems.databases > 0 && (
                      <span>{totalChildItems.databases} database{totalChildItems.databases !== 1 ? 's' : ''}</span>
                    )}
                    {totalChildItems.tables > 0 && (
                      <span>{totalChildItems.tables} table{totalChildItems.tables !== 1 ? 's' : ''}</span>
                    )}
                    {totalChildItems.automations > 0 && (
                      <span>{totalChildItems.automations} automation{totalChildItems.automations !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-destructive font-medium">This action cannot be undone.</p>

              {/* Typed confirmation for cascade delete */}
              {hasChildItems && (
                <div className="pt-3 border-t space-y-2">
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

/**
 * Build delete impact items from selected nodes
 */
export function buildDeleteImpactItems(
  selectedNodeIds: Set<string>,
  nodes: OrgChartNode[],
  skills: Array<{ id: number; name: string; agentId?: number | null }>,
  databases: Array<{ id: number; name: string; agentId?: number | null; tableCount?: number }>
): DeleteImpactItem[] {
  const items: DeleteImpactItem[] = [];

  for (const nodeId of selectedNodeIds) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // Skip child nodes if parent is also selected
    if (node.parentId && selectedNodeIds.has(node.parentId)) continue;

    // Get name from data (sticky notes use 'Note' as fallback since they don't have a name field)
    const name = node.type === 'sticky' ? 'Note' : ('name' in node.data ? node.data.name as string : 'Unknown');

    const item: DeleteImpactItem = {
      type: node.type as OrgChartNodeType,
      id: node.id,
      name,
      entityId: 0,
    };

    // Parse entity ID from node ID
    const match = nodeId.match(/^([a-z_]+)-(\d+)$/);
    if (match) {
      item.entityId = parseInt(match[2], 10);
    }

    // Calculate children for agent nodes
    if (node.type === 'agent') {
      const data = node.data as AgentContainerNodeData;
      const agentSkills = skills.filter((s) => s.agentId === data.agentId);
      const agentDatabases = databases.filter((d) => d.agentId === data.agentId);
      const totalTables = agentDatabases.reduce((sum, d) => sum + (d.tableCount ?? 0), 0);

      item.children = {
        skills: agentSkills.length,
        databases: agentDatabases.length,
        automations: data.automationCount ?? 0,
        tables: totalTables,
      };
    }

    // Add table count for database nodes as children (triggers cascade delete confirmation)
    if (node.type === 'database') {
      const data = node.data as DatabaseNodeData;
      const db = databases.find((d) => d.id === data.databaseId);
      if (db?.tableCount && db.tableCount > 0) {
        item.children = {
          skills: 0,
          databases: 0,
          automations: 0,
          tables: db.tableCount,
        };
      }
    }

    items.push(item);
  }

  return items;
}

export default DeleteConfirmationDialog;
