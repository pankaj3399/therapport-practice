import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY ?? '';

/** Whether Stripe is configured (secret key present). Uses same cached value as getStripe(). */
export function isStripeConfigured(): boolean {
  return Boolean(secretKey);
}

let stripeInstance: Stripe | null = null;

/**
 * Returns the Stripe client instance. Throws if STRIPE_SECRET_KEY is not set.
 * Use isStripeConfigured() first if Stripe usage is optional.
 */
export function getStripe(): Stripe {
  if (!secretKey) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    });
  }
  return stripeInstance;
}

/** Webhook signing secret for verifying Stripe webhook events. Used in PR 6+. */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
