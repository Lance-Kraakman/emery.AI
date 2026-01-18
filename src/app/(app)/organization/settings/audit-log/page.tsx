import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CanvasBase } from '@/components/canvas';
import { AuditTable } from './components/AuditTable';

export default async function AuditLogPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  return (
    <CanvasBase>
      <div className="h-full flex flex-col">
        <AuditTable showFilters={true} mode="audit" />
      </div>
    </CanvasBase>
  );
}
