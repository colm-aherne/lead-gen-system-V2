import { DashboardLeadOutcome, getChatbotScan, getChatbotScans, getDashboardLeadOutcome, getDashboardLeadOutcomes, upsertChatbotScan, upsertDashboardLeadOutcome } from "./db";

export const leadStatuses = ["new", "verified", "drafted", "moved", "opted_out"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

type SupabaseLead = {
  id: number;
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  business_type: string | null;
  google_place_id: string | null;
  status: LeadStatus | null;
  opted_out: boolean | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseTracker = {
  id: number;
  lead_id: number;
  email_draft: string | null;
  email_sent: boolean | null;
  sent_at: string | null;
  response_received: boolean | null;
  response_text: string | null;
  response_date: string | null;
  notes: string | null;
  created_at: string | null;
};

export type DashboardLead = {
  id: number;
  businessName: string;
  businessType: string;
  address: string;
  phone: string;
  website: string;
  status: LeadStatus;
  optedOut: boolean;
  lastSeenAt: string | null;
  duplicateOutreach: boolean;
  outcome: DashboardLeadOutcome | null;
  outcomeRecordedAt: string | null;
  tracker: {
    id: number;
    emailDraft: string;
    emailSent: boolean;
    sentAt: string | null;
    responseReceived: boolean;
    responseText: string;
    responseDate: string | null;
    notes: string;
  } | null;
};

export type ChatbotDetection = {
  state: "detected" | "not_detected" | "not_scannable";
  providers: string[];
  message: string;
};

const CHATBOT_SIGNALS = [
  { provider: "Intercom", patterns: ["intercom", "intercomcdn"] },
  { provider: "HubSpot Chat", patterns: ["hubspot-messages", "hubspot.com/conversations"] },
  { provider: "Tidio", patterns: ["tidio", "code.tidio"] },
  { provider: "Crisp", patterns: ["crisp.chat", "$crisp"] },
  { provider: "Drift", patterns: ["drift.com", "js.driftt"] },
  { provider: "Tawk.to", patterns: ["tawk.to", "tawkto"] },
  { provider: "Zendesk", patterns: ["zendesk", "zopim"] },
  { provider: "LiveChat", patterns: ["livechatinc", "livechat.com"] },
  { provider: "Chatwoot", patterns: ["chatwoot", "woot-widget"] },
  { provider: "Freshchat", patterns: ["freshchat", "freshworks"] },
  { provider: "Olark", patterns: ["olark"] },
];

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase dashboard credentials are not configured.");
  return { url, key };
}

async function requestSupabase<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as T;
}

function safeSearch(value: string) {
  return value.trim().replace(/[(),]/g, " ").replace(/\*/g, "").slice(0, 80);
}

function trackerForLead(tracker: SupabaseTracker | undefined): DashboardLead["tracker"] {
  if (!tracker) return null;
  return {
    id: tracker.id,
    emailDraft: tracker.email_draft ?? "",
    emailSent: Boolean(tracker.email_sent),
    sentAt: tracker.sent_at,
    responseReceived: Boolean(tracker.response_received),
    responseText: tracker.response_text ?? "",
    responseDate: tracker.response_date,
    notes: tracker.notes ?? "",
  };
}

const chatbotCache = new Map<string, { expiresAt: number; result: ChatbotDetection }>();
const CHATBOT_CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_NEW_CHATBOT_SCANS_PER_REQUEST = 25;

export async function listDashboardLeads(input: { search?: string; status?: LeadStatus; onlyUnused?: boolean; noChatbotOnly?: boolean }) {
  const params = new URLSearchParams({
    select: "id,business_name,address,phone,website,business_type,google_place_id,status,opted_out,last_seen_at,created_at,updated_at",
    order: "updated_at.desc.nullslast",
    limit: "1000",
  });
  if (input.onlyUnused) {
    params.set("opted_out", "eq.false");
  }
  if (input.status) params.set("status", `eq.${input.status}`);

  const query = safeSearch(input.search ?? "");
  if (query) {
    const match = `*${query}*`;
    params.set("or", `(business_name.ilike.${match},business_type.ilike.${match},address.ilike.${match},status.ilike.${match})`);
  }

  const leads = await requestSupabase<SupabaseLead[]>(`lgs_leads?${params.toString()}`);
  const leadIds = leads.map(lead => lead.id);
  const trackerByLead = new Map<number, SupabaseTracker>();

  if (leadIds.length) {
    const trackers = await requestSupabase<SupabaseTracker[]>(
      `lgs_outreach_tracker?select=id,lead_id,email_draft,email_sent,sent_at,response_received,response_text,response_date,notes,created_at&lead_id=in.(${leadIds.join(",")})&order=created_at.desc`
    );
    for (const tracker of trackers) {
      if (!trackerByLead.has(tracker.lead_id)) trackerByLead.set(tracker.lead_id, tracker);
    }
  }

  const [outcomeRows, cachedScans] = await Promise.all([getDashboardLeadOutcomes(leadIds), getChatbotScans(leadIds)]);
  const outcomeByLead = new Map(outcomeRows.map(row => [row.leadId, row]));
  const cachedScanByLead = new Map(cachedScans.map(row => [row.leadId, row]));
  let eligibleLeads = leads
    .filter(lead => outcomeByLead.get(lead.id)?.outcome !== "declined")
    .filter(lead => !input.onlyUnused || !trackerByLead.has(lead.id));
  if (input.noChatbotOnly) {
    const now = Date.now();
    const scanResults = new Map<number, ChatbotDetection>();
    const needsScan = eligibleLeads.filter(lead => {
      if (!lead.website?.trim() || lead.opted_out) return false;
      const cached = cachedScanByLead.get(lead.id);
      if (cached && cached.website === lead.website.trim() && cached.expiresAt.getTime() > now) {
        scanResults.set(lead.id, { state: cached.state, providers: JSON.parse(cached.providers) as string[], message: cached.message });
        return false;
      }
      return true;
    }).slice(0, MAX_NEW_CHATBOT_SCANS_PER_REQUEST);
    const freshResults = await Promise.all(needsScan.map(async lead => [lead.id, await scanWebsite(lead.website!.trim(), lead.id)] as const));
    freshResults.forEach(([leadId, result]) => scanResults.set(leadId, result));
    const noChatbotIds = new Set(Array.from(scanResults.entries()).filter(([, result]) => result.state === "not_detected").map(([id]) => id));
    eligibleLeads = eligibleLeads.filter(lead => noChatbotIds.has(lead.id));
  }
  return eligibleLeads.map((lead): DashboardLead => {
    const tracker = trackerForLead(trackerByLead.get(lead.id));
    const status = lead.status ?? "new";
    return {
      id: lead.id,
      businessName: lead.business_name ?? "Unnamed business",
      businessType: lead.business_type ?? "Unclassified",
      address: lead.address ?? "No address recorded",
      phone: lead.phone ?? "No phone recorded",
      website: lead.website ?? "",
      status,
      optedOut: Boolean(lead.opted_out),
      lastSeenAt: lead.last_seen_at,
      duplicateOutreach: Boolean(tracker) || status === "drafted",
      outcome: outcomeByLead.get(lead.id)?.outcome ?? null,
      outcomeRecordedAt: outcomeByLead.get(lead.id)?.recordedAt.toISOString() ?? null,
      tracker,
    };
  });
}

async function getLeadWebsite(leadId: number) {
  const rows = await requestSupabase<Array<Pick<SupabaseLead, "id" | "website">>>(
    `lgs_leads?select=id,website&id=eq.${leadId}&limit=1`
  );
  if (!rows.length) throw new Error("Lead was not found.");
  return rows[0].website?.trim() ?? "";
}

function normaliseWebsiteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

async function scanWebsite(website: string, leadId?: number): Promise<ChatbotDetection> {
  const cached = chatbotCache.get(website);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (leadId) {
    const persisted = await getChatbotScan(leadId);
    if (persisted && persisted.website === website && persisted.expiresAt.getTime() > Date.now()) {
      const result = { state: persisted.state, providers: JSON.parse(persisted.providers) as string[], message: persisted.message } as ChatbotDetection;
      chatbotCache.set(website, { expiresAt: persisted.expiresAt.getTime(), result });
      return result;
    }
  }
  let result: ChatbotDetection;
  try {
    const response = await fetch(normaliseWebsiteUrl(website), { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "LeadContactDashboard/1.0 chatbot-scan" } });
    if (!response.ok) result = { state: "not_scannable", providers: [], message: `The website returned HTTP ${response.status}.` };
    else {
      const markup = (await response.text()).toLowerCase();
      const providers = CHATBOT_SIGNALS.filter(signal => signal.patterns.some(pattern => markup.includes(pattern))).map(signal => signal.provider);
      result = providers.length ? { state: "detected", providers, message: `Detected ${providers.join(", ")} script signal${providers.length > 1 ? "s" : ""}.` } : { state: "not_detected", providers: [], message: "No common chatbot-provider script was detected in the page markup." };
    }
  } catch {
    result = { state: "not_scannable", providers: [], message: "The website could not be scanned from the dashboard server." };
  }
  const expiresAt = new Date(Date.now() + CHATBOT_CACHE_MS);
  chatbotCache.set(website, { expiresAt: expiresAt.getTime(), result });
  if (leadId) {
    await upsertChatbotScan({ leadId, website, state: result.state, providers: JSON.stringify(result.providers), message: result.message, scannedAt: new Date(), expiresAt });
  }
  return result;
}

export async function scanLeadChatbot(leadId: number): Promise<ChatbotDetection> {
  const website = await getLeadWebsite(leadId);
  if (!website) return { state: "not_scannable", providers: [], message: "No website is recorded for this lead." };
  return scanWebsite(website, leadId);
}

export async function dispatchCollectionWorkflow() {
  const token = process.env.GITHUB_WORKFLOW_TOKEN;
  if (!token) throw new Error("GitHub workflow token is not configured.");
  const response = await fetch(
    "https://api.github.com/repos/colm-aherne/lead-gen-system-V2/actions/workflows/weekly-scrape.yml/dispatches",
    {
      method: "POST",
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { draft_leads: "false" } }),
    }
  );
  if (!response.ok) throw new Error(`GitHub workflow dispatch failed (${response.status}): ${await response.text()}`);
  return { queued: true } as const;
}

async function getExistingTracker(leadId: number) {
  return requestSupabase<SupabaseTracker[]>(
    `lgs_outreach_tracker?select=id,lead_id&lead_id=eq.${leadId}&limit=1`
  );
}

async function requireNoChatbotLeadForOutcome(leadId: number) {
  const rows = await requestSupabase<Array<Pick<SupabaseLead, "id" | "website" | "status" | "opted_out">>>(
    `lgs_leads?select=id,website,status,opted_out&id=eq.${leadId}&limit=1`
  );
  const lead = rows[0];
  if (!lead) throw new Error("Lead was not found.");
  if (lead.opted_out || lead.status === "opted_out") throw new Error("This business has opted out and cannot be progressed.");
  const existingOutcome = await getDashboardLeadOutcome(leadId);
  if (existingOutcome?.outcome === "declined") throw new Error("This business has been permanently declined and is hidden from active work queues.");
  if (!lead.website?.trim()) throw new Error("Only businesses with a confirmed no-chatbot website scan can be progressed.");
  const chatbot = await scanWebsite(lead.website.trim(), leadId);
  if (chatbot.state !== "not_detected") throw new Error("This business does not have a current confirmed no-chatbot scan.");
  return lead;
}

export async function markLeadDeclined(leadId: number) {
  await requireNoChatbotLeadForOutcome(leadId);
  await upsertDashboardLeadOutcome(leadId, "declined");
  return { success: true } as const;
}

export async function markLeadMeetingBooked(leadId: number) {
  await requireNoChatbotLeadForOutcome(leadId);
  const existingTracker = await getExistingTracker(leadId);
  if (!existingTracker.length) {
    const now = new Date().toISOString();
    await requestSupabase<SupabaseTracker[]>("lgs_outreach_tracker", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ lead_id: leadId, email_sent: true, sent_at: now, notes: "Meeting booked from Lead Contact Dashboard." }]),
    });
  }
  await requestSupabase<SupabaseLead[]>(`lgs_leads?id=eq.${leadId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "moved" }),
  });
  await upsertDashboardLeadOutcome(leadId, "meeting_booked");
  return { success: true } as const;
}

export async function markLeadOptedOut(leadId: number) {
  await requestSupabase<SupabaseLead[]>(`lgs_leads?id=eq.${leadId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "opted_out", opted_out: true }),
  });
  return { success: true } as const;
}

export async function markLeadContacted(leadId: number) {
  const existingTracker = await getExistingTracker(leadId);
  if (existingTracker.length) {
    throw new Error("This business already has outreach history and cannot be contacted again from the dashboard.");
  }
  await requireNoChatbotLeadForOutcome(leadId);
  const outcome = await getDashboardLeadOutcome(leadId);
  if (outcome?.outcome === "meeting_booked") throw new Error("This business already has a booked meeting and cannot be contacted again from the dashboard.");

  const now = new Date().toISOString();
  await requestSupabase<SupabaseTracker[]>("lgs_outreach_tracker", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{
      lead_id: leadId,
      email_sent: true,
      sent_at: now,
      notes: "Contacted directly from Lead Contact Dashboard.",
    }]),
  });
  await requestSupabase<SupabaseLead[]>(`lgs_leads?id=eq.${leadId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "moved" }),
  });
  return { success: true } as const;
}
