CREATE TABLE `chatbot_scan_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`website` varchar(2048) NOT NULL,
	`state` enum('detected','not_detected','not_scannable') NOT NULL,
	`providers` text NOT NULL,
	`message` text NOT NULL,
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `chatbot_scan_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `chatbot_scan_cache_leadId_unique` UNIQUE(`leadId`)
);
