import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getChatbotScan: vi.fn(),
  getChatbotScans: vi.fn(),
  getDashboardLeadOutcome: vi.fn(),
  getDashboardLeadOutcomes: vi.fn(),
  upsertChatbotScan: vi.fn(),
  upsertDashboardLeadOutcome: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { listDashboardLeads, markLeadDeclined, markLeadMeetingBooked } from "./leadData";

const originalFetch = global.fetch;

function jsonResponse(payload: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => payload, text: async () => JSON.stringify(payload) } as Response;
}

function eligibleLead(id: number) {
  return { id, business_name: `Irish Trade ${id}`, address: "Galway, Ireland", phone: null, website: `https://trade-${id}.ie`, business_type: "Plumber", google_place_id: `place-${id}`, status: "new", opted_out: false, last_seen_at: null, created_at: null, updated_at: null };
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
});

beforeEach(() => {
  dbMocks.getChatbotScans.mockResolvedValue([]);
  dbMocks.getDashboardLeadOutcomes.mockResolvedValue([]);
  dbMocks.getDashboardLeadOutcome.mockResolvedValue(undefined);
  dbMocks.upsertChatbotScan.mockResolvedValue(undefined);
  dbMocks.upsertDashboardLeadOutcome.mockResolvedValue(undefined);
});

describe("dashboard lead outcomes", () => {
  it("permanently excludes declined businesses from the all-Ireland dashboard list", async () => {
    dbMocks.getDashboardLeadOutcomes.mockResolvedValue([{ leadId: 11, outcome: "declined", recordedAt: new Date(), updatedAt: new Date() }]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([eligibleLead(11), eligibleLead(12)]))
      .mockResolvedValueOnce(jsonResponse([]));
    global.fetch = fetchMock as typeof fetch;

    const leads = await listDashboardLeads({});

    expect(leads.map(lead => lead.id)).toEqual([12]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=1000");
  });

  it("records a decline only after a current no-chatbot website check", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 7, website: "https://trade-7.ie", status: "new", opted_out: false }]))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html><body>Trade services</body></html>" } as Response);
    global.fetch = fetchMock as typeof fetch;

    await expect(markLeadDeclined(7)).resolves.toEqual({ success: true });
    expect(dbMocks.upsertDashboardLeadOutcome).toHaveBeenCalledWith(7, "declined");
  });

  it("records a meeting, writes tracker protection, and stores the meeting outcome", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 8, website: "https://trade-8.ie", status: "new", opted_out: false }]))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html><body>Trade services</body></html>" } as Response)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    global.fetch = fetchMock as typeof fetch;

    await expect(markLeadMeetingBooked(8)).resolves.toEqual({ success: true });

    expect(dbMocks.upsertDashboardLeadOutcome).toHaveBeenCalledWith(8, "meeting_booked");
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("lgs_outreach_tracker") && (init as RequestInit)?.method === "POST")).toBe(true);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("lgs_leads?id=eq.8") && (init as RequestInit)?.method === "PATCH")).toBe(true);
  });
});
