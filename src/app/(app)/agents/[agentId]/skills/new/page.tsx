import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAgent } from '@/app/actions/agents';
import { NewSkillView } from '../components/NewSkillView';

interface PageProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function NewSkillPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const resolvedParams = await params;
  const agentId = parseInt(resolvedParams.agentId, 10);

  if (isNaN(agentId)) {
    redirect('/agents');
  }

  // Fetch agent
  const agent = await getAgent(agentId);

  if (!agent) {
    redirect('/agents');
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <NewSkillView agent={agent} />
      </div>
    </div>
  );
}
