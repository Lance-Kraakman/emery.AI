/**
 * Billing Settings Client Component
 *
 * Interactive billing interface with subscription management and usage monitoring
 */
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillingOverviewCard } from '@/components/billing/BillingOverviewCard';
import { TierGrid } from '@/components/billing/TierCard';
import { StorageUsageCard } from '@/components/billing/StorageUsageCard';
import { CreditUsageCard } from '@/components/billing/CreditUsageCard';
import { SpendingLimitControl } from '@/components/billing/SpendingLimitControl';
import { InvoiceList } from '@/components/billing/InvoiceList';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, AlertCircle, CreditCard, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { createCheckoutSession, createPortalSession, setSpendingLimit } from '@/app/actions/billing';
import type { TierName } from '@/lib/stripe/config';
import type { StorageUsage } from '@/components/billing/StorageUsageCard';
import type { CreditUsage } from '@/components/billing/CreditUsageCard';
import type { BillingOverview } from '@/components/billing/BillingOverviewCard';
import type { Invoice } from '@/components/billing/InvoiceList';

export interface BillingSettingsClientProps {
  billingStatus: any; // From getBillingStatus action
  storageUsage: StorageUsage | null;
  invoices: Invoice[];
  organizationId: number;
}

export function BillingSettingsClient({
  billingStatus,
  storageUsage,
  invoices,
  organizationId,
}: BillingSettingsClientProps) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  // Parse billing status
  const tier: TierName = (billingStatus?.tier || 'free') as TierName;
  const hasActiveSubscription = billingStatus?.subscriptionStatus === 'active' ||
    billingStatus?.subscriptionStatus === 'trialing';

  // Prepare overview data
  const overview: BillingOverview = {
    tier,
    subscriptionStatus: billingStatus?.subscriptionStatus || null,
    currentPeriodStart: billingStatus?.currentPeriodStart ? new Date(billingStatus.currentPeriodStart) : null,
    currentPeriodEnd: billingStatus?.currentPeriodEnd ? new Date(billingStatus.currentPeriodEnd) : null,
    nextBillingAmount: billingStatus?.nextInvoiceAmount || 0,
    paymentMethodLast4: billingStatus?.paymentMethod?.last4 || null,
    paymentMethodBrand: billingStatus?.paymentMethod?.brand || null,
  };

  // Prepare credit usage data
  const creditUsage: CreditUsage | null = billingStatus ? {
    creditsUsed: billingStatus.creditsUsed || 0,
    monthlyAllowance: billingStatus.monthlyAllowance || 0,
    overageCredits: Math.max(0, (billingStatus.creditsUsed || 0) - (billingStatus.monthlyAllowance || 0)),
    overageCostUsd: billingStatus.overageCost || 0,
    periodStart: billingStatus.currentPeriodStart ? new Date(billingStatus.currentPeriodStart) : new Date(),
    periodEnd: billingStatus.currentPeriodEnd ? new Date(billingStatus.currentPeriodEnd) : new Date(),
  } : null;

  /**
   * Handle tier selection and upgrade
   */
  const handleSelectTier = async (selectedTier: TierName) => {
    if (selectedTier === 'free') {
      toast.info('To downgrade to Free tier, please cancel your subscription from the billing portal');
      return;
    }

    if (selectedTier === 'enterprise') {
      toast.info('For Enterprise pricing, please contact our sales team');
      // TODO: Add contact sales link or modal
      return;
    }

    try {
      setLoadingAction(true);

      const result = await createCheckoutSession(selectedTier, 'month');

      if (!result.success || !result.checkoutUrl) {
        throw new Error(result.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = result.checkoutUrl;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start upgrade process');
      setLoadingAction(false);
    }
  };

  /**
   * Open Stripe Customer Portal for subscription management
   */
  const handleManageSubscription = async () => {
    try {
      setLoadingAction(true);

      const result = await createPortalSession();

      if (!result.success || !result.portalUrl) {
        throw new Error(result.error || 'Failed to open billing portal');
      }

      // Redirect to Stripe Portal
      window.location.href = result.portalUrl;
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open billing portal');
      setLoadingAction(false);
    }
  };

  /**
   * Update spending limit
   */
  const handleSaveSpendingLimit = async (newLimit: number | null) => {
    try {
      const result = await setSpendingLimit(newLimit);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update spending limit');
      }

      // Success toast is handled by the SpendingLimitControl component
    } catch (error) {
      throw error; // Re-throw so component can handle it
    }
  };

  return (
    <div className="space-y-8">
      {/* Alert for Free Tier */}
      {tier === 'free' && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            You're on the Free tier. Upgrade to Pro for unlimited team members, 10GB storage, and unlimited connectors.
            <Button
              variant="link"
              className="p-0 h-auto ml-2 text-blue-600 dark:text-blue-400"
              onClick={() => handleSelectTier('pro')}
            >
              Upgrade now →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage & Limits</TabsTrigger>
          <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Billing Overview */}
            <BillingOverviewCard
              overview={overview}
              onManageSubscription={handleManageSubscription}
              onManagePaymentMethod={handleManageSubscription}
              loadingAction={loadingAction}
            />

            {/* Storage Usage */}
            {storageUsage && (
              <StorageUsageCard
                usage={storageUsage}
                tierName={tier}
                onUpgrade={() => handleSelectTier('pro')}
              />
            )}
          </div>

          {/* Credit Usage */}
          {creditUsage && hasActiveSubscription && (
            <CreditUsageCard
              usage={creditUsage}
              tierName={tier}
              showOverage={true}
            />
          )}

          {/* Spending Limit Control */}
          {hasActiveSubscription && (
            <SpendingLimitControl
              currentLimit={billingStatus?.spendingLimitUsd ? parseFloat(billingStatus.spendingLimitUsd) : null}
              onSave={handleSaveSpendingLimit}
            />
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-4 pt-4">
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={loadingAction}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Billing
            </Button>
            {!hasActiveSubscription && tier === 'free' && (
              <Button onClick={() => handleSelectTier('pro')} disabled={loadingAction}>
                Upgrade to Pro
              </Button>
            )}
          </div>
        </TabsContent>

        {/* Usage & Limits Tab */}
        <TabsContent value="usage" className="space-y-6">
          {storageUsage && (
            <StorageUsageCard
              usage={storageUsage}
              tierName={tier}
              onUpgrade={() => handleSelectTier('pro')}
            />
          )}

          {creditUsage && (
            <CreditUsageCard
              usage={creditUsage}
              tierName={tier}
              showOverage={true}
            />
          )}

          {hasActiveSubscription && (
            <SpendingLimitControl
              currentLimit={billingStatus?.spendingLimitUsd ? parseFloat(billingStatus.spendingLimitUsd) : null}
              onSave={handleSaveSpendingLimit}
            />
          )}
        </TabsContent>

        {/* Plans & Pricing Tab */}
        <TabsContent value="plans" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Choose Your Plan</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Select the plan that best fits your needs. All plans include core features with increasing limits.
            </p>
          </div>

          <TierGrid
            currentTier={tier}
            onSelectTier={handleSelectTier}
            loading={loadingAction}
          />

          <Separator />

          <div className="space-y-4 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">Billing Information</h4>
            <ul className="space-y-2 ml-4">
              <li>• All plans are billed monthly</li>
              <li>• Overage charges apply at $0.0025 per credit beyond monthly allowance</li>
              <li>• You can upgrade or downgrade at any time</li>
              <li>• Changes take effect at the start of the next billing period</li>
              <li>• Storage quotas are enforced in real-time</li>
            </ul>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <InvoiceList
            invoices={invoices}
            emptyMessage={
              hasActiveSubscription
                ? 'No invoices yet. Your first invoice will appear here after your billing period.'
                : 'No invoices yet. Upgrade to a paid plan to view billing history.'
            }
          />

          {hasActiveSubscription && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={loadingAction}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View All in Billing Portal
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
