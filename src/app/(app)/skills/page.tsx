import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSkillsByOrganization } from '@/app/actions/skills';
import { OrganizationSkillsListView } from './components/OrganizationSkillsListView';

export default async function OrganizationSkillsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Get user's organization ID from session
  const organizationId = session.user.currentOrganizationId;

  if (!organizationId) {
    redirect('/organization/setup');
  }

  // Fetch ALL skills for the organization (both org and agent-scoped)
  const skillsResult = await getSkillsByOrganization(organizationId);
  const skills = skillsResult.success ? skillsResult.data : [];

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <OrganizationSkillsListView
          organizationId={organizationId}
          initialSkills={skills || []}
        />
      </div>
    </div>
  );
}
