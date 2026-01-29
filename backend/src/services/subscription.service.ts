/**
 * Subscription service: monthly and ad-hoc subscriptions, termination, suspension date.
 * Stripe payment creation and credit granting (webhook) are wired in PR 8; here we implement
 * pro-rata/suspension logic and Stripe customer/subscription/payment-intent creation.
 */

import { db } from '../config/database';
import { memberships, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { todayUtcString } from '../utils/date.util';
import * as ProrataService from './prorata.service';
import * as StripePaymentService from './stripe-payment.service';
import * as CreditTransactionService from './credit-transaction.service';
import { isStripeConfigured } from '../config/stripe';

/**
 * Get existing Stripe customer ID from membership or by email, or create a new customer and persist to membership.
 * Avoids duplicate Stripe customers for the same user.
 */
async function getOrCreateStripeCustomerId(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const [membership] = await db
    .select({ id: memberships.id, stripeCustomerId: memberships.stripeCustomerId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  const existingId = membership?.stripeCustomerId?.trim();
  if (existingId) {
    return existingId;
  }

  const customerIdByEmail = await StripePaymentService.findCustomerByEmail(email);
  if (customerIdByEmail && membership) {
    await db
      .update(memberships)
      .set({ stripeCustomerId: customerIdByEmail, updatedAt: new Date() })
      .where(eq(memberships.id, membership.id));
    return customerIdByEmail;
  }
  if (customerIdByEmail) {
    return customerIdByEmail;
  }

  const { customerId } = await StripePaymentService.createCustomer({ email, name });
  if (membership) {
    await db
      .update(memberships)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(memberships.id, membership.id));
  }
  return customerId;
}

const AD_HOC_AMOUNT_GBP = 150;
const MONTHLY_AMOUNT_GBP = 105;

/** Stripe Price ID for monthly £105 subscription (set in env). */
function getMonthlyPriceId(): string {
  const id = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (!id || !id.trim()) {
    throw new Error('STRIPE_MONTHLY_PRICE_ID is not set');
  }
  return id.trim();
}

/**
 * Get last day of a given month in UTC as YYYY-MM-DD.
 */
function getLastDayOfMonthString(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const y = lastDay.getUTCFullYear();
  const m = (lastDay.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = lastDay.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate suspension date: last day of the month after the termination month.
 * Example: Terminate March 10 → suspensionDate = April 30.
 */
export function calculateSuspensionDate(terminationDate: Date | string): string {
  const d =
    typeof terminationDate === 'string'
      ? new Date(terminationDate + 'T12:00:00Z')
      : terminationDate;
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('Invalid terminationDate');
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return getLastDayOfMonthString(y, m + 1);
}

export interface SubscriptionStatusResult {
  canBook: boolean;
  reason?: string;
}

/**
 * Verify user can make bookings: has membership, not suspended, ad-hoc within period / monthly active.
 */
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatusResult> {
  const [userRow] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) return { canBook: false, reason: 'User not found' };
  if (userRow.status === 'suspended') return { canBook: false, reason: 'Account is suspended' };

  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!membership) return { canBook: false, reason: 'No membership' };

  const today = todayUtcString();
  if (membership.type === 'ad_hoc') {
    const endDate =
      membership.subscriptionEndDate != null
        ? String(membership.subscriptionEndDate).slice(0, 10)
        : null;
    const suspDate =
      membership.suspensionDate != null ? String(membership.suspensionDate).slice(0, 10) : null;
    if (endDate != null && endDate <= today) {
      return { canBook: false, reason: 'Ad-hoc subscription has ended' };
    }
    if (suspDate != null && suspDate <= today) {
      return { canBook: false, reason: 'Membership is suspended' };
    }
  }
  return { canBook: true };
}

/**
 * Terminate ad-hoc subscription: set terminationRequestedAt and suspensionDate.
 * User can book until suspensionDate; cron (PR 10) will suspend on that date.
 */
export async function terminateAdHocSubscription(
  userId: string,
  terminationDate: Date | string
): Promise<void> {
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!membership) throw new Error('Membership not found');
  if (membership.type !== 'ad_hoc') {
    throw new Error('Only ad-hoc subscriptions can be terminated');
  }

  const suspensionDate = calculateSuspensionDate(terminationDate);
  const termDate =
    typeof terminationDate === 'string'
      ? new Date(terminationDate + 'T12:00:00Z')
      : terminationDate;

  await db
    .update(memberships)
    .set({
      terminationRequestedAt: termDate,
      suspensionDate,
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membership.id));
}

export interface CreateMonthlySubscriptionResult {
  customerId: string;
  subscriptionId: string;
  clientSecret?: string;
  currentMonthAmount: number;
  nextMonthAmount: number;
  currentMonthExpiry: string;
  nextMonthExpiry: string;
}

/**
 * Create monthly subscription: pro-rata for current month, full for next; create Stripe customer and subscription.
 * Credits are granted on payment confirmation (webhook in PR 8). Returns Stripe data for frontend to complete payment.
 */
export async function createMonthlySubscription(
  userId: string,
  joinDate: Date | string,
  email: string,
  name: string
): Promise<CreateMonthlySubscriptionResult> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }
  const join = typeof joinDate === 'string' ? new Date(joinDate + 'T12:00:00Z') : joinDate;
  if (Number.isNaN(join.getTime())) {
    throw new TypeError('Invalid joinDate');
  }

  const prorata = ProrataService.calculateProrataAmount(join, MONTHLY_AMOUNT_GBP);
  const customerId = await getOrCreateStripeCustomerId(userId, email, name);
  const priceId = getMonthlyPriceId();
  const subscription = await StripePaymentService.createSubscription({
    customerId,
    priceId,
    metadata: { userId },
  });

  return {
    customerId,
    subscriptionId: subscription.subscriptionId,
    clientSecret: subscription.clientSecret,
    currentMonthAmount: prorata.currentMonthAmount,
    nextMonthAmount: prorata.nextMonthAmount,
    currentMonthExpiry: prorata.currentMonthExpiry,
    nextMonthExpiry: prorata.nextMonthExpiry,
  };
}

export interface CreateAdHocSubscriptionResult {
  customerId: string;
  clientSecret: string;
  paymentIntentId: string;
}

/**
 * Create ad-hoc subscription: Stripe customer + payment intent for £150.
 * On payment success (webhook in PR 8), credits are granted and membership updated.
 */
export async function createAdHocSubscription(
  userId: string,
  purchaseDate: Date | string,
  email: string,
  name: string
): Promise<CreateAdHocSubscriptionResult> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }
  const purchase =
    typeof purchaseDate === 'string' ? new Date(purchaseDate + 'T12:00:00Z') : purchaseDate;
  if (Number.isNaN(purchase.getTime())) {
    throw new TypeError('Invalid purchaseDate');
  }

  const customerId = await getOrCreateStripeCustomerId(userId, email, name);
  const amountPence = AD_HOC_AMOUNT_GBP * 100;
  const { paymentIntentId, clientSecret } = await StripePaymentService.createPaymentIntent({
    amount: amountPence,
    currency: 'gbp',
    customerId,
    metadata: {
      type: 'ad_hoc_subscription',
      userId,
      purchaseDate:
        typeof purchaseDate === 'string' ? purchaseDate : purchaseDate.toISOString().split('T')[0],
    },
    description: 'Ad-hoc one-month subscription',
  });

  return { customerId, clientSecret, paymentIntentId };
}

/**
 * Process recurring monthly payment (called from webhook when invoice.payment_succeeded).
 * Grants £105 credit expiring at end of the payment month.
 */
export async function processMonthlyPayment(
  userId: string,
  paymentDate: Date | string
): Promise<void> {
  const d = typeof paymentDate === 'string' ? new Date(paymentDate + 'T12:00:00Z') : paymentDate;
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('Invalid paymentDate');
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const expiryDate = getLastDayOfMonthString(y, m);
  await CreditTransactionService.grantCredits(
    userId,
    MONTHLY_AMOUNT_GBP,
    expiryDate,
    'monthly_subscription',
    undefined,
    'Monthly subscription payment'
  );
}
