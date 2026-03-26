CREATE TABLE "price_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"security_id" text NOT NULL,
	"date" text NOT NULL,
	"open" numeric(20, 8),
	"high" numeric(20, 8),
	"low" numeric(20, 8),
	"close" numeric(20, 8) NOT NULL,
	"adj_close" numeric(20, 8),
	"volume" bigint,
	"source" text DEFAULT 'mock',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "macro_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"time" text,
	"country" text DEFAULT 'US' NOT NULL,
	"category" text NOT NULL,
	"importance" text NOT NULL,
	"forecast" text,
	"previous" text,
	"actual" text,
	"description" text,
	"source" text DEFAULT 'mock',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earnings_events" (
	"id" text PRIMARY KEY NOT NULL,
	"security_id" text,
	"ticker" text NOT NULL,
	"security_name" text,
	"date" text NOT NULL,
	"time" text DEFAULT 'unknown',
	"eps_estimate" numeric(20, 4),
	"eps_actual" numeric(20, 4),
	"revenue_estimate" numeric(20, 2),
	"revenue_actual" numeric(20, 2),
	"surprise_pct" numeric(10, 2),
	"is_confirmed" boolean DEFAULT false,
	"source" text DEFAULT 'mock',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings_events" ADD CONSTRAINT "earnings_events_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_snapshot_security_date_uidx" ON "price_snapshots" USING btree ("security_id","date");--> statement-breakpoint
CREATE INDEX "price_snapshot_security_idx" ON "price_snapshots" USING btree ("security_id");--> statement-breakpoint
CREATE INDEX "price_snapshot_date_idx" ON "price_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "macro_event_date_idx" ON "macro_events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "macro_event_country_idx" ON "macro_events" USING btree ("country");--> statement-breakpoint
CREATE INDEX "macro_event_importance_idx" ON "macro_events" USING btree ("importance");--> statement-breakpoint
CREATE UNIQUE INDEX "earnings_event_ticker_date_uidx" ON "earnings_events" USING btree ("ticker","date");--> statement-breakpoint
CREATE INDEX "earnings_event_date_idx" ON "earnings_events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "earnings_event_ticker_idx" ON "earnings_events" USING btree ("ticker");