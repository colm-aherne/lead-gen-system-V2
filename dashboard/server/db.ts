import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ChatbotScanCache, InsertChatbotScanCache, InsertUser, chatbotScanCache, dashboardLeadOutcomes, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getChatbotScan(leadId: number): Promise<ChatbotScanCache | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(chatbotScanCache).where(eq(chatbotScanCache.leadId, leadId)).limit(1);
  return rows[0];
}

export async function getChatbotScans(leadIds: number[]) {
  const db = await getDb();
  if (!db || !leadIds.length) return [];
  return db.select().from(chatbotScanCache).where(inArray(chatbotScanCache.leadId, leadIds));
}

export async function upsertChatbotScan(input: InsertChatbotScanCache): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatbotScanCache).values(input).onDuplicateKeyUpdate({
    set: {
      website: input.website,
      state: input.state,
      providers: input.providers,
      message: input.message,
      scannedAt: input.scannedAt,
      expiresAt: input.expiresAt,
    },
  });
}

export type DashboardLeadOutcome = "declined" | "meeting_booked";

export async function getDashboardLeadOutcomes(leadIds: number[]) {
  const db = await getDb();
  if (!db || !leadIds.length) return [];
  return db.select().from(dashboardLeadOutcomes).where(inArray(dashboardLeadOutcomes.leadId, leadIds));
}

export async function getDashboardLeadOutcome(leadId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(dashboardLeadOutcomes).where(eq(dashboardLeadOutcomes.leadId, leadId)).limit(1);
  return rows[0];
}

export async function upsertDashboardLeadOutcome(leadId: number, outcome: DashboardLeadOutcome) {
  const db = await getDb();
  if (!db) throw new Error("Dashboard outcome storage is unavailable.");
  await db.insert(dashboardLeadOutcomes).values({ leadId, outcome, recordedAt: new Date() }).onDuplicateKeyUpdate({
    set: { outcome, recordedAt: new Date(), updatedAt: new Date() },
  });
}
