import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAgent } from '@/app/actions/agents';
import { NewSkillView } from '../components/NewSkillView';
import { CenteredCanvasLayout } from '@/components/layouts/CenteredCanvasLayout';

interface PageProps {
  params: Promise<{
    agentId: string;
  }>;
  searchParams: Promise<{
    templateId?: string;
  }>;
}

export default async function NewSkillPage({ params, searchParams }: PageProps) {
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

  // Parse templateId from search params
  const resolvedSearchParams = await searchParams;
  const templateId = resolvedSearchParams.templateId
    ? parseInt(resolvedSearchParams.templateId, 10)
    : undefined;

  return (
    <CenteredCanvasLayout>
      <NewSkillView agent={agent} templateId={templateId} />
    </CenteredCanvasLayout>
  );
}
