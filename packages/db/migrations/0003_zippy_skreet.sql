CREATE TABLE "financial_statements" (
	"id" text PRIMARY KEY NOT NULL,
	"security_id" text NOT NULL,
	"ticker" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period" text DEFAULT 'FY' NOT NULL,
	"revenue" numeric(20, 2),
	"gross_profit" numeric(20, 2),
	"operating_income" numeric(20, 2),
	"net_income" numeric(20, 2),
	"ebit" numeric(20, 2),
	"ebitda" numeric(20, 2),
	"eps" numeric(20, 6),
	"shares_outstanding" numeric(20, 2),
	"operating_cash_flow" numeric(20, 2),
	"capital_expenditures" numeric(20, 2),
	"free_cash_flow" numeric(20, 2),
	"depreciation" numeric(20, 2),
	"total_debt" numeric(20, 2),
	"cash_and_equivalents" numeric(20, 2),
	"total_assets" numeric(20, 2),
	"total_equity" numeric(20, 2),
	"interest_expense" numeric(20, 2),
	"tax_rate" numeric(10, 6),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dcf_valuations" (
	"id" text PRIMARY KEY NOT NULL,
	"security_id" text NOT NULL,
	"ticker" text NOT NULL,
	"wacc" numeric(10, 6) NOT NULL,
	"terminal_growth" numeric(10, 6) NOT NULL,
	"projection_years" text DEFAULT '5' NOT NULL,
	"fcff_growth_rate" numeric(10, 6) NOT NULL,
	"intrinsic_value" numeric(20, 4) NOT NULL,
	"current_price" numeric(20, 4),
	"up_downside" numeric(10, 4),
	"enterprise_value" numeric(20, 4),
	"equity_value" numeric(20, 4),
	"projected_fcff" text,
	"assumption_hash" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dcf_valuations" ADD CONSTRAINT "dcf_valuations_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fin_stmt_ticker_year_period_uidx" ON "financial_statements" USING btree ("ticker","fiscal_year","period");--> statement-breakpoint
CREATE INDEX "fin_stmt_security_idx" ON "financial_statements" USING btree ("security_id");--> statement-breakpoint
CREATE INDEX "fin_stmt_ticker_idx" ON "financial_statements" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "dcf_ticker_hash_uidx" ON "dcf_valuations" USING btree ("ticker","assumption_hash");--> statement-breakpoint
CREATE INDEX "dcf_security_idx" ON "dcf_valuations" USING btree ("security_id");--> statement-breakpoint
CREATE INDEX "dcf_ticker_idx" ON "dcf_valuations" USING btree ("ticker");