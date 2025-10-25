import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCapability } from '@/app/actions/capabilities';
import { getAgent } from '@/app/actions/agents';
import { EditCapabilityView } from '../components/EditCapabilityView';

interface PageProps {
  params: {
    agentId: string;
    capabilityId: string;
  };
}

export default async function EditCapabilityPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const agentId = parseInt(params.agentId, 10);
  const capabilityId = parseInt(params.capabilityId, 10);

  if (isNaN(agentId) || isNaN(capabilityId)) {
    redirect('/agents');
  }

  // Fetch agent and capability
  const [agent, capabilityResult] = await Promise.all([
    getAgent(agentId),
    getCapability(capabilityId)
  ]);

  if (!agent) {
    redirect('/agents');
  }

  if (!capabilityResult.success || !capabilityResult.data) {
    redirect(`/agents/${agentId}/capabilities`);
  }

  const capability = capabilityResult.data;

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <EditCapabilityView agent={agent} capability={capability} />
      </div>
    </div>
  );
}
