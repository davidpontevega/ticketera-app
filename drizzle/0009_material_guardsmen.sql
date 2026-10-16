CREATE TYPE "public"."venue_zone_kind" AS ENUM('general', 'numbered');--> statement-breakpoint
CREATE TABLE "venue_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_zone_id" uuid NOT NULL,
	"row_label" text NOT NULL,
	"seat_number" integer NOT NULL,
	CONSTRAINT "venue_seats_zone_row_number_unique" UNIQUE("venue_zone_id","row_label","seat_number")
);
--> statement-breakpoint
CREATE TABLE "venue_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "venue_zone_kind" NOT NULL,
	"capacity" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_tiers" ADD COLUMN "venue_zone_id" uuid;--> statement-breakpoint
ALTER TABLE "venue_seats" ADD CONSTRAINT "venue_seats_venue_zone_id_venue_zones_id_fk" FOREIGN KEY ("venue_zone_id") REFERENCES "public"."venue_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_zones" ADD CONSTRAINT "venue_zones_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_zones_venue_id_idx" ON "venue_zones" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venues_created_by_idx" ON "venues" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_venue_zone_id_venue_zones_id_fk" FOREIGN KEY ("venue_zone_id") REFERENCES "public"."venue_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_venue_id_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_event_venue_zone_unique" UNIQUE("event_id","venue_zone_id");