'use client';

/**
 * DatabaseNode Component
 *
 * Node representing a database with inline table list.
 * Shows icon, name, and up to 3 tables with overflow indicator.
 * Tables are clickable and navigate to the table view.
 */

import React, { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Handle, Position } from '@xyflow/react';
import { Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconBadge } from './BaseOrgChartNode';
import { orgChartNodeTheme, orgChartHandles } from '../theme';
import type { DatabaseNodeData } from '../types';

interface DatabaseNodeProps {
  data: DatabaseNodeData;
  selected: boolean;
}

export const DatabaseNode = memo(function DatabaseNode({ data, selected }: DatabaseNodeProps) {
  const router = useRouter();
  const { name, tableCount, tables = [], agentId } = data;
  const config = orgChartNodeTheme.database;
  const isChild = agentId !== null && agentId !== undefined;

  // Show max 3 tables inline
  const displayTables = tables.slice(0, 3);
  const totalTables = tableCount ?? tables.length;
  const moreCount = totalTables - displayTables.length;

  // Handle table click - navigate to table view with database as selected node for return
  const handleTableClick = useCallback((e: React.MouseEvent, tableId: number) => {
    e.stopPropagation(); // Prevent node selection
    const databaseNodeId = `database-${data.databaseId}`;
    router.push(`/data/${tableId}?returnTo=org-chart%26selected=${databaseNodeId}`);
  }, [router, data.databaseId]);

  return (
    <div
      className={cn(
        'min-w-[180px] max-w-[240px] rounded-lg border bg-card shadow-sm transition-all cursor-pointer',
        selected && 'ring-2 ring-primary shadow-md',
        !selected && 'hover:shadow-md hover:border-primary/50',
        config.border
      )}
    >
      {/* Handles for connections (hidden for child nodes) */}
      {!isChild && (
        <>
          <Handle
            type={orgChartHandles.referenceTarget.type}
            position={orgChartHandles.referenceTarget.position}
            className={orgChartHandles.referenceTarget.className}
          />
          <Handle
            type={orgChartHandles.referenceSource.type}
            position={orgChartHandles.referenceSource.position}
            className={orgChartHandles.referenceSource.className}
          />
        </>
      )}

      {/* Header: icon + name */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <IconBadge nodeType="database" />
        <span className="text-sm font-medium truncate flex-1">{name}</span>
      </div>

      {/* Tables list (compact, clickable) */}
      {displayTables.length > 0 ? (
        <div className="px-3 pb-2.5 space-y-0.5">
          {displayTables.map(table => (
            <button
              key={table.id}
              onClick={(e) => handleTableClick(e, table.id)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              <Table2 className="h-3 w-3 text-cyan-500 shrink-0" />
              <span className="truncate">{table.name}</span>
            </button>
          ))}
          {moreCount > 0 && (
            <span className="text-[10px] text-muted-foreground/60 pl-4">
              +{moreCount} more
            </span>
          )}
        </div>
      ) : (
        <div className="px-3 pb-2.5 text-xs text-muted-foreground/50 italic">
          No tables
        </div>
      )}
    </div>
  );
});

export default DatabaseNode;
