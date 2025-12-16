/**
 * Billing Settings Page (Server Component)
 *
 * Fetches billing data and renders the billing settings interface
 */
import { Suspense } from 'react';
import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getStorageQuotaApplicationService } from '@/ddd/application/di/container';
import { getBillingStatus } from '@/app/actions/billing';
import { getOrganizationInvoices } from '@/app/actions/invoices';
import { getCreditBreakdownByModel } from '@/app/actions/credits';
import { BillingSettingsClient } from './BillingSettingsClient';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/components/billing/InvoiceList';
import type { StorageUsage } from '@/components/billing/StorageUsageCard';
import type { InvoiceDTO } from '@/ddd/application/services/billing/invoice-application-service';
import type { StorageUsageBreakdown } from '@/ddd/application/services/billing/storage-quota-application-service';
import type { BreakdownItem } from '@/components/billing/CreditBreakdownTabs';

export const metadata: Metadata = {
  title: 'Billing Settings',
  description: 'Manage your subscription, usage, and billing information',
};

export default async function BillingSettingsPage() {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const organizationId = session.user.currentOrganizationId;
  if (!organizationId) {
    redirect('/setup');
  }

  // Fetch billing data and credit breakdowns
  const [
    billingStatusResult,
    storageUsageResult,
    invoicesResult,
    modelBreakdownResult,
  ] = await Promise.all([
    getBillingStatus(),
    getStorageQuotaApplicationService().getUsageBreakdown(organizationId),
    getOrganizationInvoices(10, 0),
    getCreditBreakdownByModel(organizationId),
  ]);

  // Handle errors gracefully
  const billingStatus = billingStatusResult.success ? billingStatusResult : null;

  // StorageUsageBreakdown is compatible with StorageUsage (same properties)
  const storageUsage: StorageUsage | null = storageUsageResult.success && storageUsageResult.data
    ? storageUsageResult.data
    : null;

  // Map InvoiceDTO[] to Invoice[]
  const invoiceDTOs = invoicesResult.success ? (invoicesResult.invoices || []) : [];
  const invoices: Invoice[] = invoiceDTOs.map((dto: InvoiceDTO) => ({
    id: dto.id.toString(),
    invoiceNumber: dto.stripeInvoiceId || `INV-${dto.id}`,
    amountDue: dto.totalAmountUsd,
    amountPaid: dto.status === 'paid' ? dto.totalAmountUsd : 0,
    status: dto.status as 'paid' | 'pending' | 'failed' | 'draft',
    createdAt: dto.createdAt,
    dueDate: dto.invoicedAt || null,
    paidAt: dto.paidAt || null,
    hostedInvoiceUrl: null, // Not available in InvoiceDTO
    invoicePdf: null, // Not available in InvoiceDTO
  }));

  // Extract credit breakdown data (only model breakdown is currently implemented)
  const modelBreakdown: BreakdownItem[] = modelBreakdownResult.success && modelBreakdownResult.data ? modelBreakdownResult.data : [];

  return (
    <div className="container mx-auto py-4 px-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Usage</h1>
        </div>

        {/* Client Component with Data */}
        <Suspense fallback={<BillingSettingsSkeleton />}>
          <BillingSettingsClient
            billingStatus={billingStatus}
            storageUsage={storageUsage}
            invoices={invoices}
            organizationId={organizationId}
            modelBreakdown={modelBreakdown}
          />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for billing settings
 */
function BillingSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
      </div>
      <Skeleton className="h-[300px]" />
      <Skeleton className="h-[300px]" />
      <Skeleton className="h-[400px]" />
    </div>
  );
}
