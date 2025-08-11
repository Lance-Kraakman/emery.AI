'use client'

// AIDEV-NOTE: Client component for table list and management - needs interactivity for creation/deletion

import { useState, useTransition } from 'react';
import { Plus, Table, Settings, Trash2 } from 'lucide-react';
import { createTableAction, deleteTableAction } from '@/app/actions/tables';

interface Table {
  id: number;
  organizationId: number;
  name: string;
  dbName: string;
  createdBy: string;
  createdAt: Date | null;
}

interface TableListProps {
  tables: Table[];
  currentOrganizationId?: number;
  onSelectTable: (id: number) => void;
  onTableUpdate?: () => void;
}

export default function TableList({ tables, currentOrganizationId, onSelectTable, onTableUpdate }: TableListProps) {
  const [showNewTable, setShowNewTable] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleCreateTable(formData: FormData) {
    startTransition(async () => {
      try {
        await createTableAction(formData);
        setShowNewTable(false);
        onTableUpdate?.();
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
        onTableUpdate?.();
      } catch (error) {
        console.error('Error deleting table:', error);
        alert('Failed to delete table');
      }
    });
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Tables</h2>
        <Button
          onClick={() => setShowNewTable(true)}
          disabled={isPending}
          variant="default"
          size="sm"
        >
          <Plus size={16} />
          New Table
        </Button>
      </div>

      {showNewTable && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Table</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleCreateTable} className="flex gap-3">
              <input type="hidden" name="organizationId" value={currentOrganizationId} />
              <Input
                type="text"
                name="name"
                placeholder="Table name"
                required
                disabled={isPending}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isPending}
                variant="default"
                size="sm"
              >
                {isPending ? 'Creating...' : 'Create'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowNewTable(false)}
                disabled={isPending}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <Card key={table.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Table className="text-primary" size={20} />
                  <div>
                    <h3 className="font-medium">{table.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created {table.createdAt ? new Date(table.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => onSelectTable(table.id)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Settings size={16} />
                  </Button>
                  <Button
                    onClick={() => handleDeleteTable(table.id)}
                    disabled={isPending}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={() => onSelectTable(table.id)}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                >
                  Manage Table
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12">
          <Table className="mx-auto text-muted-foreground mb-4" size={48} />
          <h3 className="text-lg font-medium mb-2">No tables yet</h3>
          <p className="text-muted-foreground mb-4">Create your first table to get started</p>
          <Button
            onClick={() => setShowNewTable(true)}
            disabled={isPending}  
            variant="default"
          >
            Create Table
          </Button>
        </div>
      )}
    </div>
  );
}