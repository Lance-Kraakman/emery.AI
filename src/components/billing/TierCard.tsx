/**
 * TierCard Component
 *
 * Two variants:
 * - compact: for the 4-plan grid view (minimal stats)
 * - featured: for the single current-plan display (more details, centered)
 */
'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Coins, Users, HardDrive, Plug, Code, Headphones } from 'lucide-react';
import { formatCurrency } from '@/lib/billing/utils';
import { getTierConfig, type TierName } from '@/ddd/infrastructure/external/stripe/config';

export interface TierCardProps {
  tier: TierName;
  currentTier?: TierName;
  onSelect?: (tier: TierName) => void;
  loading?: boolean;
  highlighted?: boolean;
  variant?: 'compact' | 'featured';
}

export function TierCard({
  tier,
  currentTier,
  onSelect,
  loading = false,
  highlighted = false,
  variant = 'compact',
}: TierCardProps) {
  const config = getTierConfig(tier);
  const isCurrentTier = currentTier === tier;
  const isUpgrade = currentTier && getTierOrder(tier) > getTierOrder(currentTier);

  if (variant === 'featured') {
    return (
      <Card className={`relative border-primary ${highlighted ? 'border-2 shadow-lg' : ''}`}>
        {isCurrentTier && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-xs px-2 py-0.5">
              Current Plan
            </Badge>
          </div>
        )}

        <CardHeader className="pb-3 pt-5 text-center">
          <CardTitle className="text-2xl">{config.displayName}</CardTitle>
          <div className="mt-1">
            {config.isCustomPricing ? (
              <div className="text-3xl font-bold">Custom</div>
            ) : config.basePrice === 0 ? (
              <div className="text-3xl font-bold">Free</div>
            ) : (
              <div className="text-3xl font-bold">
                {formatCurrency(config.basePrice)}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatRow icon={<Coins className="h-4 w-4" />} label="Credits" value={
              config.isCustomPricing ? 'Custom' : `${config.creditsPerMonth.toLocaleString()}/mo`
            } />
            <StatRow icon={<Users className="h-4 w-4" />} label="Members" value={
              config.isCustomPricing ? 'Unlimited' : config.maxTeamMembers ? `Up to ${config.maxTeamMembers}` : 'Unlimited'
            } />
            <StatRow icon={<HardDrive className="h-4 w-4" />} label="Storage" value={
              config.isCustomPricing ? 'Custom' : `${config.storageQuotaGB}GB`
            } />
            <StatRow icon={<Plug className="h-4 w-4" />} label="Connectors" value={
              config.connectorsAllowed ? 'Unlimited' : 'None'
            } />
          </div>

          {/* Extra details for featured view */}
          {!config.isCustomPricing && tier !== 'free' && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
              {config.connectorsAllowed && (
                <Badge variant="secondary" className="text-xs">
                  <Code className="h-3 w-3 mr-1" />
                  API access
                </Badge>
              )}
              {(tier === 'max' || tier === 'enterprise') && (
                <Badge variant="secondary" className="text-xs">
                  <Headphones className="h-3 w-3 mr-1" />
                  Dedicated support
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Compact variant (for grid)
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
                : `${config.creditsPerMonth.toLocaleString()} cr/mo`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 flex-shrink-0" />
            <span>
              {config.isCustomPricing
                ? 'Unlimited'
                : config.maxTeamMembers
                  ? `${config.maxTeamMembers} members`
                  : 'Unlimited'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3 w-3 flex-shrink-0" />
            <span>
              {config.isCustomPricing
                ? 'Custom'
                : `${config.storageQuotaGB}GB`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Plug className="h-3 w-3 flex-shrink-0" />
            <span>{config.connectorsAllowed ? 'Connectors' : 'No connectors'}</span>
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
 * Stat row for featured card
 */
function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground truncate">{value}</div>
      </div>
    </div>
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
 * Order: Max, Enterprise, Pro, Free (premium first for 2x2 layout)
 */
export interface TierGridProps {
  currentTier?: TierName;
  onSelectTier?: (tier: TierName) => void;
  loading?: boolean;
}

export function TierGrid({ currentTier, onSelectTier, loading }: TierGridProps) {
  const tiers: TierName[] = ['max', 'enterprise', 'pro', 'free'];

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3">
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
