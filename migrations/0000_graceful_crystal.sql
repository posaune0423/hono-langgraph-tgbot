CREATE TABLE "chat_history" (
	"message_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_ohlcv" (
	"token" text NOT NULL,
	"timestamp" integer NOT NULL,
	"open" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"close" numeric NOT NULL,
	"volume" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"address" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimals" integer NOT NULL,
	"logo_uri" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
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
ALTER TABLE "token_ohlcv" ADD CONSTRAINT "token_ohlcv_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;