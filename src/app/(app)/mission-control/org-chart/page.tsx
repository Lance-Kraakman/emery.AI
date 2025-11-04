'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loading } from '@/components/ui/loading';
import { CanvasBase } from '@/components/canvas/CanvasBase';

// AIDEV-NOTE: Org chart moved to /mission-control/org-chart for better organization
// AIDEV-NOTE: This prevents hydration issues with client-only ReactFlow components
const OrganizationChart = dynamic(() => import('../../organization/components/OrganizationChartClient'), {
  ssr: false, // ReactFlow needs to run client-side only
  loading: () => <Loading text="Loading organization chart..." />
});

export default function OrgChartPage() {
  return (
    <CanvasBase>
      <OrganizationChart />
    </CanvasBase>
  );
}
