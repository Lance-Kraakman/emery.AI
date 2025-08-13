'use client'

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getTables } from '@/app/actions/tables';
import { getDatabases } from '@/app/actions/databases';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';

export interface EmeryTable {
  id: number;
  name: string;
  dbName: string;
  databaseId: number;
  organizationId: number;
  metadata?: { description?: string; [key: string]: any } | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  database?: {
    id: number;
    name: string;
    slug: string;
    metadata?: { description?: string; [key: string]: any } | null;
  } | null;
}

export interface EmeryAgent {
  id: number;
  name: string;
  description?: string;
  status: string;
  organizationId?: number;
}

export interface EmeryTeam {
  id: number;
  name: string;
  purpose?: string;
  organizationId?: number;
  agentIds?: string[];
}

export interface EmeryDatabase {
  id: number;
  name: string;
  slug: string;
  metadata?: { description?: string; [key: string]: any } | null;
  tables: EmeryTable[];
}

export interface EmeryData {
  databases: EmeryDatabase[];
  agents: EmeryAgent[];
  teams: EmeryTeam[];
  organization?: {
    id: number;
    name: string;
  };
}

export function useEmeryData() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<EmeryData>({
    databases: [],
    agents: [],
    teams: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentOrg = session?.user?.currentOrganization;

  useEffect(() => {
    if (session?.user?.needsSetup && !session?.user?.currentOrganization) {
      router.push('/setup');
    }
  }, [session, router]);

  const fetchData = useCallback(async () => {
    if (!session?.user || !currentOrg) {
      setData({ databases: [], agents: [], teams: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch databases and tables
      const [databasesResult, tablesResult, agentsResult, teamsResult] = await Promise.all([
        getDatabases(),
        getTables(),
        getAgents(),
        getTeams(currentOrg.id)
      ]);

      const tables = tablesResult as EmeryTable[];
      const agents = agentsResult as EmeryAgent[];
      const teams = teamsResult as EmeryTeam[];

      // Group tables by database
      const databasesWithTables = databasesResult.map(db => ({
        ...db,
        tables: tables.filter(table => table.databaseId === db.id)
      }));

      setData({
        databases: databasesWithTables,
        agents,
        teams,
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
  }, [session, currentOrg]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    currentOrganization: currentOrg,
    availableOrganizations: session?.user?.availableOrganizations || [],
  };
}
