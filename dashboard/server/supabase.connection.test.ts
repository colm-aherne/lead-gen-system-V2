import { describe, expect, it } from "vitest";

describe("Supabase dashboard connection", () => {
  it("can read one lgs_leads row with the server-only credential", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(url).toMatch(/^https:\/\//);
    expect(key).toBeTruthy();

    const response = await fetch(`${url}/rest/v1/lgs_leads?select=id&limit=1`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key!}`,
      },
    });

    expect(response.ok).toBe(true);
  });
});
