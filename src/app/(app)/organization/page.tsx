'use client';

/**
 * Organization Page
 *
 * Displays the org chart editor with hierarchical view of agents and their resources.
 * Uses the new OrgChartEditorClient with React Flow canvas.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { Loading } from '@/components/ui/loading';
import { CanvasBase } from '@/components/canvas';
import { useEmeryStore } from '@/contexts/EmeryStoreProvider';

// Dynamic import to prevent SSR issues with React Flow
const OrgChartEditorClient = dynamic(
  () => import('./components/OrgChartEditorClient'),
  {
    ssr: false,
    loading: () => <Loading text="Loading organization chart..." />,
  }
);

export default function OrganizationPage() {
  const { data, isLoading } = useEmeryStore();
  const { agents = [], databases = [] } = data || {};

  if (isLoading) {
    return (
      <CanvasBase>
        <Loading text="Loading organization data..." />
      </CanvasBase>
    );
  }

  // Transform data for the editor
  const agentData = agents.map((agent: any) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role || undefined,
    status: agent.status || undefined,
  }));

  // Skills would need to be fetched separately - for now, pass empty array
  // TODO: Add skills fetching via server action or store selector
  const skillData: Array<{
    id: number;
    name: string;
    executionType?: string;
    agentId?: number | null;
  }> = [];

  const databaseData = databases.map((db: any) => ({
    id: db.id,
    name: db.name,
    slug: db.slug,
    agentId: db.agentId || null,
    tableCount: db.tables?.length || 0,
  }));

  return (
    <CanvasBase>
      <OrgChartEditorClient
        agents={agentData}
        skills={skillData}
        databases={databaseData}
      />
    </CanvasBase>
  );
}
