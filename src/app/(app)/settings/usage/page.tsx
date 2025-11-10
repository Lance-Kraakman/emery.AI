import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UsageSettingsClient } from './UsageSettingsClient';
import { getOrganizationRepository } from '@/ddd/application/di/getters';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export const metadata = {
  title: 'Usage & Billing | Organization Settings',
  description: 'Manage credit usage, view breakdowns, and configure AI models for your organization',
};

export default async function UsageSettingsPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  // Fetch organization data
  const orgRepo = getOrganizationRepository();
  const organization = await orgRepo.findById(
    OrganizationId.fromNumber(session.user.currentOrganizationId)
  );

  if (!organization) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Usage & Billing</h1>
          <p className="text-muted-foreground">
            Monitor token usage, configure model access, and manage billing for your organization.
          </p>
        </div>

        {/* Usage Settings Content */}
        <Suspense fallback={<div>Loading...</div>}>
          <UsageSettingsClient
            organizationId={session.user.currentOrganizationId}
            organizationTier={organization.tier || 'free'}
            currentModel={organization.defaultModel || null}
            availableModels={organization.availableModels || []}
            tokenQuota={organization.tokenQuotaMonthly || null}
            creditBalance={organization.creditBalance || 0}
          />
        </Suspense>
      </div>
    </div>
  );
}
