CREATE TABLE `scoring_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` enum('positive','negative','disqualifier') NOT NULL,
	`weight` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scoring_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `scoring_rules_code_unique` UNIQUE(`code`)
);
