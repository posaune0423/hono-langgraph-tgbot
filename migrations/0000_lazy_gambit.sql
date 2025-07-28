CREATE TABLE `messages` (
	`message_id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`message_type` text NOT NULL,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`first_name` text,
	`last_name` text,
	`username` text,
	`language_code` text,
	`is_active` integer DEFAULT true,
	`last_active_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
