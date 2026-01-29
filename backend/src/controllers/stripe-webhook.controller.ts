import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getStripe, STRIPE_WEBHOOK_SECRET } from '../config/stripe';
import { logger } from '../utils/logger.util';

/** In-memory map of processed event IDs with timestamps for TTL cleanup (PR 6 minimal). Replace with DB in production. */
const processedEventIds = new Map<string, number>();
const EVENT_ID_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Every hour

function cleanupOldEventIds(): void {
  const now = Date.now();
  for (const [id, timestamp] of processedEventIds.entries()) {
    if (now - timestamp > EVENT_ID_TTL_MS) {
      processedEventIds.delete(id);
    }
  }
}

const cleanupIntervalId = setInterval(cleanupOldEventIds, CLEANUP_INTERVAL_MS);

/** For testing or graceful shutdown: clears the idempotency cleanup interval. */
export function stopIdempotencyCleanup(): void {
  clearInterval(cleanupIntervalId);
}

/**
 * Stripe webhook handler: verify signature, enforce idempotency, dispatch by event type.
 * Credit granting and subscription updates are implemented in PR 8+; here we only verify and acknowledge.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    logger.warn('Stripe webhook received without stripe-signature header');
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    logger.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  const rawBody = req.body;
  if (!rawBody || !(rawBody instanceof Buffer)) {
    logger.warn(
      'Stripe webhook body is not raw Buffer (ensure express.raw() is used for this route)'
    );
    res.status(400).json({ error: 'Invalid webhook body' });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn('Stripe webhook signature verification failed', { error: message });
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  if (processedEventIds.has(event.id)) {
    logger.info('Stripe webhook event already processed (idempotent)', { eventId: event.id });
    res.status(200).json({ received: true });
    return;
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
      break;
    default:
      logger.info('Stripe webhook event (unhandled type)', { eventId: event.id, type: event.type });
  }

  processedEventIds.set(event.id, Date.now());
  res.status(200).json({ received: true });
}
