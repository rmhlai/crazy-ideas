CREATE TABLE `child` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`grade` text,
	`school` text,
	`color` text DEFAULT '#3b82f6' NOT NULL,
	`watchlist` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `day_note` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`no_service` integer DEFAULT false NOT NULL,
	`note` text,
	`upload_id` integer,
	FOREIGN KEY (`upload_id`) REFERENCES `upload`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `day_note_date_idx` ON `day_note` (`date`);--> statement-breakpoint
CREATE TABLE `dish` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`canonical_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`vendor` text,
	`first_seen_date` text,
	`last_seen_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dish_normalized_uq` ON `dish` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `dish_alias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dish_id` integer NOT NULL,
	`alias_name` text NOT NULL,
	`normalized_alias` text NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dish_alias_normalized_uq` ON `dish_alias` (`normalized_alias`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_order_uq` ON `feedback` (`order_id`);--> statement-breakpoint
CREATE TABLE `ingredient` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_normalized_uq` ON `ingredient` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `ingredient_change` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dish_id` integer NOT NULL,
	`upload_id` integer,
	`from_snapshot_id` integer,
	`to_snapshot_id` integer,
	`from_month` text,
	`to_month` text NOT NULL,
	`added` text NOT NULL,
	`removed` text NOT NULL,
	`allergens_added` text NOT NULL,
	`allergens_removed` text NOT NULL,
	`dismissed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`upload_id`) REFERENCES `upload`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_snapshot_id`) REFERENCES `ingredient_snapshot`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_snapshot_id`) REFERENCES `ingredient_snapshot`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ingredient_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dish_id` integer NOT NULL,
	`upload_id` integer,
	`effective_month` text NOT NULL,
	`raw_text` text DEFAULT '' NOT NULL,
	`declared_allergens` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`upload_id`) REFERENCES `upload`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `snapshot_dish_idx` ON `ingredient_snapshot` (`dish_id`);--> statement-breakpoint
CREATE TABLE `menu_offering` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`dish_id` integer NOT NULL,
	`option_label` text,
	`price_cents` integer,
	`upload_id` integer,
	FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_id`) REFERENCES `upload`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `offering_date_idx` ON `menu_offering` (`date`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`date` text NOT NULL,
	`dish_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price_cents` integer,
	`status` text DEFAULT 'ordered' NOT NULL,
	`upload_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_id`) REFERENCES `upload`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_child_date_dish_uq` ON `orders` (`child_id`,`date`,`dish_id`);--> statement-breakpoint
CREATE INDEX `orders_date_idx` ON `orders` (`date`);--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshot_ingredient` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`parent_ingredient_id` integer,
	`position` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `ingredient_snapshot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `snapshot_ingredient_snapshot_idx` ON `snapshot_ingredient` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `upload` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`original_filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`files` text DEFAULT '[]' NOT NULL,
	`mime_type` text NOT NULL,
	`page_count` integer,
	`month` text,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`extraction_json` text,
	`confirmed_json` text,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`confirmed_at` text
);
