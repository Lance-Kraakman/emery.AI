import React, { Suspense } from 'react';
import { getApps } from '@/app/actions/puck-apps';
import { Loading } from '@/components/ui/loading';
import { auth } from '@/lib/auth';
import { AppsPage as AppsPageLayout } from '@/components/canvas';
import AppsDashboardClient from './components/AppsDashboardClient';

// AIDEV-NOTE: Apps page for Puck CMS visual page builder management
// Uses canvas architecture with collapsible layout for chat integration

export default async function AppsPage() {
  // Get current user's organization
  const session = await auth();
  const organizationId = session?.user?.currentOrganizationId;

  if (!organizationId) {
    return (
      <AppsPageLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No organization selected</p>
        </div>
      </AppsPageLayout>
    );
  }

  // Fetch initial data on the server
  const apps = await getApps();

  return (
    <AppsPageLayout>
      <Suspense fallback={<Loading text="Loading apps..." />}>
        <AppsDashboardClient initialApps={apps} />
      </Suspense>
    </AppsPageLayout>
  );
}
