import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSkillsByAgent } from '@/app/actions/skills';
import { getAgent } from '@/app/actions/agents';
import { SkillsListView } from './components/SkillsListView';

interface PageProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function SkillsPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const resolvedParams = await params;
  const agentId = parseInt(resolvedParams.agentId, 10);

  if (isNaN(agentId)) {
    redirect('/agents');
  }

  // Fetch agent and skills
  const [agent, skillsResult] = await Promise.all([
    getAgent(agentId),
    getSkillsByAgent(agentId)
  ]);

  if (!agent) {
    redirect('/agents');
  }

  const skills = skillsResult.success ? skillsResult.data : [];

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <SkillsListView
          agent={agent}
          initialSkills={skills || []}
        />
      </div>
    </div>
  );
}
