'use client'

import { Edit, Trash2, Save, X } from 'lucide-react';
import type { Field } from '@/app/actions/types';
import type { Row } from '@/app/actions/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CellRenderer from './CellRenderer';
import FieldInput from './FieldInput';

interface RowTableProps {
  fields: Field[];
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
          <TableRow>
            {fields.map((field) => (
              <TableHead key={field.id}>
                {field.name}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </TableHead>
            ))}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {fields.map((field) => (
                <TableCell key={field.id} className="max-w-xs">
                  {editingRow === row.id ? (
                    <FieldInput
                      field={field}
                      value={editRowData[field.slug]}
                      onChange={(value) => onFieldChange(field.slug, value)}
                      disabled={isPending}
                      organizationId={organizationId}
                      tableId={tableId}
                    />
                  ) : (
                    <CellRenderer 
                      field={field} 
                      value={row[`field_${field.id}`]} 
                    />
                  )}
                </TableCell>
              ))}
              <TableCell>
                <div className="flex gap-1">
                  {editingRow === row.id ? (
                    <>
                      <Button
                        onClick={() => onUpdateRow(row.id)}
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
                        onClick={() => onDeleteRow(row.id)}
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
