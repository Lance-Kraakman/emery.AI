import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/ddd/infrastructure/external/stripe/client';
import { db } from '@/ddd/infrastructure/db/client';
import { organizations } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Admin API for Enterprise Customer Provisioning
 *
 * AUTHENTICATION: Requires email to be in ADMIN_EMAILS environment variable
 *
 * Endpoints:
 * - GET: List all organizations with billing status
 * - POST: Assign Enterprise plan with custom pricing
 */

/**
 * Check if user is a superuser/admin
 * SECURITY: Case-insensitive email comparison
 */
async function isAdmin(userEmail: string | null | undefined): Promise<boolean> {
  if (!userEmail) return false;

  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim().toLowerCase()) || [];
  return adminEmails.includes(userEmail.toLowerCase());
}

/**
 * GET /api/admin/enterprises
 * List all organizations with billing data
 */
export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email || !await isAdmin(session.user.email)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all organizations with billing data
    const orgs = await db.query.organizations.findMany({
      columns: {
        id: true,
        name: true,
        plan: true,
        usageAllowanceCredits: true,
        creditsUsedCurrentMonth: true,
        spendingLimitUsd: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        customPriceId: true,
        billingEmail: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
      orderBy: (orgs: any, { desc }: any) => [desc(orgs.createdAt)],
    });

    return NextResponse.json({
      success: true,
      data: orgs,
      total: orgs.length,
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/enterprises/assign
 * Assign Enterprise plan with custom pricing
 *
 * Body: {
 *   organizationId: number,
 *   monthlyPriceUsd: number,
 *   creditsAllowance: number
 * }
 */
export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email || !await isAdmin(session.user.email)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { organizationId, monthlyPriceUsd, creditsAllowance } = body;

    // Validate input
    if (!organizationId || !monthlyPriceUsd || !creditsAllowance) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, monthlyPriceUsd, creditsAllowance' },
        { status: 400 }
      );
    }

    if (monthlyPriceUsd < 0 || creditsAllowance < 0) {
      return NextResponse.json(
        { error: 'Price and credits must be positive numbers' },
        { status: 400 }
      );
    }

    // Fetch organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Ensure Stripe customer exists
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.billingEmail || '',
        name: org.name,
        metadata: {
          organizationId: organizationId.toString(),
        },
      });
      customerId = customer.id;

      // Update org with customer ID
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, organizationId));
    }

    // Get or create Enterprise product
    const productId = process.env.STRIPE_ENTERPRISE_PRODUCT_ID;
    if (!productId) {
      return NextResponse.json(
        { error: 'STRIPE_ENTERPRISE_PRODUCT_ID not configured' },
        { status: 500 }
      );
    }

    // Create custom price for this organization
    const price = await stripe.prices.create({
      product: productId,
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      unit_amount: Math.round(monthlyPriceUsd * 100), // Convert to cents
      nickname: `Enterprise - ${org.name}`,
      metadata: {
        organizationId: organizationId.toString(),
        creditsAllowance: creditsAllowance.toString(),
      },
    });

    // Create subscription with invoicing (no payment method required)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: price.id,
        },
      ],
      collection_method: 'send_invoice',
      days_until_due: 30,
      payment_behavior: 'default_incomplete',
      metadata: {
        organizationId: organizationId.toString(),
        tier: 'enterprise',
      },
    });

    // Update organization with Enterprise plan
    const subWithPeriod = subscription as unknown as {
      current_period_start?: number;
      current_period_end?: number;
    };

    await db
      .update(organizations)
      .set({
        plan: 'enterprise',
        customPriceId: price.id,
        usageAllowanceCredits: creditsAllowance,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        currentPeriodStart: subWithPeriod.current_period_start
          ? new Date(subWithPeriod.current_period_start * 1000)
          : null,
        currentPeriodEnd: subWithPeriod.current_period_end
          ? new Date(subWithPeriod.current_period_end * 1000)
          : null,
      })
      .where(eq(organizations.id, organizationId));

    return NextResponse.json({
      success: true,
      data: {
        organizationId,
        organizationName: org.name,
        plan: 'enterprise',
        monthlyPriceUsd,
        creditsAllowance,
        stripePriceId: price.id,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      },
    });
  } catch (error) {
    console.error('Error assigning Enterprise plan:', error);
    return NextResponse.json(
      { error: 'Failed to assign Enterprise plan' },
      { status: 500 }
    );
  }
}
