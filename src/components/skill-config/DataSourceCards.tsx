'use client';

import React from 'react';
import { Table2, MoreVertical, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataSourcePicker } from '@/components/data-sources';
import type { ContextMappingDTO } from '@/app/actions/context-mappings';
import type { ContextMappingAccessMode } from '@/ddd/domain/context/entities/context-mapping';

interface DataSourceCardsProps {
  dataSources: ContextMappingDTO[];
  isLoading: boolean;
  isReadOnly: boolean;
  skillId?: number;
  onAddDataSource: (table: { id: number; name: string }) => void;
  onUpdateDataSource: (id: number, data: { accessMode?: ContextMappingAccessMode }) => void;
  onRemoveDataSource: (id: number) => void;
  excludeTableIds: number[];
}

export function DataSourceCards({
  dataSources,
  isLoading,
  isReadOnly,
  skillId,
  onAddDataSource,
  onUpdateDataSource,
  onRemoveDataSource,
  excludeTableIds,
}: DataSourceCardsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {dataSources.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">No data sources</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {dataSources.map((ds) => (
            <div
              key={ds.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded border bg-emerald-50/30 dark:bg-emerald-900/10"
            >
              <Table2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span className="text-xs font-medium truncate max-w-[120px]">{ds.tableName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 h-4 bg-emerald-100/50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
              >
                {ds.accessMode}
              </Badge>
              {!isReadOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                      onClick={() => onUpdateDataSource(ds.id, { accessMode: 'read' })}
                      disabled={ds.accessMode === 'read'}
                    >
                      Read only
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onUpdateDataSource(ds.id, { accessMode: 'write' })}
                      disabled={ds.accessMode === 'write'}
                    >
                      Write only
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onUpdateDataSource(ds.id, { accessMode: 'readwrite' })}
                      disabled={ds.accessMode === 'readwrite'}
                    >
                      Read & Write
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onRemoveDataSource(ds.id)}
                      className="text-destructive"
                    >
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      <DataSourcePicker
        onTableSelect={onAddDataSource}
        excludeTableIds={excludeTableIds}
        disabled={isLoading || isReadOnly || !skillId}
      />
    </div>
  );
}
