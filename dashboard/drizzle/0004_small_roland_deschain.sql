CREATE TABLE `lead_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`website` varchar(2048) NOT NULL,
	`fetchState` enum('ready','not_scannable','blocked') NOT NULL,
	`contactMethods` text NOT NULL,
	`bookingSignals` text NOT NULL,
	`socialLinks` text NOT NULL,
	`serviceSignals` text NOT NULL,
	`sourceUrl` varchar(2048) NOT NULL,
	`summary` text NOT NULL,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `lead_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_evidence_leadId_unique` UNIQUE(`leadId`)
);
--> statement-breakpoint
ALTER TABLE `lead_research` ADD `appliedRuleCodes` text;