/**
 * BillingOverviewCard Component
 *
 * Summary card showing current billing status with quick actions
 */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Calendar, DollarSign, ExternalLink, Settings } from 'lucide-react';
import { formatCurrency, formatBillingDate, getTierDisplayName, getTierVariant } from '@/lib/billing/utils';
import type { TierName } from '@/ddd/infrastructure/external/stripe/config';

export interface BillingOverview {
  tier: TierName;
  subscriptionStatus: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextBillingAmount: number;
  paymentMethodLast4?: string | null;
  paymentMethodBrand?: string | null;
}

export interface BillingOverviewCardProps {
  overview: BillingOverview;
  onManageSubscription?: () => void;
  onManagePaymentMethod?: () => void;
  loadingAction?: boolean;
}

export function BillingOverviewCard({
  overview,
  onManageSubscription,
  onManagePaymentMethod,
  loadingAction = false,
}: BillingOverviewCardProps) {
  const tierDisplayName = getTierDisplayName(overview.tier);
  const tierVariant = getTierVariant(overview.tier);
  const hasActiveSubscription = overview.subscriptionStatus === 'active' || overview.subscriptionStatus === 'trialing';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Billing Overview</CardTitle>
            <CardDescription>Manage your subscription and payment settings</CardDescription>
          </div>
          <Badge variant={tierVariant} className="text-sm">
            {tierDisplayName}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Subscription Status */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Current Plan</p>
              </div>
              <p className="text-2xl font-bold">{tierDisplayName}</p>
              {overview.subscriptionStatus && (
                <Badge variant={hasActiveSubscription ? 'default' : 'secondary'} className="text-xs">
                  {overview.subscriptionStatus}
                </Badge>
              )}
            </div>

            {onManageSubscription && (
              <Button
                size="sm"
                variant="outline"
                onClick={onManageSubscription}
                disabled={loadingAction}
              >
                {loadingAction ? 'Loading...' : 'Change Plan'}
              </Button>
            )}
          </div>

          <Separator />

          {/* Billing Period */}
          {overview.currentPeriodStart && overview.currentPeriodEnd && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Billing Period</span>
              </div>
              <p className="text-sm">
                {formatBillingDate(overview.currentPeriodStart)} -{' '}
                {formatBillingDate(overview.currentPeriodEnd)}
              </p>
            </div>
          )}

          {/* Next Billing Amount */}
          {hasActiveSubscription && overview.nextBillingAmount > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Next Invoice</span>
                </div>
                <p className="text-sm font-medium">{formatCurrency(overview.nextBillingAmount)}</p>
                {overview.currentPeriodEnd && (
                  <p className="text-xs text-muted-foreground">
                    Due {formatBillingDate(overview.currentPeriodEnd)}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Payment Method */}
          {hasActiveSubscription && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span>Payment Method</span>
                  </div>
                  {onManagePaymentMethod && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onManagePaymentMethod}
                      disabled={loadingAction}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {overview.paymentMethodLast4 ? (
                  <p className="text-sm">
                    {overview.paymentMethodBrand || 'Card'} ending in {overview.paymentMethodLast4}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment method on file</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        {!hasActiveSubscription && overview.tier === 'free' && (
          <div className="pt-4 border-t">
            <Button
              className="w-full"
              onClick={onManageSubscription}
              disabled={loadingAction}
            >
              Upgrade to Pro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
