'use client';

/**
 * RowPicker Component
 *
 * Allows users to select which row(s) to use when executing a skill
 * that has table-mapped inputs requiring row context.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Table2, PlayCircle, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SkillRowContext } from '@/lib/utils/skill-row-utils';

interface TableRow {
  id: number;
  [key: string]: unknown;
}

interface RowPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  tableId: number;
  tableName?: string;
  onSelect: (context: SkillRowContext) => void;
  onCancel: () => void;
}

/**
 * RowPicker - Dialog for selecting rows from a table for skill execution
 */
export function RowPicker({
  open,
  onOpenChange,
  skillName,
  tableId,
  tableName,
  onSelect,
  onCancel,
}: RowPickerProps) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [displayFields, setDisplayFields] = useState<string[]>([]);

  // Fetch rows when dialog opens
  useEffect(() => {
    if (open && tableId) {
      fetchRows();
    }
  }, [open, tableId]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rows?tableId=${tableId}&limit=100`);
      if (!response.ok) {
        throw new Error('Failed to fetch rows');
      }

      const data = await response.json();
      setRows(data.rows || []);

      // Extract display field names from first row
      if (data.rows?.length > 0) {
        const firstRow = data.rows[0];
        const fields = Object.keys(firstRow).filter(
          (key) => key !== 'id' && key !== '_createdAt' && key !== '_updatedAt'
        );
        setDisplayFields(fields.slice(0, 4)); // Show first 4 fields
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rows');
    } finally {
      setLoading(false);
    }
  };

  // Filter rows by search query
  const filteredRows = rows.filter((row) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return Object.values(row).some(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).toLowerCase().includes(query)
    );
  });

  const handleSelectRow = (rowId: number) => {
    setSelectedRowId(rowId);
  };

  const handleConfirmSelection = () => {
    if (selectedRowId !== null) {
      onSelect({ rowId: selectedRowId, tableId });
    }
  };

  const handleRunAllRows = () => {
    onSelect({ batchMode: true, tableId });
  };

  const handleCancel = () => {
    setSelectedRowId(null);
    setSearchQuery('');
    onCancel();
  };

  // Format cell value for display
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5" />
            Select Row for {skillName}
          </DialogTitle>
          <DialogDescription>
            Choose which row to use as input for this skill
            {tableName && ` from "${tableName}"`}.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Row list */}
        <ScrollArea className="flex-1 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="ghost" size="sm" onClick={fetchRows} className="mt-2">
                Retry
              </Button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Table2 className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No rows match your search' : 'No rows in this table'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredRows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => handleSelectRow(row.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                    selectedRowId === row.id && 'bg-primary/10 hover:bg-primary/15'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">
                      #{row.id}
                    </span>
                    <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1 min-w-0">
                      {displayFields.map((field) => (
                        <div key={field} className="text-sm min-w-0">
                          <span className="text-muted-foreground">{field}: </span>
                          <span className="truncate">{formatCellValue(row[field])}</span>
                        </div>
                      ))}
                    </div>
                    {selectedRowId === row.id && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleRunAllRows}
            disabled={rows.length === 0}
            className="gap-2"
          >
            <Repeat className="h-4 w-4" />
            Run on All Rows ({rows.length})
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={selectedRowId === null}
            className="gap-2"
          >
            <PlayCircle className="h-4 w-4" />
            Use Selected Row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
