import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const chatbotScanCache = mysqlTable("chatbot_scan_cache", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().unique(),
  website: varchar("website", { length: 2048 }).notNull(),
  state: mysqlEnum("state", ["detected", "not_detected", "not_scannable"]).notNull(),
  providers: text("providers").notNull(),
  message: text("message").notNull(),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export const dashboardLeadOutcomes = mysqlTable("dashboard_lead_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().unique(),
  outcome: mysqlEnum("outcome", ["declined", "meeting_booked"]).notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatbotScanCache = typeof chatbotScanCache.$inferSelect;
export type InsertChatbotScanCache = typeof chatbotScanCache.$inferInsert;

export const operatingProfiles = mysqlTable("operating_profiles", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  positioning: text("positioning").notNull(),
  idealCustomerProfile: text("idealCustomerProfile").notNull(),
  approvalMode: mysqlEnum("approvalMode", ["manual", "assisted"]).default("manual").notNull(),
  dailyLeadLimit: int("dailyLeadLimit").default(25).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const servicePackages = mysqlTable("service_packages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  audience: varchar("audience", { length: 255 }).notNull(),
  outcome: text("outcome").notNull(),
  description: text("description").notNull(),
  proofPoints: text("proofPoints").notNull(),
  status: mysqlEnum("status", ["active", "draft", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const scoringRules = mysqlTable("scoring_rules", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", ["positive", "negative", "disqualifier"]).notNull(),
  weight: int("weight").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const leadResearch = mysqlTable("lead_research", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().unique(),
  score: int("score").default(0).notNull(),
  scoreRationale: text("scoreRationale").notNull(),
  evidence: text("evidence").notNull(),
  appliedRuleCodes: text("appliedRuleCodes"),
  recommendation: text("recommendation").notNull(),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]).default("low").notNull(),
  reviewState: mysqlEnum("reviewState", ["pending", "reviewed", "dismissed"]).default("pending").notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const leadEvidence = mysqlTable("lead_evidence", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().unique(),
  website: varchar("website", { length: 2048 }).notNull(),
  fetchState: mysqlEnum("fetchState", ["ready", "not_scannable", "blocked"]).notNull(),
  contactMethods: text("contactMethods").notNull(),
  bookingSignals: text("bookingSignals").notNull(),
  socialLinks: text("socialLinks").notNull(),
  serviceSignals: text("serviceSignals").notNull(),
  sourceUrl: varchar("sourceUrl", { length: 2048 }).notNull(),
  summary: text("summary").notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export const leadTasks = mysqlTable("lead_tasks", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  taskType: mysqlEnum("taskType", ["review_lead", "approve_draft", "follow_up", "reply", "meeting", "proposal"]).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "done"]).default("open").notNull(),
  owner: varchar("owner", { length: 255 }).notNull(),
  dueAt: timestamp("dueAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  objective: text("objective").notNull(),
  offerId: int("offerId"),
  targetNiche: varchar("targetNiche", { length: 255 }),
  targetCounty: varchar("targetCounty", { length: 255 }),
  status: mysqlEnum("status", ["draft", "active", "paused", "completed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const messageVersions = mysqlTable("message_versions", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  campaignId: int("campaignId"),
  offerId: int("offerId"),
  versionNumber: int("versionNumber").default(1).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  state: mysqlEnum("state", ["draft", "in_review", "approved", "rejected", "blocked"]).default("draft").notNull(),
  approvalComment: text("approvalComment").notNull(),
  createdBy: varchar("createdBy", { length: 255 }).notNull(),
  reviewedBy: varchar("reviewedBy", { length: 255 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const operatingActivities = mysqlTable("operating_activities", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId"),
  actor: varchar("actor", { length: 255 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const workflowRuns = mysqlTable("workflow_runs", {
  id: int("id").autoincrement().primaryKey(),
  workflow: varchar("workflow", { length: 255 }).notNull(),
  outcome: mysqlEnum("outcome", ["queued", "running", "succeeded", "failed"]).notNull(),
  summary: text("summary").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});
