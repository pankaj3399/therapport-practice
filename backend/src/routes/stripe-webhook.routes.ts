import { Router } from 'express';
import { handleStripeWebhook } from '../controllers/stripe-webhook.controller';

const router = Router();

/**
 * Stripe webhook endpoint. Must be mounted with express.raw({ type: 'application/json' })
 * so the raw body is available for signature verification. No authentication (Stripe signs requests).
 */
router.post('/', handleStripeWebhook);

export default router;
