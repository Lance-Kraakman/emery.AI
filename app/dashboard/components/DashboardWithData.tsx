'use client'

// AIDEV-NOTE: Client component that uses Server Actions for data fetching - hybrid approach
// AIDEV-QUESTION: Should we implement server-side session management instead of localStorage?

import { useEffect, useState } from 'react';
import { getWorkspaces } from '@/app/actions/workspaces';
import { getTables } from '@/app/actions/tables';
import DashboardClient from './DashboardClient';
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
  createdAt: string;
}

export default function DashboardWithData() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userId } = useUserId();

  useEffect(() => {
    if (userId) {
      loadWorkspaces();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedWorkspace) {
      loadTables();
    } else {
      setTables([]);
    }
  }, [selectedWorkspace]);

  const loadWorkspaces = async () => {
    if (!userId) return;
    
    try {
      const data = await getWorkspaces(userId);
      setWorkspaces(data);
      if (data.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(data[0].id);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTables = async () => {
    if (!selectedWorkspace) return;
    
    try {
      const data = await getTables(selectedWorkspace);
      setTables(data);
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <DashboardClient
      initialWorkspaces={workspaces}
      initialTables={tables}
      initialSelectedWorkspace={selectedWorkspace}
      onWorkspaceSelect={setSelectedWorkspace}
      onDataUpdate={{ loadWorkspaces, loadTables }}
    />
  );
}