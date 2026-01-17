'use client';

/**
 * DatabaseNode Component
 *
 * Node representing a database with inline table list.
 * Shows icon, name, and all tables with connection handles.
 * Org-level databases (agentId === null) can be dragged onto agent panels
 * using React Flow's native drag - handled by onNodeDragStop in OrgChartCanvas.
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useRouter } from 'next/navigation';
import { Table2 } from 'lucide-react';
import { BaseOrgChartNode } from './BaseOrgChartNode';
import { orgChartHandles } from '../theme';
import type { DatabaseNodeData } from '../types';

interface DatabaseNodeProps {
  data: DatabaseNodeData;
  selected: boolean;
}

export const DatabaseNode = memo(function DatabaseNode({ data, selected }: DatabaseNodeProps) {
  const router = useRouter();
  const { name, tables = [] } = data;

  const handleTableClick = useCallback((e: React.MouseEvent, tableId: number) => {
    e.stopPropagation();
    router.push(`/data/${tableId}?returnTo=org-chart%26selected=database-${data.databaseId}`);
  }, [router, data.databaseId]);

  return (
    <BaseOrgChartNode name={name} selected={selected} nodeType="database">
      {tables.length > 0 ? (
        <div className="px-3 pb-2.5 space-y-0.5">
          {tables.map(table => (
            <div
              key={table.id}
              className="relative flex items-center gap-1.5 py-0.5 group"
            >
              {/* Table-level connection handle */}
              <Handle
                type="target"
                position={Position.Left}
                id={`table-${table.id}`}
                className={orgChartHandles.referenceTarget.className}
                style={{ left: -4, top: '50%', transform: 'translateY(-50%)' }}
              />
              <button
                onClick={(e) => handleTableClick(e, table.id)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
              >
                <Table2 className="h-3 w-3 text-cyan-500 shrink-0" />
                <span className="truncate">{table.name}</span>
              </button>
            </div>
          ))}
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
