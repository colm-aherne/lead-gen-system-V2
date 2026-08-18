CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`objective` text NOT NULL,
	`offerId` int,
	`targetNiche` varchar(255),
	`targetCounty` varchar(255),
	`status` enum('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`campaignId` int,
	`offerId` int,
	`versionNumber` int NOT NULL DEFAULT 1,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`state` enum('draft','in_review','approved','rejected','blocked') NOT NULL DEFAULT 'draft',
	`approvalComment` text NOT NULL,
	`createdBy` varchar(255) NOT NULL,
	`reviewedBy` varchar(255),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_versions_id` PRIMARY KEY(`id`)
);
