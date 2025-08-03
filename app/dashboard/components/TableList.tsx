'use client'

// AIDEV-NOTE: Client component for table list and management - needs interactivity for creation/deletion

import { useState, useTransition } from 'react';
import { Plus, Table, Settings, Trash2 } from 'lucide-react';
import { createTableAction, deleteTableAction } from '@/app/actions/tables';

interface Table {
  id: number;
  workspaceId: number;
  name: string;
  dbName: string;
  createdAt: string;
}

interface TableListProps {
  tables: Table[];
  workspaceId: number;
  onSelectTable: (id: number) => void;
}

export default function TableList({ tables, workspaceId, onSelectTable }: TableListProps) {
  const [showNewTable, setShowNewTable] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleCreateTable(formData: FormData) {
    startTransition(async () => {
      try {
        await createTableAction(formData);
        setShowNewTable(false);
      } catch (error) {
        console.error('Error creating table:', error);
        alert('Failed to create table');
      }
    });
  }

  async function handleDeleteTable(tableId: number) {
    if (!confirm('Are you sure you want to delete this table?')) return;
    
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('tableId', tableId.toString());
        await deleteTableAction(formData);
      } catch (error) {
        console.error('Error deleting table:', error);
        alert('Failed to delete table');
      }
    });
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
        <button
          onClick={() => setShowNewTable(true)}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          New Table
        </button>
      </div>

      {showNewTable && (
        <div className="mb-6 p-4 border rounded-lg bg-white">
          <h3 className="font-medium mb-3">Create New Table</h3>
          <form action={handleCreateTable} className="flex gap-3">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input
              type="text"
              name="name"
              placeholder="Table name"
              required
              disabled={isPending}
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewTable(false)}
              disabled={isPending}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <div key={table.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Table className="text-blue-600" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">{table.name}</h3>
                  <p className="text-sm text-gray-500">
                    Created {new Date(table.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onSelectTable(table.id)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                >
                  <Settings size={16} />
                </button>
                <button
                  onClick={() => handleDeleteTable(table.id)}
                  disabled={isPending}
                  className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12">
          <Table className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tables yet</h3>
          <p className="text-gray-500 mb-4">Create your first table to get started</p>
          <button
            onClick={() => setShowNewTable(true)}
            disabled={isPending}  
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Create Table
          </button>
        </div>
      )}
    </div>
  );
}