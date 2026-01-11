'use client';

/**
 * DatabaseNode Component
 *
 * Node representing a database with inline table list.
 * Shows icon, name, and up to 3 tables with overflow indicator.
 */

import React, { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table2 } from 'lucide-react';
import { BaseOrgChartNode } from './BaseOrgChartNode';
import type { DatabaseNodeData } from '../types';

interface DatabaseNodeProps {
  data: DatabaseNodeData;
  selected: boolean;
}

export const DatabaseNode = memo(function DatabaseNode({ data, selected }: DatabaseNodeProps) {
  const router = useRouter();
  const { name, tableCount, tables = [] } = data;

  const displayTables = tables.slice(0, 3);
  const totalTables = tableCount ?? tables.length;
  const moreCount = totalTables - displayTables.length;

  const handleTableClick = useCallback((e: React.MouseEvent, tableId: number) => {
    e.stopPropagation();
    router.push(`/data/${tableId}?returnTo=org-chart%26selected=database-${data.databaseId}`);
  }, [router, data.databaseId]);

  return (
    <BaseOrgChartNode name={name} selected={selected} nodeType="database" showHandles>
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
    </BaseOrgChartNode>
  );
});

export default DatabaseNode;
