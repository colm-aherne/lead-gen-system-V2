import { describe, expect, it } from "vitest";

describe("GitHub workflow trigger connection", () => {
  it("can read the target workflow using the restricted dashboard token", async () => {
    const token = process.env.GITHUB_WORKFLOW_TOKEN;
    expect(token).toBeTruthy();

    const response = await fetch(
      "https://api.github.com/repos/colm-aherne/lead-gen-system-V2/actions/workflows/weekly-scrape.yml",
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token!}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    expect(response.ok).toBe(true);
  });
});
