import { describe, expect, it } from "vitest";
import {
  extractLeadership,
  findLeadershipPageUrl,
} from "@/lib/scrapers/utils/extract-leadership";

describe("extractLeadership", () => {
  it("extracts founders from LinkedIn anchors on a team page", () => {
    const html = `
      <section class="team">
        <div class="team-member">
          <h3>Jane Doe</h3>
          <p>Co-Founder &amp; CEO</p>
          <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
        </div>
        <div class="team-member">
          <h3>John Smith</h3>
          <p>CTO</p>
          <a href="https://linkedin.com/in/john-smith-1a2b3c">in</a>
        </div>
      </section>`;

    const people = extractLeadership(html);
    const jane = people.find((p) => p.name === "Jane Doe");
    const john = people.find((p) => p.name === "John Smith");

    expect(jane).toBeTruthy();
    expect(jane?.title).toMatch(/co-?founder|ceo/i);
    expect(jane?.linkedinUrl).toContain("linkedin.com/in/jane-doe");
    expect(john?.title).toMatch(/cto/i);
    expect(john?.linkedinUrl).toContain("john-smith");
  });

  it("extracts people from schema.org JSON-LD", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Acme",
        "founder": {
          "@type": "Person",
          "name": "Ada Lovelace",
          "jobTitle": "Founder",
          "sameAs": ["https://www.linkedin.com/in/ada-lovelace"]
        }
      }
      </script>`;

    const people = extractLeadership(html);
    const ada = people.find((p) => p.name === "Ada Lovelace");
    expect(ada).toBeTruthy();
    expect(ada?.title).toMatch(/founder/i);
    expect(ada?.linkedinUrl).toContain("ada-lovelace");
  });

  it("extracts from Name, Title text pairs without links", () => {
    const html = `<ul><li>Maria Garcia, Chief Executive Officer</li><li>Some marketing copy here.</li></ul>`;
    const people = extractLeadership(html);
    expect(people.some((p) => p.name === "Maria Garcia")).toBe(true);
  });

  it("rejects role phrases as names and trims role words fused onto a name", () => {
    const html = `<ul>
      <li>Chief Executive Officer</li>
      <li>Managing Director</li>
      <li>Alain Meier Chief Executive Officer</li>
    </ul>`;
    const people = extractLeadership(html);
    const names = people.map((p) => p.name);
    expect(names).not.toContain("Chief Executive Officer");
    expect(names).not.toContain("Managing Director");
    expect(names).toContain("Alain Meier");
    const alain = people.find((p) => p.name === "Alain Meier");
    expect(alain?.title).toMatch(/executive officer|chief/i);
  });

  it("ignores non-leadership content and sentences", () => {
    const html = `<p>We are building the future of work for everyone everywhere.</p>`;
    expect(extractLeadership(html)).toHaveLength(0);
  });

  it("returns nothing for empty html", () => {
    expect(extractLeadership("")).toEqual([]);
  });
});

describe("findLeadershipPageUrl", () => {
  it("finds an about/team link", () => {
    const html = `<a href="/about-us">About</a><a href="/team">Team</a>`;
    const url = findLeadershipPageUrl(html, "https://acme.com");
    expect(url).toMatch(/acme\.com\/(about-us|team)/);
  });

  it("returns null when no relevant link exists", () => {
    const html = `<a href="/pricing">Pricing</a>`;
    expect(findLeadershipPageUrl(html, "https://acme.com")).toBeNull();
  });
});
