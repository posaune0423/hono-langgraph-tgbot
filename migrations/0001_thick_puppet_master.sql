CREATE TABLE "token_ohlcv" (
	"token" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"open" integer NOT NULL,
	"high" integer NOT NULL,
	"low" integer NOT NULL,
	"close" integer NOT NULL,
	"volume" integer NOT NULL
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
ALTER TABLE "token_ohlcv" ADD CONSTRAINT "token_ohlcv_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;