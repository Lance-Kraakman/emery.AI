import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { NewOrganizationSkillView } from '../components/NewOrganizationSkillView';

interface PageProps {
  searchParams: Promise<{
    templateId?: string;
  }>;
}

export default async function NewOrganizationSkillPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const organizationId = session.user.currentOrganizationId;

  if (!organizationId) {
    redirect('/organization/setup');
  }

  const resolvedParams = await searchParams;
  const templateId = resolvedParams.templateId ? parseInt(resolvedParams.templateId, 10) : undefined;

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <NewOrganizationSkillView organizationId={organizationId} templateId={templateId} />
      </div>
    </div>
  );
}
