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

      const tables: EmeryTable[] = tablesResult.map(table => ({
        id: table.id, // Already a number from TableDTO
        name: table.name,
        dbName: table.storageLocation, // Map storageLocation to dbName for compatibility
        databaseId: table.databaseId, // Already a number from TableDTO
        organizationId: table.organizationId, // Already a number from TableDTO
        metadata: table.metadata, // Already plain object from TableDTO
        createdAt: table.createdAt || null,
        updatedAt: table.updatedAt || null,
        database: null // TODO: Add database info if needed
      }));
      const agents: EmeryAgent[] = agentsResult.map(agent => ({
        id: agent.id, // Already a number from AgentDTO
        name: agent.name,
        description: agent.description,
        status: agent.status || 'active', // Already a string from AgentDTO
        organizationId: agent.organizationId // Already a number from AgentDTO
      }));
      const teams: EmeryTeam[] = teamsResult.map(team => ({
        id: team.id, // Already a number from TeamDTO
        name: team.name,
        purpose: team.purpose || undefined, // Convert null to undefined for compatibility
        organizationId: team.organizationId, // Already a number from TeamDTO
        agentIds: team.agentIds || [] // Already string[] from TeamDTO
      }));

      // Group tables by database and convert to interface format
      const databasesWithTables: EmeryDatabase[] = databasesResult.map(db => ({
        id: db.id, // Already a number from DatabaseDTO
        name: db.name,
        slug: db.slug,
        metadata: db.metadata,
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
