import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSkill } from '@/app/actions/skills';
import { EditOrganizationSkillView } from '../components/EditOrganizationSkillView';

interface PageProps {
  params: Promise<{
    skillId: string;
  }>;
}

export default async function EditOrganizationSkillPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const resolvedParams = await params;
  const skillId = parseInt(resolvedParams.skillId, 10);

  if (isNaN(skillId)) {
    redirect('/skills');
  }

  // Fetch skill
  const skillResult = await getSkill(skillId);

  if (!skillResult.success || !skillResult.data) {
    redirect('/skills');
  }

  const skill = skillResult.data;

  // Verify it's an organization skill (agentId should be null)
  if (skill.agentId !== null) {
    redirect(`/agents/${skill.agentId}/skills/${skill.id}`);
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <EditOrganizationSkillView skill={skill} />
      </div>
    </div>
  );
}
