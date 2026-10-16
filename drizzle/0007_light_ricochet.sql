ALTER TYPE "public"."order_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_refund_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_by_users_id_fk" FOREIGN KEY ("refunded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;