CREATE TABLE "staff_members" (
	"id" text PRIMARY KEY NOT NULL,
	"n" bigserial NOT NULL,
	"restaurant_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"pin_key" text NOT NULL,
	"active" boolean NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "actor_staff_id" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "staff_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "staff_locked_until" bigint;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_pin_per_restaurant" ON "staff_members" USING btree ("restaurant_id","pin_key");