'use server';

/**
 * Billing Server Actions
 *
 * Handles Stripe billing operations:
 * - Subscription checkout (Pro, Max tiers)
 * - Customer portal access
 * - Spending limit management
 * - Billing status retrieval
 */

import { auth } from '@/lib/auth';
import { stripe } from '@/ddd/infrastructure/external/stripe/client';
import { db } from '@/ddd/infrastructure/db/client';
import { organizations } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import {
  getTierConfig,
  isCheckoutTier,
  isContactTier,
  PRICE_PER_CREDIT_USD,
  type SubscriptionTier,
  type BillingInterval,
} from '@/ddd/infrastructure/external/stripe/config';
import { requireResourcePermission } from './permissions';
import { withAuthContext } from '@/lib/auth/with-context';

export interface BillingStatusResult {
  success: boolean;
  tier: SubscriptionTier;
  displayName: string;
  allowanceCredits: number;
  usedCredits: number;
  overageCredits: number;
  overageCostUsd: number;
  spendingLimitUsd: number;
  subscriptionStatus: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  error?: string;
}

export interface CheckoutSessionResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export interface PortalSessionResult {
  success: boolean;
  portalUrl?: string;
  error?: string;
}

export interface SpendingLimitResult {
  success: boolean;
  newLimit: number;
  error?: string;
}

/**
 * Get current billing status for the organization
 */
export async function getBillingStatus(): Promise<BillingStatusResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return {
          success: false,
          error: 'Unauthorized',
          tier: 'free',
          displayName: 'Free',
          allowanceCredits: 0,
          usedCredits: 0,
          overageCredits: 0,
          overageCostUsd: 0,
          spendingLimitUsd: 0,
          subscriptionStatus: null,
          periodStart: null,
          periodEnd: null,
        };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return {
          success: false,
          error: 'No organization selected',
          tier: 'free',
          displayName: 'Free',
          allowanceCredits: 0,
          usedCredits: 0,
          overageCredits: 0,
          overageCostUsd: 0,
          spendingLimitUsd: 0,
          subscriptionStatus: null,
          periodStart: null,
          periodEnd: null,
        };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });

      if (!org) {
        return {
          success: false,
          error: 'Organization not found',
          tier: 'free',
          displayName: 'Free',
          allowanceCredits: 0,
          usedCredits: 0,
          overageCredits: 0,
          overageCostUsd: 0,
          spendingLimitUsd: 0,
          subscriptionStatus: null,
          periodStart: null,
          periodEnd: null,
        };
      }

      const tier = (org.plan || 'free') as SubscriptionTier;
      const tierConfig = getTierConfig(tier);
      // Use DB value if set, otherwise fall back to tier's default allowance
      // This ensures free tier gets 1000 credits even if usageAllowanceCredits is 0/null in DB
      const allowanceCredits = org.usageAllowanceCredits || tierConfig.creditsPerMonth;
      const usedCredits = org.creditsUsedCurrentMonth || 0;
      const overageCredits = Math.max(0, usedCredits - allowanceCredits);
      const spendingLimitUsd = org.spendingLimitUsd ? parseFloat(org.spendingLimitUsd.toString()) : 0;
      const overageCostUsd = overageCredits * PRICE_PER_CREDIT_USD;

      return {
        success: true,
        tier,
        displayName: tierConfig.displayName,
        allowanceCredits,
        usedCredits,
        overageCredits,
        overageCostUsd,
        spendingLimitUsd,
        subscriptionStatus: org.stripeSubscriptionStatus || null,
        periodStart: org.currentPeriodStart,
        periodEnd: org.currentPeriodEnd,
      };
    } catch (error) {
      console.error('Error getting billing status:', error);
      return {
        success: false,
        error: 'Failed to get billing status',
        tier: 'free',
        displayName: 'Free',
        allowanceCredits: 0,
        usedCredits: 0,
        overageCredits: 0,
        overageCostUsd: 0,
        spendingLimitUsd: 0,
        subscriptionStatus: null,
        periodStart: null,
        periodEnd: null,
      };
    }
  });
}

/**
 * Create a Stripe Checkout session for subscription (Pro or Max tier)
 */
export async function createCheckoutSession(
  tier: SubscriptionTier,
  interval: BillingInterval = 'month'
): Promise<CheckoutSessionResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      // Validate tier
      if (!isCheckoutTier(tier)) {
        if (isContactTier(tier)) {
          return { success: false, error: 'Enterprise tier requires contacting us for custom pricing' };
        }
        return { success: false, error: 'Invalid tier for checkout' };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });

      if (!org) {
        return { success: false, error: 'Organization not found' };
      }

      // Get price ID for tier and interval
      const tierConfig = getTierConfig(tier);
      const priceId =
        interval === 'year' ? tierConfig.stripePriceIdYearly : tierConfig.stripePriceIdMonthly;

      if (!priceId) {
        return { success: false, error: 'Price not configured for this tier' };
      }

      // Ensure customer exists
      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: org.billingEmail || session.user.email!,
          metadata: {
            organizationId: orgId.toString(),
            organizationName: org.name,
          },
        });
        customerId = customer.id;

        // Update organization with customer ID
        await db
          .update(organizations)
          .set({ stripeCustomerId: customerId })
          .where(eq(organizations.id, orgId));
      }

      // Create checkout session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/settings/billing?canceled=true`,
        metadata: {
          organizationId: orgId.toString(),
          tier,
          interval,
        },
      });

      return {
        success: true,
        checkoutUrl: checkoutSession.url!,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      };
    }
  });
}

/**
 * Create a Stripe Customer Portal session for subscription management
 */
export async function createPortalSession(): Promise<PortalSessionResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });

      if (!org || !org.stripeCustomerId) {
        return { success: false, error: 'No active subscription found' };
      }

      // Create portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${process.env.NEXTAUTH_URL}/settings/billing`,
      });

      return {
        success: true,
        portalUrl: portalSession.url,
      };
    } catch (error) {
      console.error('Error creating portal session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create portal session',
      };
    }
  });
}

/**
 * Create a Stripe Customer Portal session for payment method update only
 * Uses flow_data to restrict the portal to just payment method management
 */
export async function createPaymentMethodPortalSession(): Promise<PortalSessionResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });

      if (!org || !org.stripeCustomerId) {
        return { success: false, error: 'No active subscription found' };
      }

      // Create portal session restricted to payment method update
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${process.env.NEXTAUTH_URL}/settings/billing`,
        flow_data: {
          type: 'payment_method_update',
        },
      });

      return {
        success: true,
        portalUrl: portalSession.url,
      };
    } catch (error) {
      console.error('Error creating payment method portal session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open payment method update',
      };
    }
  });
}

/**
 * Update spending limit for overage billing
 * Requires organizations:manage permission
 * Pass null to remove limit (unlimited spending)
 */
export async function setSpendingLimit(limitUsd: number | null): Promise<SpendingLimitResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, newLimit: 0, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, newLimit: 0, error: 'No organization selected' };
      }

      // CRITICAL: Require organizations:manage permission to modify billing settings
      await requireResourcePermission(
        'organizations:manage',
        'organization',
        orgId
      );

      // Validate limit
      if (limitUsd !== null && limitUsd < 0) {
        return { success: false, newLimit: 0, error: 'Spending limit must be non-negative' };
      }

      // Update spending limit (null = unlimited)
      await db
        .update(organizations)
        .set({
          spendingLimitUsd: limitUsd !== null ? limitUsd.toFixed(2) : null,
        })
        .where(eq(organizations.id, orgId));

      return {
        success: true,
        newLimit: limitUsd || 0,
      };
    } catch (error) {
      console.error('Error setting spending limit:', error);
      return {
        success: false,
        newLimit: 0,
        error: error instanceof Error ? error.message : 'Failed to set spending limit',
      };
    }
  });
}

/**
 * Storage usage result type - re-exports StorageUsageBreakdown for type compatibility
 */
import type { StorageUsageBreakdown } from '@/ddd/application/services/billing/storage-quota-application-service';

export type { StorageUsageBreakdown };

export interface StorageUsageResult {
  success: boolean;
  data?: StorageUsageBreakdown;
  error?: string;
}

/**
 * Get storage usage breakdown for current organization
 * Used by billing settings page
 */
export async function getStorageUsageBreakdown(): Promise<StorageUsageResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      // Get storage quota service through DI
      const { getStorageQuotaApplicationService } = await import('@/ddd/application/di/container');
      const storageService = getStorageQuotaApplicationService();

      const result = await storageService.getUsageBreakdown(orgId);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to get storage usage',
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage usage',
      };
    }
  });
}
