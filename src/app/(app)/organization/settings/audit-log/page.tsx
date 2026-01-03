import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
              View all actions and changes made across your organization.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Activity History</CardTitle>
              <CardDescription>
                Track row changes, user actions, and system events. Click a row to see details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTable showFilters={true} mode="audit" />
            </CardContent>
          </Card>
        </div>
      </div>
    </CanvasBase>
  );
}
