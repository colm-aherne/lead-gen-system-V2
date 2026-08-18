import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCollectionWorkflow, listDashboardLeads, markLeadContacted, markLeadOptedOut, scanLeadChatbot } from "./leadData";

const originalFetch = global.fetch;

function jsonResponse(payload: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => payload, text: async () => JSON.stringify(payload) } as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.GITHUB_WORKFLOW_TOKEN = "github-test-key";
});

describe("lead dashboard data safeguards", () => {
  it("marks a tracker-backed lead as duplicate outreach and exposes its saved draft", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 7, business_name: "Northside Heat", address: "Dublin", phone: "01 222", website: "https://example.ie", business_type: "HVAC", google_place_id: "place-7", status: "new", opted_out: false, last_seen_at: null, created_at: null, updated_at: null }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 21, lead_id: 7, email_draft: "A saved draft.", email_sent: false, sent_at: null, response_received: false, response_text: null, response_date: null, notes: null, created_at: null }]));
    global.fetch = fetchMock as typeof fetch;

    const leads = await listDashboardLeads({ search: "Dublin" });

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ id: 7, duplicateOutreach: true, tracker: { id: 21, emailDraft: "A saved draft." } });
    expect(String(fetchMock.mock.calls[0][0])).toContain("business_name.ilike.*Dublin*");
  });

  it("refuses to record direct contact when a tracker row already exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 21, lead_id: 7 }]));
    global.fetch = fetchMock as typeof fetch;

    await expect(markLeadContacted(7)).rejects.toThrow("already has outreach history");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("writes an opt-out status and suppression flag together", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 7, status: "opted_out", opted_out: true }]));
    global.fetch = fetchMock as typeof fetch;

    await expect(markLeadOptedOut(7)).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("lgs_leads?id=eq.7"),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "opted_out", opted_out: true }) })
    );
  });

  it("returns tracker-free non-opted-out leads across statuses when the unused filter is enabled", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 7, business_name: "Fresh Lead", address: "Galway", phone: null, website: null, business_type: "Plumber", google_place_id: "place-7", status: "new", opted_out: false, last_seen_at: null, created_at: null, updated_at: null }, { id: 8, business_name: "Used Lead", address: "Cork", phone: null, website: null, business_type: "Roofer", google_place_id: "place-8", status: "new", opted_out: false, last_seen_at: null, created_at: null, updated_at: null }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 90, lead_id: 8, email_draft: "Existing draft", email_sent: false, sent_at: null, response_received: false, response_text: null, response_date: null, notes: null, created_at: null }]));
    global.fetch = fetchMock as typeof fetch;

    await expect(listDashboardLeads({ onlyUnused: true })).resolves.toMatchObject([{ id: 7 }]);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("status=eq.new");
    expect(String(fetchMock.mock.calls[0][0])).toContain("opted_out=eq.false");
  });

  it("detects a known chatbot-provider script from website markup", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 7, website: "https://example.ie" }]))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '<script src="https://code.tidio.co/widget.js"></script>' } as Response);
    global.fetch = fetchMock as typeof fetch;

    await expect(scanLeadChatbot(7)).resolves.toMatchObject({ state: "detected", providers: ["Tidio"] });
  });

  it("dispatches collection-only mode without generating drafts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" } as Response);
    global.fetch = fetchMock as typeof fetch;

    await expect(dispatchCollectionWorkflow()).resolves.toEqual({ queued: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("weekly-scrape.yml/dispatches"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ ref: "main", inputs: { draft_leads: "false" } }) })
    );
  });
});


describe("automatic no-chatbot eligibility", () => {
  it("returns only websites with a confirmed no-chatbot scan", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { id: 101, business_name: "Detected Chat", address: "Dublin", phone: null, website: "https://detected.ie", business_type: "Electrician", google_place_id: "detected", status: "new", opted_out: false, last_seen_at: null, created_at: null, updated_at: null },
        { id: 102, business_name: "No Website", address: "Cork", phone: null, website: null, business_type: "Painter", google_place_id: "missing", status: "new", opted_out: false, last_seen_at: null, created_at: null, updated_at: null },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '<script src="https://widget.tidio.co/widget.js"></script>' } as Response);
    global.fetch = fetchMock as typeof fetch;

    await expect(listDashboardLeads({ noChatbotOnly: true })).resolves.toEqual([]);
  });
});
