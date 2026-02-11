'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTables } from '@/app/actions/tables';
import { getDatabases } from '@/app/actions/databases';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { DatabaseDTO } from '@/app/dtos/database.dto';
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
  const [databases, setDatabases] = useState<DatabaseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [tablesData, databasesData] = await Promise.all([getTables(), getDatabases()]);
        setTables(tablesData || []);
        setDatabases(databasesData || []);
      } catch (err) {
        console.error('Error loading tables:', err);
        setError('Failed to load tables');
        setTables([]);
        setDatabases([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Group tables by database
  const tablesByDatabase = useMemo(() => {
    const grouped = new Map<number, TableDTO[]>();
    tables.forEach((table) => {
      const list = grouped.get(table.databaseId) || [];
      list.push(table);
      grouped.set(table.databaseId, list);
    });
    return grouped;
  }, [tables]);

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
          Array.from(tablesByDatabase.entries()).map(([dbId, dbTables]) => {
            const db = databases.find((d) => d.id === dbId);
            return (
              <SelectGroup key={dbId}>
                <SelectLabel className="text-xs text-muted-foreground">{db?.name || 'Unknown'}</SelectLabel>
                {dbTables.map((table) => (
                  <SelectItem key={table.id} value={table.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      {table.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}