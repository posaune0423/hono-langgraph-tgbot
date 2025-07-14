ALTER TABLE "users" ALTER COLUMN "last_updated" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_updated" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_token_holdings" ALTER COLUMN "amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "user_token_holdings" ALTER COLUMN "last_verified_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_token_holdings" ALTER COLUMN "last_verified_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_token_holdings" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_token_holdings" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_token_holdings" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_token_holdings" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
CREATE INDEX "users_wallet_address_idx" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "users_setup_completed_idx" ON "users" USING btree ("setup_completed");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tokens_symbol_idx" ON "tokens" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "tokens_name_idx" ON "tokens" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_token_holdings_user_id_idx" ON "user_token_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_token_holdings_token_address_idx" ON "user_token_holdings" USING btree ("token_address");--> statement-breakpoint
CREATE INDEX "user_token_holdings_last_verified_at_idx" ON "user_token_holdings" USING btree ("last_verified_at");--> statement-breakpoint
CREATE INDEX "user_token_holdings_user_verified_idx" ON "user_token_holdings" USING btree ("user_id","last_verified_at");--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_symbol_unique" UNIQUE("symbol");--> statement-breakpoint
ALTER TABLE "user_token_holdings" ADD CONSTRAINT "user_token_holdings_user_token_unique" UNIQUE("user_id","token_address");