CREATE TABLE `app_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(255) NOT NULL,
	`username` varchar(255) NOT NULL,
	`publicKey` varchar(1024) NOT NULL,
	`publicKeyHash` varchar(64) NOT NULL,
	`iconUrl` varchar(512),
	`fcmToken` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_users_publicId_unique` UNIQUE(`publicId`),
	CONSTRAINT `app_users_publicKeyHash_unique` UNIQUE(`publicKeyHash`)
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockerId` int NOT NULL,
	`blockedId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_block` UNIQUE(`blockerId`,`blockedId`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`initiatorId` int NOT NULL,
	`recipientId` int NOT NULL,
	`anonLabel` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_conversation` UNIQUE(`initiatorId`,`recipientId`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderId` int NOT NULL,
	`content` text NOT NULL,
	`messageType` varchar(50) NOT NULL DEFAULT 'text',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterId` int NOT NULL,
	`reportedMessageId` int NOT NULL,
	`reason` text NOT NULL,
	`status` enum('pending','reviewed','resolved') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
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