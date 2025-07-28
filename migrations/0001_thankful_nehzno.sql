PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`message_id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`message_type` text NOT NULL,
	`timestamp` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_messages`("message_id", "user_id", "content", "message_type", "timestamp") SELECT "message_id", "user_id", "content", "message_type", "timestamp" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`first_name` text,
	`last_name` text,
	`username` text,
	`language_code` text,
	`is_active` integer DEFAULT true,
	`last_active_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("user_id", "first_name", "last_name", "username", "language_code", "is_active", "last_active_at", "created_at") SELECT "user_id", "first_name", "last_name", "username", "language_code", "is_active", "last_active_at", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;