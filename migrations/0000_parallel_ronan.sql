CREATE TABLE "chat_history" (
	"message_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;