import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCapabilitiesByAgent } from '@/app/actions/capabilities';
import { getAgent } from '@/app/actions/agents';
import { CapabilitiesListView } from './components/CapabilitiesListView';

interface PageProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function CapabilitiesPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const resolvedParams = await params;
  const agentId = parseInt(resolvedParams.agentId, 10);

  if (isNaN(agentId)) {
    redirect('/agents');
  }

  // Fetch agent and capabilities
  const [agent, capabilitiesResult] = await Promise.all([
    getAgent(agentId),
    getCapabilitiesByAgent(agentId)
  ]);

  if (!agent) {
    redirect('/agents');
  }

  const capabilities = capabilitiesResult.success ? capabilitiesResult.data : [];

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <CapabilitiesListView
          agent={agent}
          initialCapabilities={capabilities || []}
        />
      </div>
    </div>
  );
}
