CREATE TABLE `dashboard_lead_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`outcome` enum('declined','meeting_booked') NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dashboard_lead_outcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_lead_outcomes_leadId_unique` UNIQUE(`leadId`)
);
