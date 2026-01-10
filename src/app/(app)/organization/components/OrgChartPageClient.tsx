'use client';

/**
 * OrgChartPageClient Component
 *
 * Client wrapper that connects EmeryStore data with server-fetched skills.
 * Handles loading state and data transformation.
 */

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Loading } from '@/components/ui/loading';
import { CanvasBase } from '@/components/canvas';
import { useEmeryStore } from '@/contexts/EmeryStoreProvider';
import type { OrgChartCanvasMetadata } from '@/components/org-chart/types';

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
  /** Saved canvas metadata */
  canvasMetadata?: OrgChartCanvasMetadata | null;
}

export function OrgChartPageClient({ skills, canvasMetadata }: OrgChartPageClientProps) {
  const { data, isLoading } = useEmeryStore();
  const { agents = [], databases = [] } = data || {};

  // Memoize data transformations to prevent infinite re-render loops
  const agentData = useMemo(() =>
    agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role || undefined,
      status: agent.status || undefined,
    })),
    [agents]
  );

  const databaseData = useMemo(() =>
    databases.map((db: any) => ({
      id: db.id,
      name: db.name,
      slug: db.slug,
      agentId: db.agentId || null,
      tableCount: db.tables?.length || 0,
    })),
    [databases]
  );

  if (isLoading) {
    return (
      <CanvasBase>
        <Loading text="Loading organization data..." />
      </CanvasBase>
    );
  }

  return (
    <CanvasBase>
      <OrgChartEditorClient
        agents={agentData}
        skills={skills}
        databases={databaseData}
        canvasMetadata={canvasMetadata ?? undefined}
      />
    </CanvasBase>
  );
}

export default OrgChartPageClient;
