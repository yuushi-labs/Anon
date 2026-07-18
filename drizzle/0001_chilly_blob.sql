CREATE TABLE `message_read_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`readerId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_read_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_message_reader_receipt` UNIQUE(`messageId`,`readerId`)
);
--> statement-breakpoint
ALTER TABLE `app_users` ADD `readReceiptsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `message_read_receipts` ADD CONSTRAINT `message_read_receipts_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_read_receipts` ADD CONSTRAINT `message_read_receipts_readerId_app_users_id_fk` FOREIGN KEY (`readerId`) REFERENCES `app_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `message_read_receipt_message_idx` ON `message_read_receipts` (`messageId`);--> statement-breakpoint
CREATE INDEX `message_read_receipt_reader_idx` ON `message_read_receipts` (`readerId`);