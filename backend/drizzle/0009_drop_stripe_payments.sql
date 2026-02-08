-- Drop stripe_payments table; revenue is queried from Stripe API directly.
DROP TABLE IF EXISTS "stripe_payments";
--> statement-breakpoint
DROP TYPE IF EXISTS "payment_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "payment_type";
