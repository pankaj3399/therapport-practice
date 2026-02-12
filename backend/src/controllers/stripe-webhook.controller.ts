import { createHash } from 'crypto';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getStripe, STRIPE_WEBHOOK_SECRET } from '../config/stripe';
import { logger } from '../utils/logger.util';
import * as SubscriptionService from '../services/subscription.service';
import * as BookingService from '../services/booking.service';
import * as CreditTransactionService from '../services/credit-transaction.service';

/** Deterministic UUID from Stripe payment intent id for use as credit sourceId (DB source_id is uuid). */
function paymentIntentIdToSourceId(paymentIntentId: string): string {
  const hex = createHash('sha256').update(paymentIntentId).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Grant pay-the-difference credits: amountReceived (pence) to GBP, expiry = last day of current UTC month. */
async function grantPayDifferenceCredits(
  userId: string,
  amountReceived: number,
  description: string,
  sourceId?: string
): Promise<string> {
  const amountGBP = amountReceived / 100;
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0));
  const expiryDate = lastDay.toISOString().split('T')[0];
  return CreditTransactionService.grantCredits(
    userId,
    amountGBP,
    expiryDate,
    'pay_difference',
    sourceId,
    description
  );
}

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

/** Name of the one-time prorated line we add in createCheckoutSessionForSubscription. */
const PRORATED_CURRENT_MONTH_LABEL = 'Prorated current month';

/**
 * Parse subscription invoice line items to detect first-invoice split (prorated + next month).
 * Returns { currentMonthAmountPence, nextMonthAmountPence, proratedLinePeriodEnd } or null if not a clear split.
 */
function parseSubscriptionInvoiceLines(invoice: Stripe.Invoice): {
  currentMonthAmountPence: number;
  nextMonthAmountPence: number;
  proratedLinePeriodEnd: number | null;
} | null {
  const lines = invoice.lines?.data ?? [];
  let currentMonthAmountPence = 0;
  let nextMonthAmountPence = 0;
  let proratedLinePeriodEnd: number | null = null;

  for (const line of lines) {
    const amount = line.amount ?? 0;
    const description = (line.description ?? '').trim();
    const isSubscriptionLine = line.subscription != null;

    if (description === PRORATED_CURRENT_MONTH_LABEL && !isSubscriptionLine) {
      currentMonthAmountPence += amount;
      if (line.period?.end != null) {
        proratedLinePeriodEnd = line.period.end;
      }
    } else if (isSubscriptionLine) {
      nextMonthAmountPence += amount;
    }
  }

  if (currentMonthAmountPence > 0 && nextMonthAmountPence > 0) {
    return {
      currentMonthAmountPence,
      nextMonthAmountPence,
      proratedLinePeriodEnd,
    };
  }
  return null;
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

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
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

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const type = paymentIntent.metadata?.type;
        const userId = paymentIntent.metadata?.userId;
        const purchaseDate = paymentIntent.metadata?.purchaseDate;
        if (type === 'ad_hoc_subscription' && userId && purchaseDate) {
          await SubscriptionService.processAdHocPaymentSuccess(userId, purchaseDate);
          logger.info('Ad-hoc subscription payment processed', { eventId: event.id, userId });
        } else if (type === 'pay_the_difference' && userId && paymentIntent.metadata?.roomId) {
          const roomId = paymentIntent.metadata.roomId;
          const date = paymentIntent.metadata.date;
          const startTime = paymentIntent.metadata.startTime;
          const endTime = paymentIntent.metadata.endTime;
          const bookingType =
            (paymentIntent.metadata.bookingType as
              | 'permanent_recurring'
              | 'ad_hoc'
              | 'free'
              | 'internal') ?? 'ad_hoc';
          const amountReceived = paymentIntent.amount_received;
          if (!date || !startTime || !endTime || amountReceived == null) {
            logger.warn('Pay-the-difference metadata incomplete', {
              eventId: event.id,
              userId,
              missing: {
                date: !date,
                startTime: !startTime,
                endTime: !endTime,
                amount_received: amountReceived == null,
              },
            });
          } else {
            const expectedPence = paymentIntent.metadata.expectedAmountPence;
            if (expectedPence != null) {
              const expected = parseInt(String(expectedPence), 10);
              if (!Number.isNaN(expected) && expected !== amountReceived) {
                logger.warn('Pay-the-difference amount mismatch', {
                  eventId: event.id,
                  userId,
                  expectedAmountPence: expected,
                  amountReceived,
                });
              }
            }
            const available = await BookingService.checkAvailability(
              roomId,
              date,
              startTime,
              endTime
            );
            if (!available) {
              logger.warn('Pay-the-difference slot no longer available', {
                eventId: event.id,
                userId,
                roomId,
                date,
              });
              break;
            }
            const sourceId = paymentIntentIdToSourceId(paymentIntent.id);
            const alreadyGranted = await CreditTransactionService.hasCreditForSourceId(
              userId,
              'pay_difference',
              sourceId
            );
            if (alreadyGranted) {
              logger.info('Pay-the-difference credits already granted (idempotent)', {
                eventId: event.id,
                userId,
                roomId,
                date,
                paymentIntentId: paymentIntent.id,
              });
            } else {
              await grantPayDifferenceCredits(
                userId,
                amountReceived,
                'Pay the difference for room booking',
                sourceId
              );
              logger.info('Pay-the-difference credits granted', {
                eventId: event.id,
                userId,
                roomId,
                date,
                paymentIntentId: paymentIntent.id,
              });
            }
            const result = await BookingService.createBooking(
              userId,
              roomId,
              date,
              startTime,
              endTime,
              bookingType
            );
            if ('paymentRequired' in result && result.paymentRequired) {
              logger.error('Pay-the-difference createBooking returned paymentRequired', {
                eventId: event.id,
                userId,
                roomId,
                date,
              });
            } else if ('id' in result) {
              logger.info('Pay-the-difference booking created', {
                eventId: event.id,
                userId,
                bookingId: result.id,
              });
            }
          }
        } else if (type === 'pay_the_difference_update' && userId && paymentIntent.metadata?.bookingId) {
          const bookingId = paymentIntent.metadata.bookingId;
          const roomId = paymentIntent.metadata.roomId;
          const bookingDate = paymentIntent.metadata.bookingDate;
          const startTime = paymentIntent.metadata.startTime;
          const endTime = paymentIntent.metadata.endTime;
          const amountReceived = paymentIntent.amount_received;
          if (amountReceived == null) {
            logger.warn('Pay-the-difference-update metadata incomplete', {
              eventId: event.id,
              userId,
              bookingId,
            });
          } else {
            const sourceId = paymentIntentIdToSourceId(paymentIntent.id);
            const alreadyGranted = await CreditTransactionService.hasCreditForSourceId(
              userId,
              'pay_difference',
              sourceId
            );
            let creditsGrantedThisCall = false;
            if (alreadyGranted) {
              logger.info('Pay-the-difference-update credits already granted (idempotent)', {
                eventId: event.id,
                userId,
                bookingId,
                paymentIntentId: paymentIntent.id,
              });
            } else {
              await grantPayDifferenceCredits(
                userId,
                amountReceived,
                'Pay the difference for booking update',
                sourceId
              );
              creditsGrantedThisCall = true;
              logger.info('Pay-the-difference-update credits granted', {
                eventId: event.id,
                userId,
                bookingId,
                paymentIntentId: paymentIntent.id,
              });
            }
            const updates: Parameters<typeof BookingService.updateBooking>[3] = {};
            if (typeof roomId === 'string') updates.roomId = roomId;
            if (typeof bookingDate === 'string') updates.bookingDate = bookingDate;
            if (typeof startTime === 'string') updates.startTime = startTime;
            if (typeof endTime === 'string') updates.endTime = endTime;
            const hasUpdates =
              updates.roomId != null ||
              updates.bookingDate != null ||
              updates.startTime != null ||
              updates.endTime != null;
            if (hasUpdates) {
              try {
                await BookingService.updateBooking(bookingId, userId, false, updates);
                logger.info('Pay-the-difference-update booking update completed', {
                  eventId: event.id,
                  userId,
                  bookingId,
                });
              } catch (updateErr) {
                if (creditsGrantedThisCall) {
                  try {
                    await CreditTransactionService.revokePayDifferenceCredits(userId, sourceId);
                    logger.warn(
                      'Pay-the-difference-update credits revoked due to booking update failure',
                      { eventId: event.id, userId, bookingId, paymentIntentId: paymentIntent.id }
                    );
                  } catch (revokeErr) {
                    logger.error(
                      'Failed to revoke pay-the-difference-update credits after booking update failure',
                      revokeErr instanceof Error ? revokeErr : new Error(String(revokeErr)),
                      { eventId: event.id, userId, bookingId, paymentIntentId: paymentIntent.id }
                    );
                  }
                }
                logger.error(
                  'Pay-the-difference-update booking update failed',
                  updateErr instanceof Error ? updateErr : new Error(String(updateErr)),
                  { eventId: event.id, userId, bookingId }
                );
                throw updateErr;
              }
            }
          }
        } else {
          logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
        }
        break;
      }
      case 'payment_intent.payment_failed':
        logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
        break;
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId && subscription.id && subscription.status === 'active') {
          await SubscriptionService.linkMonthlySubscriptionToMembership(userId, subscription.id);
          logger.info('Monthly subscription linked to membership', { eventId: event.id, userId });
        } else {
          logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId && subscription.id && subscription.status === 'active') {
          await SubscriptionService.linkMonthlySubscriptionToMembership(userId, subscription.id);
          logger.info('Monthly subscription linked to membership', { eventId: event.id, userId });
        } else {
          logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.mode === 'subscription' &&
          session.payment_status === 'paid' &&
          session.subscription
        ) {
          const userId = session.metadata?.userId;
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as { id?: string })?.id;
          if (userId && subscriptionId) {
            await SubscriptionService.linkMonthlySubscriptionToMembership(userId, subscriptionId);
            logger.info('Monthly subscription linked from Checkout', {
              eventId: event.id,
              userId,
              subscriptionId,
            });
          } else {
            logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
          }
        } else {
          logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
        }
        break;
      }
      case 'customer.subscription.deleted':
        logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
        break;
      case 'invoice.payment_succeeded': {
        let invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id?: string };
          parent?: { subscription_details?: { metadata?: { userId?: string } } };
        };
        const periodEnd = invoice.period_end;
        if (periodEnd == null) {
          logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
          break;
        }
        // Fetch full invoice with lines so we can detect prorated first-invoice split.
        const fullInvoice =
          invoice.lines?.data?.length != null
            ? invoice
            : await stripe.invoices.retrieve(invoice.id, { expand: ['lines.data'] });
        let amountPaidPence = fullInvoice.amount_paid ?? 0;
        if (amountPaidPence <= 0) {
          logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
          break;
        }
        // Prefer userId from invoice parent metadata (Stripe snapshots subscription metadata at finalization) to avoid synchronous stripe.subscriptions.retrieve.
        let userId: string | undefined = fullInvoice.parent?.subscription_details?.metadata?.userId;
        if (userId == null) {
          const subId =
            typeof fullInvoice.subscription === 'string'
              ? fullInvoice.subscription
              : (fullInvoice.subscription as { id?: string } | undefined)?.id;
          if (subId) {
            const subscription = await stripe.subscriptions.retrieve(subId);
            userId = subscription.metadata?.userId ?? undefined;
          }
        }
        if (userId == null) {
          logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
          break;
        }
        const split = parseSubscriptionInvoiceLines(fullInvoice as Stripe.Invoice);
        if (split != null) {
          const periodEndDate = new Date(periodEnd * 1000);
          const currentMonthPeriodEnd =
            split.proratedLinePeriodEnd != null
              ? new Date(split.proratedLinePeriodEnd * 1000)
              : new Date(
                  Date.UTC(
                    periodEndDate.getUTCMonth() === 0
                      ? periodEndDate.getUTCFullYear() - 1
                      : periodEndDate.getUTCFullYear(),
                    periodEndDate.getUTCMonth() === 0 ? 11 : periodEndDate.getUTCMonth() - 1,
                    1
                  )
                );
          if (split.proratedLinePeriodEnd == null) {
            currentMonthPeriodEnd.setUTCMonth(currentMonthPeriodEnd.getUTCMonth() + 1, 0);
          }
          const nextMonthPeriodEnd = new Date(periodEnd * 1000);
          await SubscriptionService.processInitialMonthlyInvoice(
            userId,
            split.currentMonthAmountPence,
            split.nextMonthAmountPence,
            currentMonthPeriodEnd,
            nextMonthPeriodEnd
          );
          logger.info('Monthly subscription payment processed (split prorated + next month)', {
            eventId: event.id,
            userId,
            currentMonthAmountPence: split.currentMonthAmountPence,
            nextMonthAmountPence: split.nextMonthAmountPence,
          });
        } else {
          const paymentDate = new Date(periodEnd * 1000);
          await SubscriptionService.processMonthlyPayment(userId, paymentDate, amountPaidPence);
          logger.info('Monthly subscription payment processed', { eventId: event.id, userId });
        }
        break;
      }
      case 'invoice.payment_failed':
        logger.info('Stripe webhook event received', { eventId: event.id, type: event.type });
        break;
      default:
        logger.info('Stripe webhook event (unhandled type)', {
          eventId: event.id,
          type: event.type,
        });
    }
  } catch (err) {
    logger.error(
      'Stripe webhook handler error',
      err instanceof Error ? err : new Error(String(err)),
      { eventId: event.id, type: event.type }
    );
    res.status(500).json({ error: 'Webhook handler failed' });
    return;
  }

  processedEventIds.set(event.id, Date.now());
  res.status(200).json({ received: true });
}
