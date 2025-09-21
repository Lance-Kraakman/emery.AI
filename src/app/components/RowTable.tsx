'use client'

import React, { useMemo } from 'react';
import { Edit, Trash2, Save, X } from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState
} from '@tanstack/react-table';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { Row } from '@/ddd/domain/tables/value-objects/row';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CellRenderer from './CellRenderer';
import FieldInput from './FieldInput';

interface RowTableProps {
  fields: FieldDTO[];
  rows: Row[];
  editingRow: string | null;
  editRowData: Record<string, any>;
  onStartEdit: (row: Row) => void;
  onCancelEdit: () => void;
  onUpdateRow: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onFieldChange: (fieldSlug: string, value: any) => void;
  isPending: boolean;
  tableId: number;
  organizationId: number;
}

export default function RowTable({
  fields,
  rows,
  editingRow,
  editRowData,
  onStartEdit,
  onCancelEdit,
  onUpdateRow,
  onDeleteRow,
  onFieldChange,
  isPending,
  tableId,
  organizationId
}: RowTableProps) {
  const columnHelper = createColumnHelper<Row>();

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    ...fields.map((field) =>
      columnHelper.accessor((row) => row.toPlainObject()[`field_${field.id}`], {
        id: field.id.toString(),
        header: () => (
          <>
            {field.name}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </>
        ),
        cell: ({ row: tableRow }) => {
          const row = tableRow.original;
          const rowData = row.toPlainObject();
          
          return editingRow === row.id.value ? (
            <FieldInput
              field={field}
              value={editRowData[field.name]}
              onChange={(value) => onFieldChange(field.name, value)}
              disabled={isPending}
              organizationId={organizationId}
              tableId={tableId}
            />
          ) : (
            <CellRenderer 
              field={field} 
              value={rowData[`field_${field.id}`]} 
            />
          );
        },
        maxSize: 300,
      })
    ),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row: tableRow }) => {
        const row = tableRow.original;
        
        return (
          <div className="flex gap-1">
            {editingRow === row.id.value ? (
              <>
                <Button
                  onClick={() => onUpdateRow(row.id.value)}
                  disabled={isPending}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-800"
                >
                  <Save size={16} />
                </Button>
                <Button
                  onClick={onCancelEdit}
                  disabled={isPending}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <X size={16} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => onStartEdit(row)}
                  disabled={isPending}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Edit size={16} />
                </Button>
                <Button
                  onClick={() => onDeleteRow(row.id.value)}
                  disabled={isPending}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={16} />
                </Button>
              </>
            )}
          </div>
        );
      },
    }),
  ], [fields, editingRow, editRowData, onStartEdit, onCancelEdit, onUpdateRow, onDeleteRow, onFieldChange, isPending, tableId, organizationId]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/50">
        <p>Add some fields first to start managing data.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/50">
        <p>No rows yet. Click "Add Row" to create your first entry.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="max-w-xs">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
