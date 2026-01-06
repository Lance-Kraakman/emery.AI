'use client';

/**
 * DatabaseConfigPanel Component
 *
 * Configuration panel for database nodes in the org chart.
 * Shows database details and provides "Open Data" action.
 */

import React from 'react';
import { Database, ExternalLink, Bot, Building2, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DatabaseConfigPanelProps {
  database: {
    id: number;
    name: string;
    slug: string;
    agentId?: number | null;
    tableCount?: number;
  };
  agentName?: string;
  onOpenData: () => void;
}

export function DatabaseConfigPanel({
  database,
  agentName,
  onOpenData,
}: DatabaseConfigPanelProps) {
  const isOrgScoped = database.agentId === null || database.agentId === undefined;
  const tableCount = database.tableCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <Database className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{database.name}</h3>
          <p className="text-sm text-muted-foreground font-mono">{database.slug}</p>
        </div>
      </div>

      {/* Scope */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Scope
        </label>
        <div className="mt-1 flex items-center gap-2">
          {isOrgScoped ? (
            <>
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Organization-level database</span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">
                {agentName ? `Owned by ${agentName}` : `Agent ID: ${database.agentId}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Table count */}
      <div className="p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          <Table2 className="h-5 w-5 text-cyan-500" />
          <div>
            <div className="text-2xl font-bold">{tableCount}</div>
            <div className="text-xs text-muted-foreground">
              {tableCount === 1 ? 'Table' : 'Tables'}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-2">
        <Button onClick={onOpenData} className="w-full" size="sm">
          <Database className="h-4 w-4 mr-2" />
          Open Data View
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onOpenData}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

export default DatabaseConfigPanel;
