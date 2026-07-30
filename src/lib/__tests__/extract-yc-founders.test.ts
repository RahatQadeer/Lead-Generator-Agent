import { describe, expect, it } from "vitest";
import {
  extractYcFoundersFromHtml,
  parseFoundersFromMetaDescription,
} from "@/lib/scrapers/utils/extract-yc-founders";

const STRIPE_FIXTURE = `
<div data-page="{&quot;component&quot;:&quot;ycdc_new/pages/Companies/ShowPage&quot;,&quot;props&quot;:{&quot;company&quot;:{&quot;founders&quot;:[{&quot;full_name&quot;:&quot;Patrick Collison&quot;,&quot;title&quot;:&quot;Founder/CEO&quot;,&quot;linkedin_url&quot;:&quot;https://www.linkedin.com/in/patrickcollison/&quot;},{&quot;full_name&quot;:&quot;John Collison&quot;,&quot;title&quot;:&quot;Founder/President&quot;,&quot;linkedin_url&quot;:&quot;https://www.linkedin.com/in/johnbcollison/&quot;}]}}}"></div>
`;

describe("parseFoundersFromMetaDescription", () => {
  it("parses founder names from YC meta descriptions", () => {
    const founders = parseFoundersFromMetaDescription(
      "Founded in 2009 by John Collison and Patrick Collison, Stripe has 7000 employees based in San Francisco."
    );
    expect(founders.map((f) => f.name)).toEqual([
      "John Collison",
      "Patrick Collison",
    ]);
  });
});

describe("extractYcFoundersFromHtml", () => {
  it("extracts founders from the YC profile page payload", () => {
    const founders = extractYcFoundersFromHtml(STRIPE_FIXTURE);
    expect(founders).toHaveLength(2);
    expect(founders[0]).toMatchObject({
      name: "Patrick Collison",
      title: "Founder/CEO",
      linkedinUrl: "https://www.linkedin.com/in/patrickcollison",
    });
    expect(founders[1]).toMatchObject({
      name: "John Collison",
      title: "Founder/President",
    });
  });

  it("falls back to meta description when data-page is missing", () => {
    const html = `
      <meta name="description" content="Founded in 2009 by John Collison and Patrick Collison, Stripe has 7000 employees based in San Francisco." />
    `;
    const founders = extractYcFoundersFromHtml(html);
    expect(founders.map((f) => f.name)).toEqual([
      "John Collison",
      "Patrick Collison",
    ]);
  });
});
