import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CanvasBase } from '@/components/canvas';
import { SecurityDashboard } from './components/SecurityDashboard';

export default async function SecurityPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  return (
    <CanvasBase>
      <div className="h-full flex flex-col">
        <SecurityDashboard />
      </div>
    </CanvasBase>
  );
}
