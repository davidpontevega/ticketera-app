ALTER TABLE "tickets" ALTER COLUMN "order_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "order_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "sequence" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "zone_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "seat_label" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tickets_order_id_idx" ON "tickets" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_sequence_unique" UNIQUE("order_id","sequence");