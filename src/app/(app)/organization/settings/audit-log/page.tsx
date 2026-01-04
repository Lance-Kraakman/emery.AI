import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { CanvasBase } from '@/components/canvas';
import { AuditTable } from './components/AuditTable';

export default async function AuditLogPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  return (
    <CanvasBase>
      <div className="container mx-auto p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="text-muted-foreground mt-1">
              Track row changes, user actions, and system events. Click a row to see details.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <AuditTable showFilters={true} mode="audit" />
            </CardContent>
          </Card>
        </div>
      </div>
    </CanvasBase>
  );
}
