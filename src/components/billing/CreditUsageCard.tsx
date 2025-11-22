/**
 * CreditUsageCard Component
 *
 * Displays credit usage with monthly allowance and overage tracking
 */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Coins, TrendingUp, AlertCircle } from 'lucide-react';
import { formatCredits, formatCurrency, calculatePercentageUsed, calculateOverage } from '@/lib/billing/utils';

export interface CreditUsage {
  creditsUsed: number;
  monthlyAllowance: number;
  overageCredits: number;
  overageCostUsd: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface CreditUsageCardProps {
  usage: CreditUsage;
  tierName?: string;
  showOverage?: boolean;
}

export function CreditUsageCard({ usage, tierName, showOverage = true }: CreditUsageCardProps) {
  const percentageUsed = calculatePercentageUsed(usage.creditsUsed, usage.monthlyAllowance);
  const hasOverage = usage.overageCredits > 0;
  const isApproachingLimit = percentageUsed >= 80 && !hasOverage;

  // Calculate credits remaining in allowance
  const remainingAllowance = Math.max(0, usage.monthlyAllowance - usage.creditsUsed);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Credit Usage</CardTitle>
          </div>
          <Badge variant={hasOverage ? 'destructive' : percentageUsed >= 80 ? 'secondary' : 'outline'}>
            {formatCredits(usage.creditsUsed)} / {formatCredits(usage.monthlyAllowance)}
          </Badge>
        </div>
        <CardDescription>
          Current billing period:{' '}
          {usage.periodStart.toLocaleDateString()} - {usage.periodEnd.toLocaleDateString()}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Allowance Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Monthly Allowance</span>
            <span className="font-medium">
              {formatCredits(remainingAllowance)} credits remaining
            </span>
          </div>
          <Progress value={Math.min(percentageUsed, 100)} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>{formatCredits(usage.monthlyAllowance)}</span>
          </div>
        </div>

        {/* Approaching Limit Warning */}
        {isApproachingLimit && !hasOverage && (
          <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              You've used {percentageUsed}% of your monthly credits. Consider upgrading to avoid overage charges.
            </AlertDescription>
          </Alert>
        )}

        {/* Overage Information */}
        {showOverage && hasOverage && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <h4 className="text-sm font-medium">Overage Usage</h4>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Credits over allowance</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {formatCredits(usage.overageCredits)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Overage cost</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {formatCurrency(usage.overageCostUsd)}
                </span>
              </div>
            </div>

            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You're using credits beyond your monthly allowance. Overage charges will appear on your next invoice.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Usage Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Included allowance</span>
            <span>{formatCredits(Math.min(usage.creditsUsed, usage.monthlyAllowance))}</span>
          </div>

          {hasOverage && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Overage credits</span>
              <span className="text-orange-600 dark:text-orange-400">
                +{formatCredits(usage.overageCredits)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t font-medium">
            <span>Total credits used</span>
            <span>{formatCredits(usage.creditsUsed)}</span>
          </div>
        </div>

        {/* Tier Info */}
        {tierName && (
          <div className="pt-4 border-t text-xs text-muted-foreground">
            <span className="font-medium">{tierName}</span> tier includes {formatCredits(usage.monthlyAllowance)} credits per month
          </div>
        )}
      </CardContent>
    </Card>
  );
}
