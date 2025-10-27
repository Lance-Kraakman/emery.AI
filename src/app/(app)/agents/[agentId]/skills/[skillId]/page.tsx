import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSkill } from '@/app/actions/skills';
import { getAgent } from '@/app/actions/agents';
import { EditSkillView } from '../components/EditSkillView';

interface PageProps {
  params: Promise<{
    agentId: string;
    skillId: string;
  }>;
}

export default async function EditSkillPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const resolvedParams = await params;
  const agentId = parseInt(resolvedParams.agentId, 10);
  const skillId = parseInt(resolvedParams.skillId, 10);

  if (isNaN(agentId) || isNaN(skillId)) {
    redirect('/agents');
  }

  // Fetch agent and skill
  const [agent, skillResult] = await Promise.all([
    getAgent(agentId),
    getSkill(skillId)
  ]);

  if (!agent) {
    redirect('/agents');
  }

  if (!skillResult.success || !skillResult.data) {
    redirect(`/agents/${agentId}/skills`);
  }

  const skill = skillResult.data;

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <EditSkillView agent={agent} skill={skill} />
      </div>
    </div>
  );
}
