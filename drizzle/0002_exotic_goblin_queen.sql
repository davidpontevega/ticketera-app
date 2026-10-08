ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "event_slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "lines" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id");