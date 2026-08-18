CREATE TABLE `lead_research` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`scoreRationale` text NOT NULL,
	`evidence` text NOT NULL,
	`recommendation` text NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`reviewState` enum('pending','reviewed','dismissed') NOT NULL DEFAULT 'pending',
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_research_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_research_leadId_unique` UNIQUE(`leadId`)
);
--> statement-breakpoint
CREATE TABLE `lead_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`taskType` enum('review_lead','approve_draft','follow_up','reply','meeting','proposal') NOT NULL,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','done') NOT NULL DEFAULT 'open',
	`owner` varchar(255) NOT NULL,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operating_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int,
	`actor` varchar(255) NOT NULL,
	`action` varchar(255) NOT NULL,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operating_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operating_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`positioning` text NOT NULL,
	`idealCustomerProfile` text NOT NULL,
	`approvalMode` enum('manual','assisted') NOT NULL DEFAULT 'manual',
	`dailyLeadLimit` int NOT NULL DEFAULT 25,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operating_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`audience` varchar(255) NOT NULL,
	`outcome` text NOT NULL,
	`description` text NOT NULL,
	`proofPoints` text NOT NULL,
	`status` enum('active','draft','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflow` varchar(255) NOT NULL,
	`outcome` enum('queued','running','succeeded','failed') NOT NULL,
	`summary` text NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `workflow_runs_id` PRIMARY KEY(`id`)
);
