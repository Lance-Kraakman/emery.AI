/**
 * Stripe billing configuration for Emery
 *
 * Four-tier model with pay-as-you-go overage:
 * - Free/Pro/Max: Self-service subscriptions
 * - Enterprise: Custom pricing via Stripe API
 */

export type SubscriptionTier = 'free' | 'pro' | 'max' | 'enterprise';
export type TierName = SubscriptionTier; // Alias for UI components
export type BillingInterval = 'month' | 'year';

export interface TierConfig {
  name: string;
  displayName: string;
  description: string;
  monthlyPriceUsd: number;
  basePrice: number; // Alias for monthlyPriceUsd (for UI components)
  yearlyPriceUsd: number | null;
  creditsPerMonth: number; // Monthly credit allowance
  features: string[];
  limitations?: string[]; // Optional limitations (primarily for Free tier)
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  stripeProductId: string | null;
  isCustomPricing: boolean; // True for Enterprise
  maxTeamMembers: number | null; // null = unlimited
  storageQuotaGB: number; // Storage quota in gigabytes
  connectorsAllowed: boolean; // Whether connectors/connections are allowed
}

/**
 * Subscription tier configurations
 *
 * Free/Pro/Max: Create products/prices in Stripe dashboard
 * Enterprise: Prices created dynamically per customer via API
 */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'Get started with basic features',
    monthlyPriceUsd: 0,
    basePrice: 0,
    yearlyPriceUsd: null,
    creditsPerMonth: 1000, // ~$1 worth of usage
    features: [
      '1,000 credits per month',
      'Up to 3 team members',
      '1GB storage',
    ],
    limitations: [
      'No connectors/integrations',
      'Limited storage',
    ],
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    stripeProductId: null,
    isCustomPricing: false,
    maxTeamMembers: 3,
    storageQuotaGB: 1,
    connectorsAllowed: false,
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'For growing teams',
    monthlyPriceUsd: 29,
    basePrice: 29,
    yearlyPriceUsd: 290, // ~17% discount
    creditsPerMonth: 50000, // ~$50 worth of usage
    features: [
      '50,000 credits per month',
      'Unlimited team members',
      '10GB storage',
      'Unlimited connectors',
      'API access',
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRO_PRICE_ID_MONTHLY || null,
    stripePriceIdYearly: process.env.STRIPE_PRO_PRICE_ID_YEARLY || null,
    stripeProductId: process.env.STRIPE_PRO_PRODUCT_ID || null,
    isCustomPricing: false,
    maxTeamMembers: null,
    storageQuotaGB: 10,
    connectorsAllowed: true,
  },
  max: {
    name: 'max',
    displayName: 'Max',
    description: 'For high-volume usage',
    monthlyPriceUsd: 199,
    basePrice: 199,
    yearlyPriceUsd: 1990, // ~17% discount
    creditsPerMonth: 500000, // ~$500 worth of usage
    features: [
      '500,000 credits per month',
      'Everything in Pro',
      '30GB storage',
      'Dedicated support',
      'Advanced analytics',
      'SLA guarantees',
      'Custom integrations',
    ],
    stripePriceIdMonthly: process.env.STRIPE_MAX_PRICE_ID_MONTHLY || null,
    stripePriceIdYearly: process.env.STRIPE_MAX_PRICE_ID_YEARLY || null,
    stripeProductId: process.env.STRIPE_MAX_PRODUCT_ID || null,
    isCustomPricing: false,
    maxTeamMembers: null,
    storageQuotaGB: 30,
    connectorsAllowed: true,
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Custom pricing and terms',
    monthlyPriceUsd: 0, // Custom pricing
    basePrice: 0, // Custom pricing
    yearlyPriceUsd: null, // Custom pricing
    creditsPerMonth: 0, // Set per customer
    features: [
      'Custom credit allowance',
      'Everything in Max',
      'Custom storage quota',
      'Dedicated account manager',
      'Custom contracts',
      'Flexible payment terms',
      'On-premise deployment options',
      'White-label options',
      '24/7 enterprise support',
    ],
    stripePriceIdMonthly: null, // Created per customer
    stripePriceIdYearly: null, // Created per customer
    stripeProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID || null,
    isCustomPricing: true,
    maxTeamMembers: null,
    storageQuotaGB: 100, // Default, can be customized per customer
    connectorsAllowed: true,
  },
};

/**
 * Credit pricing for overage billing
 * Based on existing: 1 credit = $0.001 with 2.5x markup
 *
 * IMPORTANT: This is the single source of truth for credit pricing.
 * Import PRICE_PER_CREDIT_USD from this file - do not hardcode!
 */
export const CREDIT_PRICING = {
  COST_PER_CREDIT_USD: 0.001,
  MARKUP_MULTIPLIER: 2.5,
  PRICE_PER_CREDIT_USD: 0.0025,
} as const;

/**
 * Convenience export for common usage
 */
export const PRICE_PER_CREDIT_USD = CREDIT_PRICING.PRICE_PER_CREDIT_USD;

/**
 * Spending limit presets (USD)
 * Default: $0 (allowance-only, no overage)
 */
export const SPENDING_LIMIT_PRESETS = [
  { label: '$5/month', value: 5, recommended: true },
  { label: '$10/month', value: 10 },
  { label: '$25/month', value: 25 },
  { label: '$50/month', value: 50 },
  { label: '$100/month', value: 100 },
  { label: '$250/month', value: 250 },
  { label: '$500/month', value: 500 },
  { label: 'Custom', value: -1 },
] as const;

/**
 * Stripe webhook event types
 */
export const STRIPE_WEBHOOK_EVENTS = {
  CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  CUSTOMER_UPDATED: 'customer.updated',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_FINALIZED: 'invoice.finalized',
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed',
} as const;

/**
 * Get tier configuration
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return SUBSCRIPTION_TIERS[tier];
}

/**
 * Validate tier name
 */
export function isValidTier(tier: string): tier is SubscriptionTier {
  return tier in SUBSCRIPTION_TIERS;
}

/**
 * Get tier from Stripe price ID
 */
export function getTierFromStripePriceId(priceId: string): SubscriptionTier | null {
  for (const [tierName, config] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (
      config.stripePriceIdMonthly === priceId ||
      config.stripePriceIdYearly === priceId
    ) {
      return tierName as SubscriptionTier;
    }
  }
  return null;
}

/**
 * Calculate overage cost
 */
export function calculateOverageCost(overageCredits: number): number {
  return overageCredits * CREDIT_PRICING.PRICE_PER_CREDIT_USD;
}

/**
 * Check if usage would exceed spending limit
 */
export function wouldExceedSpendingLimit(
  currentOverageUsd: number,
  additionalCredits: number,
  spendingLimitUsd: number | null
): boolean {
  if (spendingLimitUsd === null) return false; // No limit

  const additionalCost = calculateOverageCost(additionalCredits);
  const projectedTotal = currentOverageUsd + additionalCost;

  return projectedTotal > spendingLimitUsd;
}

/**
 * Helper to determine if a tier requires checkout (Pro, Max)
 */
export function isCheckoutTier(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'max';
}

/**
 * Helper to determine if a tier requires contact (Enterprise)
 */
export function isContactTier(tier: SubscriptionTier): boolean {
  return tier === 'enterprise';
}
