-- Vários restaurantes. As linhas que já existem (só a demonstração) são preenchidas antes de a
-- coluna virar obrigatória, para a migração rodar num banco com dados.
ALTER TABLE "events" ADD COLUMN "restaurant_id" text;--> statement-breakpoint
UPDATE "events" SET "restaurant_id" = 'demo' WHERE "restaurant_id" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "restaurant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "restaurants" SET "slug" = "id" WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
CREATE INDEX "events_restaurant_seq" ON "events" USING btree ("restaurant_id","seq");--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_slug_unique" UNIQUE("slug");
