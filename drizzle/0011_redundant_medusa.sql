CREATE TABLE "event_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"stripe_payout_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_payouts_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "event_payouts" ADD CONSTRAINT "event_payouts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payouts" ADD CONSTRAINT "event_payouts_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;