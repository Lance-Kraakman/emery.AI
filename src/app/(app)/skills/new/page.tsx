import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { NewOrganizationSkillView } from '../components/NewOrganizationSkillView';
import { CenteredCanvasLayout } from '@/components/layouts/CenteredCanvasLayout';

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
    <CenteredCanvasLayout>
      <NewOrganizationSkillView organizationId={organizationId} templateId={templateId} />
    </CenteredCanvasLayout>
  );
}
