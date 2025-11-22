/**
 * Billing Utilities
 *
 * Helper functions for formatting and calculating billing-related data
 */

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format credits with thousands separators
 */
export function formatCredits(credits: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(credits);
}

/**
 * Format currency (USD)
 */
export function formatCurrency(cents: number | string): string {
  const amount = typeof cents === 'string' ? parseFloat(cents) : cents;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get color class for tier badge
 */
export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
    pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    max: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
    enterprise: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  };

  return colors[tier.toLowerCase()] || colors.free;
}

/**
 * Get variant for tier badge (using shadcn badge variants)
 */
export function getTierVariant(tier: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    free: 'secondary',
    pro: 'default',
    max: 'default',
    enterprise: 'default',
  };

  return variants[tier.toLowerCase()] || 'secondary';
}

/**
 * Calculate overage amount (used credits beyond allowance)
 */
export function calculateOverage(used: number, allowance: number): number {
  return Math.max(0, used - allowance);
}

/**
 * Calculate percentage used
 */
export function calculatePercentageUsed(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
}

/**
 * Determine warning level based on percentage used
 */
export function getUsageWarningLevel(percentageUsed: number): 'safe' | 'warning' | 'critical' {
  if (percentageUsed >= 90) return 'critical';
  if (percentageUsed >= 80) return 'warning';
  return 'safe';
}

/**
 * Get color for usage indicator
 */
export function getUsageColor(percentageUsed: number): string {
  const level = getUsageWarningLevel(percentageUsed);

  const colors: Record<typeof level, string> = {
    safe: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  };

  return colors[level];
}

/**
 * Format date for billing display
 */
export function formatBillingDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Get display name for tier
 */
export function getTierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    free: 'Free',
    pro: 'Pro',
    max: 'Max',
    enterprise: 'Enterprise',
  };

  return names[tier.toLowerCase()] || tier;
}

/**
 * Parse tier from subscription status
 */
export function getTierFromPriceId(priceId: string | null | undefined): 'free' | 'pro' | 'max' | 'enterprise' {
  if (!priceId) return 'free';

  const priceLower = priceId.toLowerCase();
  if (priceLower.includes('pro')) return 'pro';
  if (priceLower.includes('max')) return 'max';
  if (priceLower.includes('enterprise')) return 'enterprise';

  return 'free';
}
