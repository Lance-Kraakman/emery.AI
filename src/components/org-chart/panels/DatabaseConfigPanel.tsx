'use client';

/**
 * DatabaseConfigPanel Component
 *
 * Enhanced configuration panel for database nodes in the org chart.
 * Features inline name editing, tables list, and scope display.
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Bot, Building2, Table2, Plus, Check, X, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateDatabase } from '@/app/actions/databases';

interface DatabaseConfigPanelProps {
  database: {
    id: number;
    name: string;
    slug: string;
    agentId?: number | null;
    tableCount?: number;
    tables?: Array<{
      id: number;
      name: string;
      slug: string;
      rowCount?: number;
    }>;
  };
  agentName?: string;
  /** Callback to open create table dialog (handled by parent for proper overlay) */
  onAddTable?: () => void;
}

export function DatabaseConfigPanel({
  database,
  agentName,
  onAddTable,
}: DatabaseConfigPanelProps) {
  const router = useRouter();
  const isOrgScoped = database.agentId === null || database.agentId === undefined;
  const tableCount = database.tableCount ?? database.tables?.length ?? 0;
  const tables = database.tables || [];

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(database.name);
  const [isSaving, setIsSaving] = useState(false);

  // Handle save name
  const handleSaveName = useCallback(async () => {
    if (editName.trim() === database.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateDatabase({ id: database.id, name: editName.trim() });
      if (result.success) {
        toast.success('Database name updated');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update name');
        setEditName(database.name);
      }
    } catch (error) {
      toast.error('Failed to update name');
      setEditName(database.name);
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  }, [database.id, database.name, editName, router]);

  // Cancel editing
  const handleCancelName = () => {
    setEditName(database.name);
    setIsEditingName(false);
  };

  // Navigate to table with return context (route expects table ID in path)
  // Include database as selected node for when user returns
  const handleOpenTable = (tableId: number) => {
    const databaseNodeId = `database-${database.id}`;
    router.push(`/data/${tableId}?returnTo=org-chart%26selected=${databaseNodeId}`);
  };

  return (
    <div className="space-y-5">
      {/* Header with inline editing */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
          <Database className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          {/* Editable name */}
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelName();
                }}
                disabled={isSaving}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleSaveName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleCancelName}
                disabled={isSaving}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <h3
              className="font-semibold text-base truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingName(true)}
              title="Click to edit"
            >
              {database.name}
            </h3>
          )}
          <p className="text-xs text-muted-foreground font-mono truncate">{database.slug}</p>
        </div>
      </div>

      {/* Scope badge */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Scope
        </label>
        <div className="mt-1.5">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm',
              isOrgScoped
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            )}
          >
            {isOrgScoped ? (
              <>
                <Building2 className="h-4 w-4" />
                <span>Organization-level</span>
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                <span>{agentName || `Agent #${database.agentId}`}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tables section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tables
          </label>
          <span className="text-xs text-muted-foreground">{tableCount} total</span>
        </div>

        {tableCount === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
            No tables yet
          </div>
        ) : (
          <div className="space-y-1 bg-muted/30 rounded-lg py-1 max-h-[180px] overflow-y-auto">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => handleOpenTable(table.id)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-accent transition-colors text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Table2 className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                  <span className="text-sm truncate">{table.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {table.rowCount !== undefined && table.rowCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {table.rowCount.toLocaleString()} rows
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Add table - opens dialog */}
        {onAddTable && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={onAddTable}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Table
          </Button>
        )}
      </div>

    </div>
  );
}

export default DatabaseConfigPanel;
