import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/ddd/infrastructure/external/stripe/client';
import { db } from '@/ddd/infrastructure/db/client';
import { organizations, invoices } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { getTierFromStripePriceId, getTierConfig, PRICE_PER_CREDIT_USD } from '@/ddd/infrastructure/external/stripe/config';
import { getInvoiceApplicationService } from '@/ddd/application/di/getters';

/**
 * Stripe webhook handler
 *
 * Handles events from Stripe for:
 * - Subscription lifecycle (created, updated, deleted)
 * - Invoice payments (succeeded, failed)
 * - Customer updates
 *
 * IMPORTANT: This is the ONLY endpoint that must be an API route (not Server Action)
 * because Stripe needs to POST to a public URL and we need raw body access for
 * signature verification.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Process event based on type
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.finalized':
        // CRITICAL: Add overage charges BEFORE invoice is finalized
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription creation or update
 * Syncs subscription status, tier, and allowance to database
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find organization by Stripe customer ID
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customerId),
  });

  if (!org) {
    console.error(`Organization not found for customer: ${customerId}`);
    return;
  }

  // Get tier from price ID
  const priceId = subscription.items.data[0]?.price.id;
  let tier = priceId ? getTierFromStripePriceId(priceId) : null;

  // If no tier found from price ID, it might be a custom Enterprise price
  if (!tier && org.customPriceId && org.customPriceId === priceId) {
    tier = 'enterprise';
  }

  if (!tier) {
    tier = 'free'; // Fallback to free if tier can't be determined
  }

  const tierConfig = getTierConfig(tier);

  // Calculate billing period - Stripe subscription has these fields in the API
  const subWithPeriod = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  const periodStart = subWithPeriod.current_period_start
    ? new Date(subWithPeriod.current_period_start * 1000)
    : new Date();
  const periodEnd = subWithPeriod.current_period_end
    ? new Date(subWithPeriod.current_period_end * 1000)
    : new Date();

  // Update organization
  await db
    .update(organizations)
    .set({
      plan: tier,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      usageAllowanceCredits: tierConfig.creditsPerMonth,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    })
    .where(eq(organizations.id, org.id));

  console.log(`Subscription updated for org ${org.id}: ${tier} tier, ${tierConfig.creditsPerMonth} credits`);
}

/**
 * Handle subscription deletion
 * Reset to Free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customerId),
  });

  if (!org) {
    console.error(`Organization not found for customer: ${customerId}`);
    return;
  }

  const freeTier = getTierConfig('free');

  // Downgrade to Free tier
  await db
    .update(organizations)
    .set({
      plan: 'free',
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: 'canceled',
      usageAllowanceCredits: freeTier.creditsPerMonth,
      customPriceId: null, // Clear custom Enterprise price if any
      currentPeriodStart: null,
      currentPeriodEnd: null,
    })
    .where(eq(organizations.id, org.id));

  console.log(`Subscription canceled for org ${org.id}, downgraded to Free tier`);
}

/**
 * Handle successful invoice payment
 * Record invoice and reset usage counters for new billing period
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customerId),
  });

  if (!org) {
    console.error(`Organization not found for customer: ${customerId}`);
    return;
  }

  const invoiceService = getInvoiceApplicationService();

  // CRITICAL: Idempotency check - prevent duplicate invoice recording
  const existingInvoiceResult = await invoiceService.getInvoiceByStripeId(invoice.id);

  if (!existingInvoiceResult.success) {
    console.error(`Error checking for existing invoice: ${existingInvoiceResult.error}`);
    return;
  }

  if (existingInvoiceResult.data && existingInvoiceResult.data.status === 'paid') {
    console.log(`Invoice ${invoice.id} already processed for org ${org.id}, skipping`);
    return;
  }

  // Calculate credit usage breakdown
  const allowanceCredits = org.usageAllowanceCredits || 0;
  const usedCredits = org.creditsUsedCurrentMonth || 0;
  const includedCreditsUsed = Math.min(usedCredits, allowanceCredits);
  const overageCreditsUsed = Math.max(0, usedCredits - allowanceCredits);
  const overageAmountUsd = overageCreditsUsed * PRICE_PER_CREDIT_USD;

  // Get subscription and payment intent IDs
  const invSubscription = (invoice as { subscription?: string | { id: string } }).subscription;
  const invPaymentIntent = (invoice as { payment_intent?: string | object }).payment_intent;

  if (existingInvoiceResult.data) {
    // Update existing invoice to paid status
    const updateResult = await invoiceService.updateInvoiceStatus(
      existingInvoiceResult.data.id,
      'paid',
      new Date()
    );

    if (!updateResult.success) {
      console.error(`Failed to update invoice status: ${updateResult.error}`);
      return;
    }
  } else {
    // Create new invoice
    const createResult = await invoiceService.createInvoice({
      organizationId: org.id,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: typeof invSubscription === 'string' ? invSubscription : invSubscription?.id || undefined,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      includedCreditsUsed,
      overageCreditsUsed,
      totalCreditsUsed: usedCredits,
      totalAmountUsd: invoice.amount_paid / 100, // Convert from cents
      subscriptionAmountUsd: (invoice.subtotal || 0) / 100,
      overageAmountUsd,
      status: 'paid',
      invoicedAt: new Date(invoice.created * 1000),
      paidAt: new Date(),
      metadata: {
        tier: org.plan,
        paymentMethod: invPaymentIntent ? 'card' : 'invoice',
      },
    });

    if (!createResult.success) {
      console.error(`Failed to create invoice: ${createResult.error}`);
      return;
    }
  }

  // Reset usage counters for new billing period
  await db
    .update(organizations)
    .set({
      creditsUsedCurrentMonth: 0,
    })
    .where(eq(organizations.id, org.id));

  console.log(`Invoice ${invoice.id} paid for org ${org.id}`);
}

/**
 * Handle failed invoice payment
 * Update invoice status and notify user
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customerId),
  });

  if (!org) {
    console.error(`Organization not found for customer: ${customerId}`);
    return;
  }

  const invoiceService = getInvoiceApplicationService();

  // Check if invoice already exists in database
  const existingInvoiceResult = await invoiceService.getInvoiceByStripeId(invoice.id);

  if (!existingInvoiceResult.success) {
    console.error(`Error checking for existing invoice: ${existingInvoiceResult.error}`);
    return;
  }

  if (existingInvoiceResult.data) {
    // Update existing invoice status to uncollectible
    const updateResult = await invoiceService.updateInvoiceStatus(
      existingInvoiceResult.data.id,
      'uncollectible'
    );

    if (!updateResult.success) {
      console.error(`Failed to update invoice status: ${updateResult.error}`);
      return;
    }
  }

  // TODO: Send email notification to billing email or org owner
  console.error(`Payment failed for org ${org.id}, invoice ${invoice.id}`);
}

/**
 * Handle customer updates
 * Sync customer data to database
 */
async function handleCustomerUpdated(customer: Stripe.Customer) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customer.id),
  });

  if (!org) {
    console.error(`Organization not found for customer: ${customer.id}`);
    return;
  }

  // Update billing email if changed
  if (customer.email && customer.email !== org.billingEmail) {
    await db
      .update(organizations)
      .set({
        billingEmail: customer.email,
      })
      .where(eq(organizations.id, org.id));
  }

  console.log(`Customer ${customer.id} updated for org ${org.id}`);
}

/**
 * Handle invoice finalized - ADD OVERAGE CHARGES
 * CRITICAL: This runs BEFORE payment, allowing us to add usage-based charges
 */
async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, customerId),
  });

  if (!org) {
    console.error(`Organization not found for customer: ${customerId}`);
    return;
  }

  // CRITICAL: Idempotency check - prevent duplicate overage charges
  // Check if we already added invoice items for this invoice
  const existingItems = await stripe.invoiceItems.list({
    invoice: invoice.id,
    limit: 100,
  });

  const hasOverageItem = existingItems.data.some(
    item => item.metadata?.organizationId === org.id.toString()
  );

  if (hasOverageItem) {
    console.log(`Overage already added for invoice ${invoice.id}, org ${org.id}, skipping`);
    return;
  }

  // Calculate overage credits
  const allowanceCredits = org.usageAllowanceCredits || 0;
  const usedCredits = org.creditsUsedCurrentMonth || 0;
  const overageCredits = Math.max(0, usedCredits - allowanceCredits);

  // If no overage, nothing to charge
  if (overageCredits === 0) {
    console.log(`No overage for org ${org.id} (used: ${usedCredits}, allowance: ${allowanceCredits})`);
    return;
  }

  // Calculate overage cost (uses imported PRICE_PER_CREDIT_USD from stripe/config.ts)
  const overageCostUsd = overageCredits * PRICE_PER_CREDIT_USD;

  // Check spending limit
  const spendingLimitUsd = org.spendingLimitUsd ? parseFloat(org.spendingLimitUsd.toString()) : 0;

  if (overageCostUsd > spendingLimitUsd) {
    console.warn(
      `Overage ($${overageCostUsd.toFixed(2)}) exceeds spending limit ($${spendingLimitUsd.toFixed(2)}) for org ${org.id}. ` +
      `Charging up to limit.`
    );
    // Only charge up to the spending limit
    const cappedOverageUsd = spendingLimitUsd;
    const cappedOverageCredits = Math.floor(cappedOverageUsd / PRICE_PER_CREDIT_USD);

    if (cappedOverageUsd > 0) {
      // Add invoice item for capped overage
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: Math.round(cappedOverageUsd * 100), // Convert to cents
        currency: 'usd',
        description: `AI Usage Overage: ${cappedOverageCredits.toLocaleString()} credits (capped at spending limit)`,
        metadata: {
          organizationId: org.id.toString(),
          overageCredits: cappedOverageCredits.toString(),
          allowanceCredits: allowanceCredits.toString(),
          spendingLimitReached: 'true',
        },
      });

      console.log(
        `Added capped overage charge for org ${org.id}: ${cappedOverageCredits.toLocaleString()} credits = $${cappedOverageUsd.toFixed(2)} (limit reached)`
      );
    }
  } else {
    // Add full overage as invoice item
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: Math.round(overageCostUsd * 100), // Convert to cents
      currency: 'usd',
      description: `AI Usage Overage: ${overageCredits.toLocaleString()} credits @ $${PRICE_PER_CREDIT_USD}/credit`,
      metadata: {
        organizationId: org.id.toString(),
        overageCredits: overageCredits.toString(),
        allowanceCredits: allowanceCredits.toString(),
        totalUsed: usedCredits.toString(),
      },
    });

    console.log(
      `Added overage charge for org ${org.id}: ${overageCredits.toLocaleString()} credits = $${overageCostUsd.toFixed(2)}`
    );
  }
}
