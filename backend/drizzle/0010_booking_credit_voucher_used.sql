-- Persist per-booking credit and voucher usage for proportional update/cancel.
ALTER TABLE "bookings" ADD COLUMN "credit_used" numeric(10, 2) NOT NULL DEFAULT '0.00';
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "voucher_hours_used" numeric(10, 2) NOT NULL DEFAULT '0.00';
