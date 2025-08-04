'use client'

import { useState } from 'react';
import TableList from './TableList';
import TableEditorClient from './TableEditorClient';
import UserMenu from '@/components/UserMenu';
import { useSession } from 'next-auth/react';

interface Table {
  id: number;
  organizationId: number;
  name: string;
  dbName: string;
  createdBy: string;
  createdAt: Date | null;
}

interface DashboardClientProps {
  initialTables: Table[];
  onDataUpdate?: {
    loadTables: () => void;
  };
}

export default function DashboardClient({ 
  initialTables, 
  onDataUpdate
}: DashboardClientProps) {
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const { data: session } = useSession();

  if (selectedTable) {
    const table = initialTables.find(t => t.id === selectedTable);
    return (
      <TableEditorClient 
        tableId={selectedTable} 
        tableName={table?.name || 'Unknown Table'}
        organizationId={table?.organizationId || 0}
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
              href="/dashboard/connections" 
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              OAuth Connections
            </a>
            <a 
              href="/dashboard/manage" 
              className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
            >
              System Management
            </a>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="flex">
        <TableList
          tables={initialTables}
          organizationId={session?.user?.organizationId}
          onSelectTable={setSelectedTable}
          onTableUpdate={onDataUpdate?.loadTables}
        />
        
        <div className="flex-1 p-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a table</h3>
            <p className="text-gray-500">Choose a table from the sidebar to view and edit its data</p>
          </div>
        </div>
      </div>
    </div>
  );
}