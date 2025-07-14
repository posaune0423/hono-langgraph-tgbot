CREATE TABLE "chat_messages" (
	"message_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
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
	"amount" numeric(36, 18),
	"last_verified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_token_holdings_user_id_token_address_pk" PRIMARY KEY("user_id","token_address")
);
--> statement-breakpoint
DROP TABLE "chat_history" CASCADE;--> statement-breakpoint
DROP TABLE "trading_signals" CASCADE;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_token_tokens_address_fk" FOREIGN KEY ("token") REFERENCES "public"."tokens"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_token_holdings" ADD CONSTRAINT "user_token_holdings_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_token_holdings" ADD CONSTRAINT "user_token_holdings_token_address_tokens_address_fk" FOREIGN KEY ("token_address") REFERENCES "public"."tokens"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signal_token_idx" ON "signal" USING btree ("token");--> statement-breakpoint
CREATE INDEX "signal_type_idx" ON "signal" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "signal_timestamp_idx" ON "signal" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "data_source_type_idx" ON "data_source" USING btree ("type");--> statement-breakpoint
CREATE INDEX "data_source_published_at_idx" ON "data_source" USING btree ("published_at" DESC NULLS LAST);