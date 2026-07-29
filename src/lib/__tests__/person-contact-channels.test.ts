import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { finalizeEnrichedLead } from "@/lib/lead-enrichment/finalize-lead";
import { parseContactsFromHtml } from "@/lib/scraping/parse-html";
import {
  extractPersonContactChannels,
  personHandleMatchesName,
  sanitizePersonPhone,
  sanitizePersonSocialUrl,
} from "@/lib/scraping/person-contact-channels";

function block(html: string) {
  const $ = cheerio.load(html);
  return $("#card");
}

describe("sanitizePersonPhone", () => {
  it("normalizes a tel: link to digits, keeping the country code", () => {
    expect(sanitizePersonPhone("tel:+1 (415) 555-2671")).toBe("+14155552671");
    expect(sanitizePersonPhone("+92 300 1234567")).toBe("+923001234567");
    expect(sanitizePersonPhone("0300 1234567")).toBe("03001234567");
  });

  it("rejects values that are not dialable numbers", () => {
    expect(sanitizePersonPhone("2024")).toBeNull();
    expect(sanitizePersonPhone("1234567890123456789")).toBeNull();
    expect(sanitizePersonPhone("0000000000")).toBeNull();
    expect(sanitizePersonPhone("")).toBeNull();
    expect(sanitizePersonPhone(null)).toBeNull();
  });
});

describe("personHandleMatchesName", () => {
  it("accepts handles built from the person's name", () => {
    expect(personHandleMatchesName("johnsmith", "John Smith")).toBe(true);
    expect(personHandleMatchesName("john_smith", "John Smith")).toBe(true);
    expect(personHandleMatchesName("jsmith", "John Smith")).toBe(true);
    expect(personHandleMatchesName("john.smith.7", "John Smith")).toBe(true);
    expect(personHandleMatchesName("rahatqadeer", "Rahat Ali Qadeer")).toBe(true);
  });

  it("rejects company accounts and unrelated people", () => {
    expect(personHandleMatchesName("acmecorp", "John Smith")).toBe(false);
    expect(personHandleMatchesName("janedoe", "John Smith")).toBe(false);
    // A single-token name is too weak to claim a public handle.
    expect(personHandleMatchesName("madonna", "Madonna")).toBe(false);
  });

  it("does not let short name tokens match by coincidence", () => {
    // "charlotte" happens to contain both "lo" and "te".
    expect(personHandleMatchesName("charlotte", "Lo Te")).toBe(false);
    expect(personHandleMatchesName("acmeanders", "An Der")).toBe(false);
    // The exact handle for a short name still matches.
    expect(personHandleMatchesName("ander", "An Der")).toBe(true);
  });
});

describe("sanitizePersonSocialUrl", () => {
  it("normalizes twitter.com and x.com to one canonical profile URL", () => {
    expect(
      sanitizePersonSocialUrl("https://twitter.com/johnsmith", "twitter", "John Smith")
    ).toBe("https://x.com/johnsmith");
    expect(
      sanitizePersonSocialUrl("https://www.x.com/@JohnSmith", "twitter", "John Smith")
    ).toBe("https://x.com/johnsmith");
  });

  it("rejects the company's own account", () => {
    expect(
      sanitizePersonSocialUrl("https://twitter.com/acmecorp", "twitter", "John Smith")
    ).toBeNull();
  });

  it("rejects platform routes that are not profiles", () => {
    expect(
      sanitizePersonSocialUrl("https://twitter.com/intent/tweet", "twitter", "John Smith")
    ).toBeNull();
    expect(
      sanitizePersonSocialUrl("https://facebook.com/sharer", "facebook", "John Smith")
    ).toBeNull();
  });
});

describe("extractPersonContactChannels", () => {
  it("takes the phone and personal socials from the person's own card", () => {
    const channels = extractPersonContactChannels(
      block(`
        <div id="card">
          <h3>John Smith</h3>
          <p>CEO</p>
          <a href="tel:+14155552671">Call</a>
          <a href="https://twitter.com/johnsmith">X</a>
          <a href="https://instagram.com/john.smith">IG</a>
        </div>
      `),
      "John Smith"
    );

    expect(channels.phone).toBe("+14155552671");
    expect(channels.socialProfiles.twitter).toBe("https://x.com/johnsmith");
    expect(channels.socialProfiles.instagram).toBe("https://instagram.com/john.smith");
    expect(channels.socialProfiles.facebook).toBeNull();
  });

  it("does not attach the company's social account sitting in the person's card", () => {
    const channels = extractPersonContactChannels(
      block(`
        <div id="card">
          <h3>John Smith</h3>
          <a href="https://twitter.com/acmecorp">Follow Acme</a>
          <a href="https://facebook.com/AcmeCorporation">Acme on Facebook</a>
        </div>
      `),
      "John Smith"
    );

    expect(channels.socialProfiles.twitter).toBeNull();
    expect(channels.socialProfiles.facebook).toBeNull();
  });

  it("takes no phone when the block covers more than one person", () => {
    const channels = extractPersonContactChannels(
      block(`
        <div id="card">
          <div><h3>John Smith</h3><a href="tel:+14155552671">Call</a></div>
          <div><h3>Jane Doe</h3><a href="tel:+14155559999">Call</a></div>
        </div>
      `),
      "John Smith"
    );

    expect(channels.phone).toBeNull();
  });

  it("picks the person's handle when their card also links the company account", () => {
    const channels = extractPersonContactChannels(
      block(`
        <div id="card">
          <h3>John Smith</h3>
          <a href="https://twitter.com/acmecorp">Acme</a>
          <a href="https://twitter.com/jsmith">John on X</a>
        </div>
      `),
      "John Smith"
    );

    expect(channels.socialProfiles.twitter).toBe("https://x.com/jsmith");
  });
});

describe("parseContactsFromHtml — person-scoped channels", () => {
  it("never copies the footer's company number onto a person", () => {
    const html = `
      <html><body>
        <div class="team-member">
          <h3>John Smith</h3>
          <p>CEO</p>
        </div>
        <footer>
          <a href="tel:+14155550000">Call us: +1 415 555 0000</a>
          <a href="https://twitter.com/acmecorp">@acmecorp</a>
        </footer>
      </body></html>
    `;

    const contacts = parseContactsFromHtml(html, "acme.com", "https://acme.com/team");
    const john = contacts.find((contact) => contact.fullName === "John Smith");

    expect(john).toBeDefined();
    expect(john?.phone).toBeNull();
    expect(john?.socialProfiles?.twitter).toBeNull();
  });

  it("reads phone and socials from a JSON-LD Person node", () => {
    const html = `
      <html><body>
        <script type="application/ld+json">
        {
          "@type": "Person",
          "name": "Jane Doe",
          "jobTitle": "CTO",
          "telephone": "+1-415-555-2671",
          "sameAs": ["https://twitter.com/janedoe", "https://facebook.com/jane.doe"]
        }
        </script>
      </body></html>
    `;

    const contacts = parseContactsFromHtml(html, "acme.com", "https://acme.com/team");
    const jane = contacts.find((contact) => contact.fullName === "Jane Doe");

    expect(jane?.phone).toBe("+14155552671");
    expect(jane?.socialProfiles?.twitter).toBe("https://x.com/janedoe");
    expect(jane?.socialProfiles?.facebook).toBe("https://facebook.com/jane.doe");
  });
});

const baseLead = {
  id: "lead-1",
  name: "John Smith",
  role: "CEO",
  company: "Acme Software",
  linkedin: null,
  phone: null,
  socialProfiles: null,
  location: null,
  city: null,
  state: null,
  country: null,
  email: null,
  emailSyntaxValid: null,
  emailDomainValid: null,
  emailVerificationStatus: null,
  emailVerifiedAt: null,
  leadScore: null,
  leadScoreFactors: null,
  leadScoredAt: null,
  intentScore: null,
  intentSignals: null,
  companyId: "co-1",
  searchId: null,
  enrichedAt: new Date(0).toISOString(),
  confidenceScore: 50,
  emailSource: null,
  linkedInSource: null,
  phoneSource: null,
  contactDetailType: null,
  contactPageUrl: null,
  outreachChannel: null,
  followUpsPaused: false,
  followUpsPausedReason: null,
} as const;

describe("finalizeEnrichedLead — phone and social keep a lead", () => {
  it("keeps a phone-only person and routes them to the phone channel", () => {
    const lead = finalizeEnrichedLead({ ...baseLead, phone: "+14155552671" });

    expect(lead).not.toBeNull();
    expect(lead?.phone).toBe("+14155552671");
    expect(lead?.outreachChannel).toBe("phone");
    expect(lead?.contactDetailType).toBe("phone_only");
  });

  it("keeps a social-only person and routes them to the social channel", () => {
    const lead = finalizeEnrichedLead({
      ...baseLead,
      socialProfiles: { twitter: "https://x.com/johnsmith", facebook: null, instagram: null },
    });

    expect(lead?.outreachChannel).toBe("social");
    expect(lead?.contactDetailType).toBe("social_only");
  });

  it("still prefers email over phone when both exist", () => {
    const lead = finalizeEnrichedLead({
      ...baseLead,
      email: "john.smith@acme.com",
      emailSource: "found",
      phone: "+14155552671",
    });

    expect(lead?.outreachChannel).toBe("email");
    expect(lead?.phone).toBe("+14155552671");
  });

  it("still drops a person with no channel at all", () => {
    expect(finalizeEnrichedLead({ ...baseLead })).toBeNull();
  });

  it("drops a junk phone rather than keeping the person on it", () => {
    expect(finalizeEnrichedLead({ ...baseLead, phone: "2024" })).toBeNull();
  });
});
