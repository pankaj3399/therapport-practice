DO $$ BEGIN
 CREATE TYPE "user_status" AS ENUM('pending', 'active', 'suspended', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;