CREATE TABLE `checkouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text NOT NULL,
	`stripe_session_id` text,
	`stripe_url` text,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "checkout_minimum" CHECK("checkouts"."amount_cents" >= 500),
	CONSTRAINT "checkout_status" CHECK("checkouts"."status" IN ('creating','open','paid','expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_checkout` ON `checkouts` (`user_id`) WHERE "checkouts"."status" IN ('creating','open');--> statement-breakpoint
CREATE UNIQUE INDEX `one_stripe_session` ON `checkouts` (`stripe_session_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pair_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`checkout_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`checkout_id`) REFERENCES `checkouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pledges` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`user_id` text NOT NULL,
	`gift_cents` integer NOT NULL,
	`checkout_id` text,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checkout_id`) REFERENCES `checkouts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pledge_positive" CHECK("pledges"."gift_cents" BETWEEN 15 AND 114)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pledge_quote_once` ON `pledges` (`quote_id`);--> statement-breakpoint
CREATE INDEX `pledge_owner` ON `pledges` (`user_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purchase_key` text NOT NULL,
	`provider` text NOT NULL,
	`source` text NOT NULL,
	`usd_cents` integer,
	`cad_cents` integer NOT NULL,
	`gift_cents` integer NOT NULL,
	`fx_label` text NOT NULL,
	`fx_date` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quote_money" CHECK("quotes"."cad_cents" > 0 AND "quotes"."cad_cents" <= 100000000 AND ("quotes"."gift_cents" = 0 OR "quotes"."gift_cents" BETWEEN 15 AND 114)),
	CONSTRAINT "quote_source" CHECK("quotes"."source" IN ('estimated','entered','observed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_purchase_once` ON `quotes` (`user_id`,`purchase_key`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`created_at` integer NOT NULL
);
