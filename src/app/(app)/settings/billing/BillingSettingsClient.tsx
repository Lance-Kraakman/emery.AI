/**
 * Billing Settings Client Component
 *
 * Interactive billing interface with subscription management and usage monitoring
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillingOverviewCard } from '@/components/billing/BillingOverviewCard';
import { TierCard, TierGrid } from '@/components/billing/TierCard';
import { StorageUsageCard } from '@/components/billing/StorageUsageCard';
import { CreditUsageCard } from '@/components/billing/CreditUsageCard';
import { SpendingLimitControl } from '@/components/billing/SpendingLimitControl';
import { InvoiceList } from '@/components/billing/InvoiceList';
import { CreditBreakdownTabs } from '@/components/billing/CreditBreakdownTabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TrendingUp, Sparkles, X, Mail, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { createCheckoutSession, createPaymentMethodPortalSession, setSpendingLimit } from '@/app/actions/billing';
import type { StorageUsageBreakdown } from '@/ddd/application/services/billing/storage-quota-application-service';
import type { TierName } from '@/ddd/infrastructure/external/stripe/config';
import type { StorageUsage } from '@/components/billing/StorageUsageCard';
import type { CreditUsage } from '@/components/billing/CreditUsageCard';
import type { BillingOverview } from '@/components/billing/BillingOverviewCard';
import type { Invoice } from '@/components/billing/InvoiceList';
import type { BreakdownItem } from '@/components/billing/CreditBreakdownTabs';

export interface BillingSettingsClientProps {
  billingStatus: any; // From getBillingStatus action
  storageUsage: StorageUsageBreakdown | StorageUsage | null;
  invoices: Invoice[];
  organizationId: number;
  modelBreakdown: BreakdownItem[];
}

export function BillingSettingsClient({
  billingStatus,
  storageUsage,
  invoices,
  organizationId,
  modelBreakdown,
}: BillingSettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showEnterpriseDialog, setShowEnterpriseDialog] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);

  // Check for welcome query param and session storage
  useEffect(() => {
    const isWelcome = searchParams?.get('welcome') === 'true';
    const hasSeenWelcome = sessionStorage.getItem('billing-welcome-seen') === 'true';

    if (isWelcome && !hasSeenWelcome) {
      setShowWelcome(true);
    }
  }, [searchParams]);

  // Handle welcome banner dismissal
  const handleDismissWelcome = () => {
    setShowWelcome(false);
    sessionStorage.setItem('billing-welcome-seen', 'true');
  };

  // Handle "Start Building" button
  const handleStartBuilding = () => {
    handleDismissWelcome();
    router.push('/mission-control');
  };

  // Handle "Explore Plans" button
  const handleExplorePlans = () => {
    handleDismissWelcome();
    setSelectedTab('plans');
  };

  // Parse billing status
  const tier: TierName = (billingStatus?.tier || 'free') as TierName;
  const hasActiveSubscription = billingStatus?.subscriptionStatus === 'active' ||
    billingStatus?.subscriptionStatus === 'trialing';

  // Prepare overview data
  const overview: BillingOverview = {
    tier,
    subscriptionStatus: billingStatus?.subscriptionStatus || null,
    currentPeriodStart: billingStatus?.periodStart ? new Date(billingStatus.periodStart) : null,
    currentPeriodEnd: billingStatus?.periodEnd ? new Date(billingStatus.periodEnd) : null,
    nextBillingAmount: billingStatus?.nextInvoiceAmount || 0,
    paymentMethodLast4: billingStatus?.paymentMethod?.last4 || null,
    paymentMethodBrand: billingStatus?.paymentMethod?.brand || null,
  };

  // Prepare credit usage data
  const creditUsage: CreditUsage | null = billingStatus ? {
    creditsUsed: billingStatus.usedCredits || 0,
    monthlyAllowance: billingStatus.allowanceCredits || 0,
    overageCredits: Math.max(0, (billingStatus.usedCredits || 0) - (billingStatus.allowanceCredits || 0)),
    overageCostUsd: billingStatus.overageCostUsd || 0,
    periodStart: billingStatus.periodStart ? new Date(billingStatus.periodStart) : new Date(),
    periodEnd: billingStatus.periodEnd ? new Date(billingStatus.periodEnd) : new Date(),
  } : null;

  /**
   * Handle tier selection and upgrade
   */
  const handleSelectTier = async (selectedTier: TierName) => {
    if (selectedTier === 'free') {
      toast.info('To downgrade to Free tier, please contact support');
      return;
    }

    if (selectedTier === 'enterprise') {
      setShowEnterpriseDialog(true);
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
   * Open Stripe Portal for payment method update only
   */
  const handleUpdatePaymentMethod = async () => {
    try {
      setLoadingAction(true);

      const result = await createPaymentMethodPortalSession();

      if (!result.success || !result.portalUrl) {
        throw new Error(result.error || 'Failed to open payment method update');
      }

      window.location.href = result.portalUrl;
    } catch (error) {
      console.error('Error opening payment method update:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open payment method update');
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
    } catch (error) {
      throw error; // Re-throw so component can handle it
    }
  };

  return (
    <div className="space-y-4">
      {/* Welcome Banner for New Organizations */}
      {showWelcome && (
        <Alert className="relative border-green-500 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
          <Sparkles className="h-5 w-5 text-green-600" />
          <AlertDescription className="pr-8">
            <div className="flex flex-col gap-2">
              <div className="text-base font-semibold text-green-900 dark:text-green-100">
                Welcome! Your workspace is ready on the Free plan
              </div>
              <div className="text-sm text-green-800 dark:text-green-200">
                <strong>Free Plan includes:</strong> 1GB storage, 3 team members, 1,000 credits/month
              </div>
              <div className="flex gap-3 mt-1">
                <Button
                  onClick={handleExplorePlans}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  Explore Plans
                </Button>
                <Button
                  onClick={handleStartBuilding}
                  variant="outline"
                  size="sm"
                >
                  Start Building
                </Button>
              </div>
            </div>
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={handleDismissWelcome}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {/* Alert for Free Tier */}
      {tier === 'free' && !showWelcome && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            You&apos;re on the Free tier. Upgrade to Pro for unlimited team members, 10GB storage, and unlimited connectors.
            <Button
              variant="link"
              className="p-0 h-auto ml-2 text-blue-600 dark:text-blue-400"
              onClick={() => setSelectedTab('plans')}
            >
              View plans →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs - 3 tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Overview Tab (merged Overview + Usage & Limits) */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Billing Overview */}
            <BillingOverviewCard
              overview={overview}
              onUpdatePaymentMethod={hasActiveSubscription ? handleUpdatePaymentMethod : undefined}
              onNavigateToPlans={() => setSelectedTab('plans')}
              loadingAction={loadingAction}
            />

            {/* Storage Usage */}
            {storageUsage && (
              <StorageUsageCard
                usage={storageUsage}
                tierName={tier}
                onUpgrade={() => setSelectedTab('plans')}
              />
            )}
          </div>

          {/* Credit Usage + Breakdown */}
          {creditUsage && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CreditUsageCard
                usage={creditUsage}
                tierName={tier}
                showOverage={true}
                hidePeriod={tier === 'free'}
              />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Usage Breakdown</CardTitle>
                  <CardDescription className="text-xs">
                    Credit usage by model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CreditBreakdownTabs
                    organizationId={organizationId}
                    modelBreakdown={modelBreakdown}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Spending Limit Control */}
          {hasActiveSubscription && (
            <SpendingLimitControl
              currentLimit={billingStatus?.spendingLimitUsd ? parseFloat(billingStatus.spendingLimitUsd) : null}
              onSave={handleSaveSpendingLimit}
            />
          )}
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          {!showAllPlans ? (
            <>
              {/* Default: Show current plan centered */}
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1">Your Plan</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {tier === 'enterprise' ? 'Enterprise plan with custom terms' : `You're on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan`}
                </p>
              </div>

              <div className="max-w-sm mx-auto">
                <TierCard
                  tier={tier}
                  currentTier={tier}
                  variant="featured"
                  highlighted
                />
              </div>

              {/* Upgrade button - upsell logic */}
              {tier === 'free' && (
                <div className="flex justify-center">
                  <Button onClick={() => setShowAllPlans(true)}>
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                </div>
              )}
              {tier === 'pro' && (
                <div className="flex justify-center">
                  <Button onClick={() => handleSelectTier('max')} disabled={loadingAction}>
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Upgrade to Max
                  </Button>
                </div>
              )}
              {tier === 'max' && (
                <div className="flex justify-center">
                  <Button onClick={() => handleSelectTier('enterprise')} disabled={loadingAction}>
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Upgrade to Enterprise
                  </Button>
                </div>
              )}

              {/* Link to expand all plans */}
              <div className="text-center pt-2">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  onClick={() => setShowAllPlans(true)}
                >
                  Need to change your plan? View all plans
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Expanded: Show all 4 plans */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">All Plans</h3>
                  <p className="text-muted-foreground text-sm">
                    Compare plans and choose what fits your needs.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllPlans(false)}
                  className="text-xs"
                >
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Back
                </Button>
              </div>

              <TierGrid
                currentTier={tier}
                onSelectTier={handleSelectTier}
                loading={loadingAction}
              />

              {/* Subtle downgrade link */}
              {hasActiveSubscription && tier !== 'free' && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Need to downgrade or cancel?{' '}
                  <button
                    className="underline hover:text-foreground"
                    onClick={() => toast.info('To downgrade or cancel, please contact support at support@enhancd.ai')}
                  >
                    Contact support
                  </button>
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <InvoiceList
            invoices={invoices}
            emptyMessage={
              hasActiveSubscription
                ? 'No invoices yet. Your first invoice will appear here after your billing period.'
                : 'No invoices yet. Upgrade to a paid plan to view billing history.'
            }
          />
        </TabsContent>
      </Tabs>

      {/* Enterprise Contact Dialog */}
      <Dialog open={showEnterpriseDialog} onOpenChange={setShowEnterpriseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enterprise Plan</DialogTitle>
            <DialogDescription>
              Get custom pricing, dedicated support, and advanced features tailored to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Enterprise includes:</p>
              <ul className="space-y-1 ml-4">
                <li>- Custom credit allowance</li>
                <li>- Dedicated account manager</li>
                <li>- Custom storage quota</li>
                <li>- SLA guarantees</li>
                <li>- On-premise deployment options</li>
                <li>- Custom contracts & payment terms</li>
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  window.location.href = 'mailto:sales@enhancd.ai?subject=Enterprise%20Plan%20Inquiry';
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Sales
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                sales@enhancd.ai
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
