DO $$ BEGIN
 CREATE TYPE "subscription_type" AS ENUM('monthly', 'ad_hoc');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "credit_source" AS ENUM('monthly_subscription', 'ad_hoc_subscription', 'pay_difference', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_status" AS ENUM('pending', 'succeeded', 'failed', 'canceled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_type" AS ENUM('subscription', 'ad_hoc_subscription', 'pay_difference');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "subscription_type" "subscription_type";
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "stripe_subscription_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "stripe_customer_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "subscription_start_date" date;
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "subscription_end_date" date;
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "termination_requested_at" timestamp;
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "suspension_date" date;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"used_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"remaining_amount" numeric(10, 2) NOT NULL,
	"grant_date" date NOT NULL,
	"expiry_date" date NOT NULL,
	"source_type" "credit_source" NOT NULL,
	"source_id" uuid,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_payment_intent_id" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'gbp' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_type" "payment_type" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_payments_stripe_payment_intent_id_unique" ON "stripe_payments" USING btree ("stripe_payment_intent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_user_id_idx" ON "credit_transactions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_expiry_date_idx" ON "credit_transactions" USING btree ("expiry_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_payments_user_id_idx" ON "stripe_payments" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
