import { describe, expect, it } from "vitest";
import { buildPersonSearchSql } from "@/lib/people-data-labs/client";

describe("People Data Labs client", () => {
  it("builds SQL for company domain and job titles", () => {
    const sql = buildPersonSearchSql({
      domain: "ehealthtechnologies.com",
      jobTitles: ["VP Engineering"],
    });
    expect(sql).toContain("job_company_website='ehealthtechnologies.com'");
    expect(sql.toLowerCase()).toContain("vp engineering");
  });

  it("builds executive fallback SQL", () => {
    const sql = buildPersonSearchSql({
      domain: "acme.com",
      jobTitles: ["CTO"],
      executiveFallback: true,
    });
    expect(sql).toContain("job_title_levels");
    expect(sql).toContain("chief");
  });
});
