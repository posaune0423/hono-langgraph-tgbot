CREATE TABLE "technical_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"timestamp" integer NOT NULL,
	"rsi" numeric,
	"macd" numeric,
	"macd_signal" numeric,
	"macd_histogram" numeric,
	"bb_upper" numeric,
	"bb_middle" numeric,
	"bb_lower" numeric,
	"sma_20" numeric,
	"sma_50" numeric,
	"ema_12" numeric,
	"ema_26" numeric,
	"volume_sma" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"signal_type" text NOT NULL,
	"indicator" text NOT NULL,
	"strength" text NOT NULL,
	"price" numeric NOT NULL,
	"message" text NOT NULL,
	"metadata" json,
	"timestamp" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "technical_analysis" ADD CONSTRAINT "technical_analysis_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_signals" ADD CONSTRAINT "trading_signals_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;