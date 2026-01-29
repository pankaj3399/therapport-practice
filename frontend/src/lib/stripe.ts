import { loadStripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';

/** Stripe instance promise for Elements provider. Only set when key looks like a Stripe publishable key (pk_*). */
export const stripePromise =
  publishableKey && publishableKey.startsWith('pk_') ? loadStripe(publishableKey) : null;

export function isStripeConfigured(): boolean {
  return Boolean(publishableKey && publishableKey.startsWith('pk_'));
}
