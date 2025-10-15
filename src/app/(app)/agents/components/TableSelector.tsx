'use client';

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTables } from '@/app/actions/tables';
import type { TableDTO } from '@/app/mappers/table-mapper';
import { Loader2, Database } from 'lucide-react';

interface TableSelectorProps {
  value?: string;
  onValueChange: (tableId: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function TableSelector({
  value,
  onValueChange,
  placeholder = "Select a table...",
  className = ""
}: TableSelectorProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTables = async () => {
      try {
        setLoading(true);
        setError(null);
        const tablesData = await getTables();
        setTables(tablesData || []);
      } catch (err) {
        console.error('Error loading tables:', err);
        setError('Failed to load tables');
        setTables([]);
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, []);

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === 'none') {
      onValueChange(undefined);
    } else {
      onValueChange(selectedValue);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading tables...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <Select
      value={value || 'none'}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            All tables
          </div>
        </SelectItem>
        {tables.length === 0 ? (
          <SelectItem value="no-tables" disabled>
            No tables available
          </SelectItem>
        ) : (
          tables.map((table) => (
            <SelectItem key={table.id} value={table.id.toString()}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                {table.name}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}