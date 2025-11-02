import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAgent } from '@/app/actions/agents';
import { getSkillsByAgent } from '@/app/actions/skills';
import { SkillsListView } from './components/SkillsListView';
import { CenteredCanvasLayout } from '@/components/layouts/CenteredCanvasLayout';

interface PageProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function SkillsListPage({ params }: PageProps) {
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

  // Fetch skills for this agent
  const skillsResult = await getSkillsByAgent(agentId);
  const skills = skillsResult.success ? skillsResult.data || [] : [];

  return (
    <CenteredCanvasLayout>
      <SkillsListView agent={agent} skills={skills} />
    </CenteredCanvasLayout>
  );
}
