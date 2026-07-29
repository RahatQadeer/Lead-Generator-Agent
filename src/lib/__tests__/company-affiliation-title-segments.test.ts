import { describe, expect, it } from "vitest";
import { verifyPersonCompanyAffiliation } from "@/lib/scraping/company-affiliation";

const target = { name: "UCSF Health", domain: "ucsfhealth.org" };

function verifyWebsiteTitle(title: string, companyTarget = target) {
  return verifyPersonCompanyAffiliation(
    {
      title,
      bioText: title,
      source: "website_team",
      onCompanyWebsite: true,
      leadershipPage: true,
    },
    companyTarget
  );
}

describe("website titles that separate two roles", () => {
  // Regression: titles are split on "-" and "|" to parse LinkedIn's
  // "Name - Role - Company" format. Company websites use those same separators
  // between two roles, and reading the second role as an employer rejected every
  // executive whose title looked like "President | Chief Executive Officer".
  it("accepts a real leadership-page title with a pipe between two roles", () => {
    expect(verifyWebsiteTitle("President | Chief Executive Officer").matches).toBe(true);
    expect(
      verifyWebsiteTitle("Suresh GunasekaranPresident | Chief Executive Officer").matches
    ).toBe(true);
    expect(verifyWebsiteTitle("CEO - Founder", { name: "Acme", domain: "acme.com" }).matches).toBe(
      true
    );
    expect(
      verifyWebsiteTitle("VP Engineering | CTO", { name: "Acme", domain: "acme.com" }).matches
    ).toBe(true);
  });

  it("still rejects a title naming a genuinely different employer", () => {
    const gems = verifyWebsiteTitle("Group Chief Executive Officer, GEMS Education", {
      name: "EduTech Global",
      domain: "edutech.com",
    });
    expect(gems.matches).toBe(false);
    expect(gems.reason).toBe("employed_at_other_company");

    expect(
      verifyWebsiteTitle("CEO - Microsoft", { name: "Acme", domain: "acme.com" }).matches
    ).toBe(false);
  });
});
