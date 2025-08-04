'use client'

// AIDEV-NOTE: Client component for dashboard state management - handles workspace/table selection

import { useState } from 'react';
import WorkspaceList from './WorkspaceList';
import TableList from './TableList';
import TableEditorClient from './TableEditorClient';
import { useUserId } from './UserIdProvider';

interface Workspace {
  id: number;
  name: string;
  userId: string;
}

interface Table {
  id: number;
  workspaceId: number;
  name: string;
  dbName: string;
  createdAt: Date | null;
}

interface DashboardClientProps {
  initialWorkspaces: Workspace[];
  initialTables: Table[];
  initialSelectedWorkspace: number | null;
  onWorkspaceSelect?: (id: number | null) => void;
  onDataUpdate?: {
    loadWorkspaces: () => void;
    loadTables: () => void;
  };
}

export default function DashboardClient({ 
  initialWorkspaces, 
  initialTables, 
  initialSelectedWorkspace,
  onWorkspaceSelect,
  onDataUpdate
}: DashboardClientProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(initialSelectedWorkspace);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const { userId, isLoading } = useUserId();

  const handleWorkspaceSelect = (id: number) => {
    setSelectedWorkspace(id);
    onWorkspaceSelect?.(id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (selectedTable) {
    const table = initialTables.find(t => t.id === selectedTable);
    return (
      <TableEditorClient 
        tableId={selectedTable} 
        tableName={table?.name || 'Unknown Table'}
        workspaceId={table?.workspaceId || 0}
        onBack={() => setSelectedTable(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">🗂️ Orchastrate</h1>
          <div className="flex items-center gap-4">
            <a 
              href="/dashboard/manage" 
              className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
            >
              System Management
            </a>
            <div className="text-sm text-gray-500">
              {userId && `User: ${userId.slice(0, 8)}...`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <WorkspaceList
          workspaces={initialWorkspaces}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={handleWorkspaceSelect}
          onWorkspaceCreate={onDataUpdate?.loadWorkspaces}
        />

        {selectedWorkspace ? (
          <TableList
            tables={initialTables.filter(table => table.workspaceId === selectedWorkspace)}
            workspaceId={selectedWorkspace}
            onSelectTable={setSelectedTable}
            onTableUpdate={onDataUpdate?.loadTables}
          />
        ) : (
          <div className="flex-1 p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a workspace</h3>
              <p className="text-gray-500">Choose a workspace from the sidebar to view tables</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}