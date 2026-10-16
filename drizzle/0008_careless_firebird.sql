CREATE TYPE "public"."stripe_onboarding_status" AS ENUM('not_started', 'pending', 'complete');--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" smallint PRIMARY KEY NOT NULL,
	"fee_percent" numeric(5, 2) NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_single_row" CHECK ("platform_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "platform_fee_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "organizer_net_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "platform_fee_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_onboarding_status" "stripe_onboarding_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripe_account_id_unique" UNIQUE("stripe_account_id");