'use client'

import { useEffect, useState } from 'react';
import { getTables } from '@/app/actions/tables';
import DashboardClient from './DashboardClient';
import { useSession } from 'next-auth/react';

interface Table {
  id: number;
  organizationId: number;
  name: string;
  dbName: string;
  createdBy: string;
  createdAt: Date | null;
}

export default function DashboardWithData() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.user) {
      loadTables();
    }
  }, [session]);

  const loadTables = async () => {
    if (!session?.user) return;
    
    try {
      const data = await getTables();
      setTables(data);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
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
      initialTables={tables}
      onDataUpdate={{ loadTables }}
    />
  );
}