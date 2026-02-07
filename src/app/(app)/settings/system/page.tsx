import { Suspense } from 'react';
import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SystemSettingsClient } from './SystemSettingsClient';
import { getOrganizationSettings } from '@/app/actions/organizations';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'System Settings',
  description: 'Manage system-wide settings and organization configuration',
};

export default async function SystemSettingsPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  // Fetch organization data via server action (has RLS context)
  const orgResult = await getOrganizationSettings();

  if (!orgResult.success || !orgResult.data) {
    redirect('/login');
  }

  const organization = orgResult.data;

  return (
    <div className="container mx-auto py-4 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage system-wide settings and organization configuration
          </p>
        </div>

        {/* Settings Content */}
        <Suspense fallback={<SystemSettingsSkeleton />}>
          <SystemSettingsClient
            organizationId={session.user.currentOrganizationId}
            organizationTier={(organization.plan || 'free') as 'free' | 'pro' | 'max' | 'enterprise'}
            currentModel={organization.defaultModel || null}
            availableModels={organization.availableModels || []}
          />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for system settings
 */
function SystemSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[120px]" />
      <Skeleton className="h-[200px]" />
    </div>
  );
}
