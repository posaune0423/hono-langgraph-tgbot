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
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"message_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"address" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimals" integer NOT NULL,
	"icon_url" text NOT NULL,
	CONSTRAINT "tokens_symbol_unique" UNIQUE("symbol")
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
	"signal_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"signal_type" text NOT NULL,
	"value" json,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"direction" text,
	"confidence" numeric,
	"explanation" text,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_source" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"summary" text,
	"published_at" timestamp,
	"raw_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_token_holdings" (
	"user_id" text NOT NULL,
	"token_address" text NOT NULL,
	"amount" numeric(36, 18) DEFAULT '0',
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_token_holdings_user_id_token_address_pk" PRIMARY KEY("user_id","token_address"),
	CONSTRAINT "user_token_holdings_user_token_unique" UNIQUE("user_id","token_address")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ohlcv" ADD CONSTRAINT "token_ohlcv_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_analysis" ADD CONSTRAINT "technical_analysis_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_token_holdings" ADD CONSTRAINT "user_token_holdings_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_token_holdings" ADD CONSTRAINT "user_token_holdings_token_address_tokens_address_fk" FOREIGN KEY ("token_address") REFERENCES "public"."tokens"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_wallet_address_idx" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "users_setup_completed_idx" ON "users" USING btree ("setup_completed");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tokens_symbol_idx" ON "tokens" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "tokens_name_idx" ON "tokens" USING btree ("name");--> statement-breakpoint
CREATE INDEX "token_ohlcv_token_timestamp_idx" ON "token_ohlcv" USING btree ("token","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "token_ohlcv_timestamp_idx" ON "token_ohlcv" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "signal_token_idx" ON "signal" USING btree ("token");--> statement-breakpoint
CREATE INDEX "signal_type_idx" ON "signal" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "signal_timestamp_idx" ON "signal" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "data_source_type_idx" ON "data_source" USING btree ("type");--> statement-breakpoint
CREATE INDEX "data_source_published_at_idx" ON "data_source" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_token_holdings_user_id_idx" ON "user_token_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_token_holdings_token_address_idx" ON "user_token_holdings" USING btree ("token_address");--> statement-breakpoint
CREATE INDEX "user_token_holdings_last_verified_at_idx" ON "user_token_holdings" USING btree ("last_verified_at");--> statement-breakpoint
CREATE INDEX "user_token_holdings_user_verified_idx" ON "user_token_holdings" USING btree ("user_id","last_verified_at");