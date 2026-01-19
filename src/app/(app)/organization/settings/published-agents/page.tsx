import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CanvasBase } from '@/components/canvas';
import { PublishedAgentsDashboard } from './components/PublishedAgentsDashboard';

export default async function PublishedAgentsPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  return (
    <CanvasBase>
      <div className="h-full flex flex-col">
        <PublishedAgentsDashboard />
      </div>
    </CanvasBase>
  );
}
