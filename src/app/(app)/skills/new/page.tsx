import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { NewOrganizationSkillView } from '../components/NewOrganizationSkillView';
import { CanvasBase } from '@/components/canvas/CanvasBase';

interface PageProps {
  searchParams: Promise<{
    templateId?: string;  // Saved template ID (number)
    builtinId?: string;   // Builtin template ID (e.g., 'skill/table-operations')
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
  const builtinId = resolvedParams.builtinId;

  return (
    <CanvasBase>
      <NewOrganizationSkillView
        organizationId={organizationId}
        templateId={templateId}
        builtinId={builtinId}
      />
    </CanvasBase>
  );
}
