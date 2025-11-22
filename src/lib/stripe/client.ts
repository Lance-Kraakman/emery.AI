import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'STRIPE_SECRET_KEY is not set. Please add it to your environment variables.'
  );
}

/**
 * Stripe client instance for server-side operations
 *
 * Used for:
 * - Creating checkout sessions (Pro, Max tiers)
 * - Creating customer portal sessions
 * - Managing subscriptions (all tiers including Enterprise)
 * - Creating custom prices for Enterprise customers
 * - Processing webhook events
 * - Generating usage-based invoices
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
  appInfo: {
    name: 'Emery',
    version: '1.0.0',
  },
});

/**
 * Stripe publishable key for client-side operations
 */
export const getStripePublishableKey = () => {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    throw new Error(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Please add it to your environment variables.'
    );
  }
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
};
