'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loading } from '@/components/ui/loading';
import { CanvasBase } from '@/components/canvas';

// AIDEV-NOTE: Organization page updated to use canvas architecture with ReactFlow support
// AIDEV-NOTE: This prevents hydration issues with client-only ReactFlow components
const OrganizationChart = dynamic(() => import('./components/OrganizationChartClient'), {
  ssr: false, // ReactFlow needs to run client-side only
  loading: () => <Loading text="Loading organization chart..." />
});

export default function OrganizationPage() {
  return ( 
    <CanvasBase>
      <OrganizationChart />
    </CanvasBase>
  );
}
