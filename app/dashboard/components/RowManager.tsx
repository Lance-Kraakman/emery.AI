'use client'

// AIDEV-NOTE: Client component for row data management - handles table view and editing
// AIDEV-QUESTION: Should we implement virtual scrolling for large datasets?

import { useState, useTransition } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { createRowAction, updateRowAction, deleteRowAction } from '@/app/actions/rows';
import { Field, Row } from '@/app/actions/types';
import { validateRowData, hasValidationErrors, getValidationErrorMessage } from '@/app/utils/validation';
import FileUpload from '../FileUpload';
import RelationField from './RelationField';

interface RowManagerProps {
  tableId: number;
  organizationId: number;
  fields: Field[];
  rows: Row[];
  onRowUpdate: () => void;
}

export default function RowManager({ tableId, organizationId, fields, rows, onRowUpdate }: RowManagerProps) {
  const [showNewRow, setShowNewRow] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [editRowData, setEditRowData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  async function handleCreateRow(formData: FormData) {
    // Validate data before submission
    const validationResults = validateRowData(fields, newRowData);
    if (hasValidationErrors(validationResults)) {
      const errors: Record<string, string> = {};
      validationResults.forEach((result: any) => {
        if (!result.isValid && result.field) {
          errors[result.field] = result.error || 'Invalid value';
        }
      });
      setValidationErrors(errors);
      alert(getValidationErrorMessage(validationResults));
      return;
    }

    startTransition(async () => {
      try {
        setValidationErrors({});
        const data = JSON.stringify(newRowData);
        formData.append('data', data);
        await createRowAction(formData);
        setNewRowData({});
        setShowNewRow(false);
        onRowUpdate();
      } catch (error) {
        console.error('Error creating row:', error);
        alert('Failed to create row');
      }
    });
  }

  async function handleUpdateRow(rowId: string) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('tableId', tableId.toString());
        formData.append('rowId', rowId);
        formData.append('data', JSON.stringify(editRowData));
        await updateRowAction(formData);
        setEditingRow(null);
        setEditRowData({});
        onRowUpdate();
      } catch (error) {
        console.error('Error updating row:', error);
        alert('Failed to update row');
      }
    });
  }

  async function handleDeleteRow(rowId: string) {
    if (!confirm('Are you sure you want to delete this row?')) return;
    
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('tableId', tableId.toString());
        formData.append('rowId', rowId);
        await deleteRowAction(formData);
        onRowUpdate();
      } catch (error) {
        console.error('Error deleting row:', error);
        alert('Failed to delete row');
      }
    });
  }

  const startEditRow = (row: Row) => {
    setEditingRow(row.id);
    const rowData: Record<string, any> = {};
    fields.forEach(field => {
      const fieldKey = `field_${field.id}`;
      rowData[field.slug] = row[fieldKey];
    });
    setEditRowData(rowData);
  };

  const renderFieldInput = (field: Field, value: any, onChange: (value: any) => void) => {
    const baseClass = "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
    
    switch (field.type) {
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
            className={baseClass}
            disabled={isPending}
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            disabled={isPending}
          />
        );
      case 'email':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            disabled={isPending}
          />
        );
      case 'url':
        return (
          <input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            disabled={isPending}
          />
        );
      case 'file':
        return (
          <FileUpload
            value={value}
            onChange={onChange}
            organizationId={organizationId}
            tableId={tableId}
            fieldId={field.id}
          />
        );
      case 'relation':
        return (
          <RelationField
            value={value}
            onChange={onChange}
            relatedTableId={field.relatedTableId}
            workspaceId={workspaceId}
            disabled={isPending}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            disabled={isPending}
          />
        );
    }
  };

  const renderCellValue = (field: Field, value: any) => {
    if (value === null || value === undefined) return '-';
    
    switch (field.type) {
      case 'boolean':
        return value ? '✓' : '✗';
      case 'date':
        return value ? new Date(value).toLocaleDateString() : '-';
      case 'url':
        return value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {value.length > 30 ? `${value.substring(0, 30)}...` : value}
          </a>
        ) : '-';
      case 'email':
        return value ? (
          <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
            {value}
          </a>
        ) : '-';
      case 'relation':
        if (!Array.isArray(value) || value.length === 0) return '-';
        return (
          <div className="space-y-1">
            {value.slice(0, 3).map((item: any, index: number) => (
              <div key={item.id || index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {item.value || item.id || 'Unknown'}
              </div>
            ))}
            {value.length > 3 && (
              <div className="text-xs text-gray-500">+{value.length - 3} more</div>
            )}
          </div>
        );
      case 'file':
        if (!value?.files || !Array.isArray(value.files) || value.files.length === 0) return '-';
        return (
          <div className="space-y-1">
            {value.files.slice(0, 2).map((file: any, index: number) => (
              <div key={file.id || index} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                {file.name || 'File'}
              </div>
            ))}
            {value.files.length > 2 && (
              <div className="text-xs text-gray-500">+{value.files.length - 2} more files</div>
            )}
          </div>
        );
      default:
        return typeof value === 'string' && value.length > 50 
          ? `${value.substring(0, 50)}...` 
          : String(value);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Data</h3>
        <button
          onClick={() => setShowNewRow(true)}
          disabled={isPending || fields.length === 0}
          className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Add Row
        </button>
      </div>

      {showNewRow && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-medium mb-3">Create New Row</h4>
          <form action={handleCreateRow} className="space-y-3">
            <input type="hidden" name="tableId" value={tableId} />
            
            {fields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.name} {field.required && <span className="text-red-500">*</span>}
                </label>
                {renderFieldInput(
                  field,
                  newRowData[field.slug],
                  (value) => setNewRowData(prev => ({ ...prev, [field.slug]: value }))
                )}
                {validationErrors[field.slug] && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors[field.slug]}</p>
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? 'Creating...' : 'Create Row'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewRow(false);
                  setNewRowData({});
                  setValidationErrors({});
                }}
                disabled={isPending}
                className="px-4 py-2 border text-sm rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {fields.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Add some fields first to start managing data.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {fields.map((field) => (
                  <th key={field.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    {field.name}
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
                    <td key={field.id} className="px-4 py-3 text-sm text-gray-900 border-b">
                      {editingRow === row.id ? (
                        renderFieldInput(
                          field,
                          editRowData[field.slug],
                          (value) => setEditRowData(prev => ({ ...prev, [field.slug]: value }))
                        )
                      ) : (
                        renderCellValue(field, row[`field_${field.id}`])
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-gray-900 border-b">
                    <div className="flex gap-1">
                      {editingRow === row.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateRow(row.id)}
                            disabled={isPending}
                            className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingRow(null);
                              setEditRowData({});
                            }}
                            disabled={isPending}
                            className="p-1 text-gray-600 hover:text-gray-800"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditRow(row)}
                            disabled={isPending}
                            className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            disabled={isPending}
                            className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
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

          {rows.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No data yet. Add your first row to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}