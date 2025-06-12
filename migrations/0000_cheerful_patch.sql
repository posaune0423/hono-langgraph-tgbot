CREATE TABLE "chat_history" (
	"message_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technical_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"timestamp" integer NOT NULL,
	"vwap" numeric,
	"vwap_deviation" numeric,
	"obv" numeric,
	"obv_zscore" numeric,
	"percent_b" numeric,
	"bb_width" numeric,
	"atr" numeric,
	"atr_percent" numeric,
	"adx" numeric,
	"adx_direction" text,
	"rsi" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_ohlcv" (
	"token" text NOT NULL,
	"timestamp" integer NOT NULL,
	"open" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"close" numeric NOT NULL,
	"volume" numeric NOT NULL,
	CONSTRAINT "token_ohlcv_token_timestamp_pk" PRIMARY KEY("token","timestamp")
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"address" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimals" integer NOT NULL,
	"icon_url" text NOT NULL
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
CREATE TABLE "users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"username" text,
	"age" integer,
	"crypto_risk_tolerance" integer,
	"total_assets" integer,
	"crypto_assets" integer,
	"panic_level" integer,
	"heart_rate" integer,
	"interests" json,
	"current_setup_step" text,
	"setup_completed" boolean DEFAULT false,
	"waiting_for_input" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_analysis" ADD CONSTRAINT "technical_analysis_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ohlcv" ADD CONSTRAINT "token_ohlcv_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_signals" ADD CONSTRAINT "trading_signals_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_ohlcv_token_timestamp_idx" ON "token_ohlcv" USING btree ("token","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "token_ohlcv_timestamp_idx" ON "token_ohlcv" USING btree ("timestamp" DESC NULLS LAST);