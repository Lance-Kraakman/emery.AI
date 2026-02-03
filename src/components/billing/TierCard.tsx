/**
 * TierCard Component
 *
 * Compact pricing tier card showing plan name, price, and key stats
 */
'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Coins, Users, HardDrive } from 'lucide-react';
import { formatCurrency } from '@/lib/billing/utils';
import { getTierConfig, type TierName } from '@/ddd/infrastructure/external/stripe/config';

export interface TierCardProps {
  tier: TierName;
  currentTier?: TierName;
  onSelect?: (tier: TierName) => void;
  loading?: boolean;
  highlighted?: boolean;
}

export function TierCard({
  tier,
  currentTier,
  onSelect,
  loading = false,
  highlighted = false,
}: TierCardProps) {
  const config = getTierConfig(tier);
  const isCurrentTier = currentTier === tier;
  const isUpgrade = currentTier && getTierOrder(tier) > getTierOrder(currentTier);

  return (
    <Card
      className={`relative flex flex-col ${
        highlighted ? 'border-2 border-primary shadow-lg' : ''
      } ${isCurrentTier ? 'border-primary' : ''}`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 bg-primary text-xs px-2 py-0.5">
            <Sparkles className="h-3 w-3" />
            Popular
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pt-4 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{config.displayName}</CardTitle>
          {isCurrentTier && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Current
            </Badge>
          )}
        </div>

        <div className="mt-1">
          {config.isCustomPricing ? (
            <div className="text-xl font-bold">Custom</div>
          ) : config.basePrice === 0 ? (
            <div className="text-xl font-bold">Free</div>
          ) : (
            <div className="text-xl font-bold">
              {formatCurrency(config.basePrice)}
              <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-3 pb-2">
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Coins className="h-3 w-3 flex-shrink-0" />
            <span>
              {config.isCustomPricing
                ? 'Custom credits'
                : `${config.creditsPerMonth.toLocaleString()} credits/mo`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 flex-shrink-0" />
            <span>
              {config.isCustomPricing
                ? 'Unlimited'
                : config.maxTeamMembers
                  ? `${config.maxTeamMembers} members`
                  : 'Unlimited members'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3 w-3 flex-shrink-0" />
            <span>
              {config.isCustomPricing
                ? 'Custom storage'
                : `${config.storageQuotaGB}GB storage`}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-3 pb-3 pt-0">
        {onSelect && (
          <Button
            className="w-full h-8 text-xs"
            onClick={() => onSelect(tier)}
            disabled={loading || isCurrentTier}
            variant={isCurrentTier ? 'outline' : highlighted ? 'default' : 'outline'}
            size="sm"
          >
            {loading ? (
              'Processing...'
            ) : isCurrentTier ? (
              'Current Plan'
            ) : tier === 'enterprise' ? (
              'Contact Sales'
            ) : isUpgrade ? (
              'Upgrade'
            ) : (
              'Select'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Helper to determine tier order for comparison
 */
function getTierOrder(tier: TierName): number {
  const order: Record<TierName, number> = {
    free: 0,
    pro: 1,
    max: 2,
    enterprise: 3,
  };
  return order[tier] || 0;
}

/**
 * Grid layout for multiple tier cards
 */
export interface TierGridProps {
  currentTier?: TierName;
  onSelectTier?: (tier: TierName) => void;
  loading?: boolean;
}

export function TierGrid({ currentTier, onSelectTier, loading }: TierGridProps) {
  const tiers: TierName[] = ['free', 'pro', 'max', 'enterprise'];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiers.map((tier) => (
        <TierCard
          key={tier}
          tier={tier}
          currentTier={currentTier}
          onSelect={onSelectTier}
          loading={loading}
          highlighted={tier === 'max'}
        />
      ))}
    </div>
  );
}
