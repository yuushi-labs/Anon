ALTER TABLE `app_users` DROP INDEX `app_users_publicKey_unique`;--> statement-breakpoint
ALTER TABLE `app_users` ADD `publicKeyHash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD CONSTRAINT `app_users_publicKeyHash_unique` UNIQUE(`publicKeyHash`);--> statement-breakpoint
ALTER TABLE `blocks` ADD CONSTRAINT `unique_block` UNIQUE(`blockerId`,`blockedId`);--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `unique_conversation` UNIQUE(`initiatorId`,`recipientId`);--> statement-breakpoint
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_blockerId_app_users_id_fk` FOREIGN KEY (`blockerId`) REFERENCES `app_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_blockedId_app_users_id_fk` FOREIGN KEY (`blockedId`) REFERENCES `app_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_initiatorId_app_users_id_fk` FOREIGN KEY (`initiatorId`) REFERENCES `app_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_recipientId_app_users_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `app_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_senderId_app_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `app_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporterId_app_users_id_fk` FOREIGN KEY (`reporterId`) REFERENCES `app_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reportedMessageId_messages_id_fk` FOREIGN KEY (`reportedMessageId`) REFERENCES `messages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `publicId_idx` ON `app_users` (`publicId`);--> statement-breakpoint
CREATE INDEX `blocker_idx` ON `blocks` (`blockerId`);--> statement-breakpoint
CREATE INDEX `blocked_idx` ON `blocks` (`blockedId`);--> statement-breakpoint
CREATE INDEX `initiator_idx` ON `conversations` (`initiatorId`);--> statement-breakpoint
CREATE INDEX `recipient_idx` ON `conversations` (`recipientId`);--> statement-breakpoint
CREATE INDEX `conversation_idx` ON `messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `sender_idx` ON `messages` (`senderId`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `reporter_idx` ON `reports` (`reporterId`);--> statement-breakpoint
CREATE INDEX `reported_message_idx` ON `reports` (`reportedMessageId`);