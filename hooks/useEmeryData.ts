'use client'

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getTables } from '@/app/actions/tables';
import { getDatabases } from '@/app/actions/databases';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import { getCurrentOrganization } from '@/app/actions/user-organizations';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TeamDTO } from '@/app/mappers/team-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { DatabaseDTO } from '@/app/mappers/database-mapper';

// AIDEV-NOTE: Now using DTOs from mappers instead of duplicate interfaces
// Extended database interface to include tables for frontend convenience
export interface DatabaseWithTables extends DatabaseDTO {
  tables: TableDTO[];
}

export interface EmeryData {
  databases: DatabaseWithTables[];
  agents: AgentDTO[];
  teams: TeamDTO[];
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

  useEffect(() => {
    if (session?.user?.needsSetup && !session?.user?.currentOrganizationId) {
      router.push('/setup');
    }
  }, [session, router]);

  const fetchData = useCallback(async () => {
    if (!session?.user || !session?.user?.currentOrganizationId) {
      setData({ databases: [], agents: [], teams: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch current organization and other data
      const [currentOrgResult, databasesResult, tablesResult, agentsResult, teamsResult] = await Promise.all([
        getCurrentOrganization(),
        getDatabases(),
        getTables(),
        getAgents(),
        getTeams(session.user.currentOrganizationId)
      ]);

      // Use DTOs directly, but group tables with databases for frontend convenience
      const agents = agentsResult;
      const teams = teamsResult;
      const databases: DatabaseWithTables[] = databasesResult.map(db => ({
        ...db,
        tables: tablesResult.filter(table => table.databaseId === db.id)
      }));

      setData({
        databases,
        agents,
        teams,
        organization: currentOrgResult ? {
          id: currentOrgResult.id.value,
          name: currentOrgResult.name.value
        } : undefined
      });
    } catch (err) {
      console.error('Error fetching Emery data:', err);
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

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
    currentOrganization: data.organization,
    availableOrganizations: session?.user?.availableOrganizations || [],
  };
}
