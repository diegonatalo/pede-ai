ALTER TABLE "auth_users" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "auth_users" ADD COLUMN "terms_accepted_at" timestamp;