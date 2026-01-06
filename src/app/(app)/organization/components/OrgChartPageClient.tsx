'use client';

/**
 * OrgChartPageClient Component
 *
 * Client wrapper that connects EmeryStore data with server-fetched skills.
 * Handles loading state and data transformation.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { Loading } from '@/components/ui/loading';
import { CanvasBase } from '@/components/canvas';
import { useEmeryStore } from '@/contexts/EmeryStoreProvider';

// Dynamic import to prevent SSR issues with React Flow
const OrgChartEditorClient = dynamic(
  () => import('./OrgChartEditorClient'),
  {
    ssr: false,
    loading: () => <Loading text="Loading organization chart..." />,
  }
);

interface OrgChartPageClientProps {
  /** Skills data fetched server-side */
  skills: Array<{
    id: number;
    name: string;
    executionType?: string;
    agentId: number | null;
  }>;
}

export function OrgChartPageClient({ skills }: OrgChartPageClientProps) {
  const { data, isLoading } = useEmeryStore();
  const { agents = [], databases = [] } = data || {};

  if (isLoading) {
    return (
      <CanvasBase>
        <Loading text="Loading organization data..." />
      </CanvasBase>
    );
  }

  // Transform agent data for the editor
  const agentData = agents.map((agent: any) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role || undefined,
    status: agent.status || undefined,
  }));

  // Transform database data for the editor
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
        skills={skills}
        databases={databaseData}
      />
    </CanvasBase>
  );
}

export default OrgChartPageClient;
