/**
 * TierCard Component
 *
 * Displays a pricing tier with features, pricing, and action button
 */
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import { getTierColor, formatCurrency } from '@/lib/billing/utils';
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
  const isDowngrade = currentTier && getTierOrder(tier) < getTierOrder(currentTier);

  return (
    <Card
      className={`relative flex flex-col ${
        highlighted ? 'border-2 border-primary shadow-lg' : ''
      } ${isCurrentTier ? 'border-primary' : ''}`}
    >
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 bg-primary">
            <Sparkles className="h-3 w-3" />
            Popular
          </Badge>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">{config.displayName}</CardTitle>
          {isCurrentTier && (
            <Badge variant="outline" className="ml-2">
              Current Plan
            </Badge>
          )}
        </div>

        <CardDescription className="mt-2">
          <div className="text-3xl font-bold">
            {config.basePrice === 0 ? (
              'Free'
            ) : (
              <>
                {formatCurrency(config.basePrice)}
                <span className="text-base font-normal text-muted-foreground">/month</span>
              </>
            )}
          </div>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {config.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {config.limitations && config.limitations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Limitations:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {config.limitations.map((limitation, index) => (
                <li key={index}>• {limitation}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter>
        {onSelect && (
          <Button
            className="w-full"
            onClick={() => onSelect(tier)}
            disabled={loading || isCurrentTier}
            variant={highlighted ? 'default' : 'outline'}
          >
            {loading ? (
              'Processing...'
            ) : isCurrentTier ? (
              'Current Plan'
            ) : isDowngrade ? (
              'Downgrade'
            ) : (
              'Upgrade'
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {tiers.map((tier) => (
        <TierCard
          key={tier}
          tier={tier}
          currentTier={currentTier}
          onSelect={onSelectTier}
          loading={loading}
          highlighted={tier === 'pro'} // Highlight Pro tier as recommended
        />
      ))}
    </div>
  );
}
