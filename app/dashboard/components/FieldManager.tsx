'use client'

// AIDEV-NOTE: Client component for field management - needs interactivity for CRUD operations

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createFieldAction, deleteFieldAction } from '@/app/actions/fields';
import { Field } from '@/app/actions/types';

interface FieldManagerProps {
  tableId: number;
  workspaceId: number;
  fields: Field[];
  availableTables: Array<{ id: number; name: string }>;
  onFieldUpdate: () => void;
}

export default function FieldManager({ tableId, workspaceId, fields, availableTables, onFieldUpdate }: FieldManagerProps) {
  const [showNewField, setShowNewField] = useState(false);
  const [selectedFieldType, setSelectedFieldType] = useState('text');
  const [isPending, startTransition] = useTransition();

  async function handleCreateField(formData: FormData) {
    startTransition(async () => {
      try {
        await createFieldAction(formData);
        setShowNewField(false);
        onFieldUpdate();
      } catch (error) {
        console.error('Error creating field:', error);
        alert('Failed to create field');
      }
    });
  }

  async function handleDeleteField(fieldId: number) {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('fieldId', fieldId.toString());
        await deleteFieldAction(formData);
        onFieldUpdate();
      } catch (error) {
        console.error('Error deleting field:', error);
        alert('Failed to delete field');
      }
    });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Fields</h3>
        <button
          onClick={() => setShowNewField(true)}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>

      {showNewField && (
        <div className="mb-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-medium mb-3">Create New Field</h4>
          <form action={handleCreateField} className="space-y-3">
            <input type="hidden" name="tableId" value={tableId} />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name
              </label>
              <input
                type="text"
                name="name"
                required
                disabled={isPending}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter field name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type
              </label>
              <select
                name="type"
                value={selectedFieldType}
                onChange={(e) => setSelectedFieldType(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="email">Email</option>
                <option value="url">URL</option>
                <option value="date">Date</option>
                <option value="relation">Relation</option>
                <option value="file">File</option>
              </select>
            </div>

            {selectedFieldType === 'relation' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Related Table
                </label>
                <select
                  name="relatedTableId"
                  disabled={isPending}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a table...</option>
                  {availableTables
                    .filter(table => table.id !== tableId) // Don't allow self-relations
                    .map(table => (
                      <option key={table.id} value={table.id}>
                        {table.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                name="required"
                id="required"
                disabled={isPending}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="required" className="ml-2 text-sm text-gray-700">
                Required field
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Creating...' : 'Create Field'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewField(false);
                  setSelectedFieldType('text');
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

      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
            <div>
              <span className="font-medium text-gray-900">{field.name}</span>
              <span className="ml-2 text-sm text-gray-500">({field.type})</span>
              {field.required && (
                <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  Required
                </span>
              )}
            </div>
            <button
              onClick={() => handleDeleteField(field.id)}
              disabled={isPending}
              className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {fields.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No fields yet. Add your first field to get started.
        </div>
      )}
    </div>
  );
}