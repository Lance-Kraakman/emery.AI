'use client'

import { Edit, Trash2, Save, X } from 'lucide-react';
import { Field, Row } from '@/app/actions/types';
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
      <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">
        <p>Add some fields first to start managing data.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">
        <p>No rows yet. Click "Add Row" to create your first entry.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {fields.map((field) => (
              <th 
                key={field.id} 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
              >
                {field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              {fields.map((field) => (
                <td key={field.id} className="px-4 py-3 text-sm text-gray-900 border-b max-w-xs">
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
                </td>
              ))}
              <td className="px-4 py-3 text-sm text-gray-900 border-b">
                <div className="flex gap-1">
                  {editingRow === row.id ? (
                    <>
                      <button
                        onClick={() => onUpdateRow(row.id)}
                        disabled={isPending}
                        className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50 rounded"
                        title="Save changes"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={onCancelEdit}
                        disabled={isPending}
                        className="p-1 text-gray-600 hover:text-gray-800 rounded"
                        title="Cancel editing"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onStartEdit(row)}
                        disabled={isPending}
                        className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 rounded"
                        title="Edit row"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteRow(row.id)}
                        disabled={isPending}
                        className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50 rounded"
                        title="Delete row"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}