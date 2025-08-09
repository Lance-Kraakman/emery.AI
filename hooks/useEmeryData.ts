'use client'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getTables } from '@/app/actions/tables';
import { getAgents } from '@/app/actions/agents';

export interface EmeryTable {
  id: number;
  name: string;
  dbName: string;
  organizationId: number;
  createdAt: Date | null;
}

export interface EmeryAgent {
  id: number;
  name: string;
  description?: string;
  status: string;
  organizationId?: number;
}

export interface EmeryDatabase {
  id: string;
  name: string;
  tables: EmeryTable[];
}

export interface EmeryData {
  databases: EmeryDatabase[];
  agents: EmeryAgent[];
  organization?: {
    id: number;
    name: string;
  };
}

export function useEmeryData() {
  const { data: session } = useSession();
  const [data, setData] = useState<EmeryData>({
    databases: [],
    agents: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentOrg = session?.user?.currentOrganization;

  useEffect(() => {
    async function fetchData() {
      if (!session?.user || !currentOrg) {
        setData({ databases: [], agents: [] });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch tables
        const tables = (await getTables()) as EmeryTable[];

        // Fetch agents
        const agents = (await getAgents()) as EmeryAgent[];

        // For now, we'll create a single "database" grouping all tables
        // This matches your sidebar structure where tables are grouped under databases
        const databases: EmeryDatabase[] = tables.length > 0 ? [{
          id: `org_${currentOrg.id}`,
          name: currentOrg.name || 'Main Database',
          tables: tables
        }] : [];

        setData({
          databases,
          agents,
          organization: {
            id: currentOrg.id,
            name: currentOrg.name
          }
        });
      } catch (err) {
        console.error('Error fetching Emery data:', err);
        setError('Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [session, currentOrg?.id]);

  const refetch = () => {
    if (session?.user && currentOrg) {
      setIsLoading(true);
      // Re-trigger the effect
      window.location.reload();
    }
  };

  return {
    data,
    isLoading,
    error,
    refetch,
    currentOrganization: currentOrg,
    availableOrganizations: session?.user?.availableOrganizations || [],
  };
}