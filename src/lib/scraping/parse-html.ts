import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import {
  isPlausiblePersonName,
  pickBestPersonalEmail,
  sanitizePersonLinkedInUrl,
} from "@/lib/scraping/data-quality";
import {
  isLeadershipPressUrl,
  parseLeadershipFromPressHtml,
} from "@/lib/scraping/press-release-leaders";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

const TITLE_KEYWORDS = [
  "ceo",
  "cto",
  "cfo",
  "coo",
  "founder",
  "co-founder",
  "cofounder",
  "president",
  "director",
  "managing director",
  "executive",
  "vp",
  "vice president",
  "head of",
  "manager",
  "lead",
  "chief",
  "chairman",
  "chairperson",
  "deputy",
  "partner",
  "owner",
  "vd",
  "grundare",
  "verkställande",
  "styrelse",
  "ordförande",
  "ekonomichef",
  "marknadschef",
  "sales director",
  "commercial",
];

export interface ParsedCompanyMetadata {
  title: string | null;
  description: string | null;
  emails: string[];
  phones: string[];
  socialLinks: {
    linkedin: string | null;
    twitter: string | null;
    facebook: string | null;
  };
  technologies: string[];
}

export interface ParsedContact {
  fullName: string;
  firstName: string;
  lastName: string | null;
  title: string;
  email: string | null;
  linkedinUrl: string | null;
  source: "page" | "pattern";
  sourceUrl?: string | null;
  affiliationText?: string | null;
  extractionSource?: "website_team" | "linkedin_search" | "wikidata" | "directory_listing" | "domain_search";
}

const TECH_SIGNATURES: Record<string, RegExp> = {
  React: /react(?:\.min)?\.js|__NEXT_DATA__|_next\/static/i,
  "Next.js": /_next\/static|__NEXT_DATA__/i,
  Vue: /vue(?:\.min)?\.js/i,
  Angular: /angular(?:\.min)?\.js|ng-version/i,
  WordPress: /wp-content|wordpress/i,
  Shopify: /cdn\.shopify\.com|shopify/i,
  HubSpot: /js\.hs-scripts\.com|hubspot/i,
  "Node.js": /node\.js|express/i,
  AWS: /amazonaws\.com/i,
  Azure: /azure/i,
  PostgreSQL: /postgresql/i,
  Docker: /docker/i,
};

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function extractEmails(text: string, domain?: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  const cleaned = uniqueStrings(matches.map(decodeHtmlEntities)).filter((email) => {
    const lower = email.toLowerCase();
    if (lower.includes("example.com") || lower.includes("sentry")) return false;
    if (lower.endsWith(".png") || lower.endsWith(".jpg")) return false;
    if (domain && !lower.endsWith(`@${domain}`) && !lower.includes(domain)) {
      return lower.split("@")[1]?.includes(domain) ?? false;
    }
    return true;
  });
  return cleaned;
}

export function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) ?? [];
  return uniqueStrings(matches).filter((phone) => phone.replace(/\D/g, "").length >= 8);
}

export function detectTechnologies(html: string): string[] {
  const found: string[] = [];
  for (const [name, pattern] of Object.entries(TECH_SIGNATURES)) {
    if (pattern.test(html)) found.push(name);
  }
  return found;
}

export function parseCompanyMetadata(
  html: string,
  domain: string
): ParsedCompanyMetadata {
  const $ = cheerio.load(html);
  const text = $("body").text();

  const title =
    $("meta[property='og:site_name']").attr("content")?.trim() ||
    $("title").first().text().trim() ||
    null;

  const description =
    $("meta[name='description']").attr("content")?.trim() ||
    $("meta[property='og:description']").attr("content")?.trim() ||
    $("p").first().text().trim().slice(0, 280) ||
    null;

  const linkedin = $("a[href*='linkedin.com/company']").first().attr("href") ?? null;

  const twitter =
    $("a[href*='twitter.com']").first().attr("href") ??
    $("a[href*='x.com']").first().attr("href") ??
    null;

  const facebook = $("a[href*='facebook.com']").first().attr("href") ?? null;

  return {
    title,
    description,
    emails: extractEmails(`${html}\n${text}`, domain),
    phones: extractPhones(text),
    socialLinks: { linkedin, twitter, facebook },
    technologies: detectTechnologies(html),
  };
}

function splitName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function looksLikePersonName(value: string): boolean {
  return isPlausiblePersonName(value);
}

function looksLikeTitle(value: string): boolean {
  const lower = value.toLowerCase();
  return TITLE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function isLeadershipDirectoryUrl(url: string): boolean {
  try {
    const path = new URL(url.startsWith("http") ? url : `https://${url}`).pathname.toLowerCase();
    return /\/(team|people|leadership|management|board|directors|executive|staff|about|department|key-management|om-oss|ledning|vara-team|medarbetare|organisation|org)(\/|$)|-(team|management|leadership|staff)(\/|$)/i.test(
      path
    );
  } catch {
    return false;
  }
}

function inferTitleFromLines(lines: string[], name: string, leadershipPage: boolean): string {
  const candidate =
    lines.find((line) => line !== name && looksLikeTitle(line)) ??
    (leadershipPage
      ? lines.find(
          (line) =>
            line !== name &&
            line.length >= 3 &&
            line.length <= 72 &&
            !looksLikePersonName(line) &&
            !/^(read more|contact|email|phone|linkedin)$/i.test(line)
        )
      : undefined);

  return candidate && (looksLikeTitle(candidate) || leadershipPage) ? candidate : "Team Member";
}

export function parseContactsFromHtml(
  html: string,
  domain: string,
  sourceUrl?: string
): ParsedContact[] {
  const $ = cheerio.load(html);
  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();
  const leadershipPage = sourceUrl ? isLeadershipDirectoryUrl(sourceUrl) : false;

  function addContact(input: {
    fullName: string;
    title: string;
    email: string | null;
    linkedinUrl: string | null;
    source: "page" | "pattern";
    affiliationText?: string | null;
  }) {
    const key = `${input.fullName.toLowerCase()}|${input.title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    const { firstName, lastName } = splitName(input.fullName);
    contacts.push({
      fullName: input.fullName,
      firstName,
      lastName,
      title: input.title,
      email: input.email,
      linkedinUrl: sanitizePersonLinkedInUrl(input.linkedinUrl),
      source: input.source,
      sourceUrl: sourceUrl ?? null,
      affiliationText: input.affiliationText ?? null,
      extractionSource: "website_team",
    });
  }

  function parseContextBlock(
    contextEl: cheerio.Cheerio<AnyNode>,
    source: "page" | "pattern"
  ) {
    const contextText = contextEl.text();
    const lines = contextText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const name =
      lines.find(looksLikePersonName) ??
      contextEl.find("h2, h3, h4, h5, strong, .name, [class*='name']").first().text().trim();

    if (!name || !looksLikePersonName(name)) return;

    const title = inferTitleFromLines(lines, name, leadershipPage);

    const linkedin =
      contextEl.find("a[href*='linkedin.com/in']").first().attr("href") ?? null;

    const mailto =
      contextEl.find("a[href^='mailto:']").first().attr("href")?.replace(/^mailto:/i, "").split("?")[0].trim() ??
      null;

    const localEmails = extractEmails(contextText, domain);

    addContact({
      fullName: name,
      title:
        looksLikeTitle(title) || (leadershipPage && title !== "Team Member")
          ? title
          : "Team Member",
      email: pickBestPersonalEmail(name, mailto, localEmails),
      linkedinUrl: linkedin,
      source,
      affiliationText: contextText.slice(0, 500),
    });
  }

  // JSON-LD Person / Employee nodes
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const raw = $(element).html();
      if (!raw) return;
      const data = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(data) ? data : [data];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const type = String(record["@type"] ?? "");
        if (!/Person|Employee/i.test(type)) continue;

        const fullName = String(record.name ?? "").trim();
        if (!fullName || !looksLikePersonName(fullName)) continue;

        const title = String(record.jobTitle ?? record.title ?? "Team Member");
        const rawEmail = record.email ? String(record.email) : null;
        const email = rawEmail
          ? pickBestPersonalEmail(fullName, rawEmail, [])
          : null;
        const linkedin = sanitizePersonLinkedInUrl(
          typeof record.sameAs === "string" && record.sameAs.includes("linkedin.com/in")
            ? record.sameAs
            : Array.isArray(record.sameAs)
              ? ((record.sameAs as string[]).find((u) => u.includes("linkedin.com/in")) ?? null)
              : null
        );

        addContact({
          fullName,
          title: looksLikeTitle(title) ? title : "Team Member",
          email,
          linkedinUrl: linkedin,
          source: "page",
          affiliationText: `${fullName} ${title}`,
        });
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  // Bricks Builder / WordPress team cards (e.g. team-card__name + team-card__title)
  $("[class*='team-card']").each((_, element) => {
    const card = $(element);
    const name = card
      .find(
        "[class*='team-card__name'], [class*='member-name'], [class*='profile-name'], h2, h3, h4"
      )
      .first()
      .text()
      .trim();
    if (!name || !looksLikePersonName(name)) return;

    const titleCandidates = card
      .find("[class*='team-card__title'], [class*='member-title'], [class*='profile-title'], [class*='job-title']")
      .map((__, node) => $(node).text().trim())
      .get()
      .filter(Boolean);

    const title =
      titleCandidates.find((value) => looksLikeTitle(value)) ??
      titleCandidates.find(
        (value) =>
          value.length >= 3 &&
          value.length <= 80 &&
          !looksLikePersonName(value) &&
          !/^(view bio|read more|contact)$/i.test(value)
      ) ??
      "Team Member";

    const linkedin = card.find("a[href*='linkedin.com/in']").first().attr("href") ?? null;
    const mailto =
      card
        .find("a[href^='mailto:']")
        .first()
        .attr("href")
        ?.replace(/^mailto:/i, "")
        .split("?")[0]
        .trim() ?? null;

    addContact({
      fullName: name,
      title: looksLikeTitle(title) || leadershipPage ? title : "Team Member",
      email: pickBestPersonalEmail(name, mailto, extractEmails(card.text(), domain)),
      linkedinUrl: linkedin,
      source: "page",
      affiliationText: `${name} ${title} ${card.text()}`.slice(0, 500),
    });
  });

  // mailto links with surrounding context
  $("a[href^='mailto:']").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
    const context = $(element).closest("div, li, article, section, tr, [class*='team'], [class*='member'], [class*='staff']");
    parseContextBlock(context, "page");
    if (!contacts.some((c) => c.email === email)) {
      const lines = context.text().split("\n").map((l) => l.trim()).filter(Boolean);
      const name = lines.find(looksLikePersonName);
      if (name) {
        const personalEmail = pickBestPersonalEmail(name, email, []);
        addContact({
          fullName: name,
          title: lines.find(looksLikeTitle) ?? "Team Member",
          email: personalEmail,
          linkedinUrl: context.find("a[href*='linkedin.com/in']").first().attr("href") ?? null,
          source: "page",
          affiliationText: context.text().slice(0, 500),
        });
      }
    }
  });

  // Headings that look like person names (leadership pages only — avoids homepage nav noise)
  if (leadershipPage) {
    $("h2, h3, h4, h5, strong").each((_, element) => {
      const name = $(element).text().trim();
      if (!looksLikePersonName(name)) return;
      parseContextBlock($(element).parent(), "page");
    });

    // Name + title on adjacent lines (common on /about pages — e.g. eHealth Technologies)
    $("h2, h3, h4, h5").each((_, element) => {
      const name = $(element).text().trim();
      if (!looksLikePersonName(name)) return;

      const siblingTitle = $(element)
        .next("p, span, div, h4, h5, a, button")
        .first()
        .text()
        .trim()
        .replace(/\bview bio\b/gi, "")
        .trim();

      if (!siblingTitle || !looksLikeTitle(siblingTitle)) return;

      const block = $(element).parent();
      const linkedin = block.find("a[href*='linkedin.com/in']").first().attr("href") ?? null;
      const mailto =
        block
          .find("a[href^='mailto:']")
          .first()
          .attr("href")
          ?.replace(/^mailto:/i, "")
          .split("?")[0]
          .trim() ?? null;

      addContact({
        fullName: name,
        title: siblingTitle,
        email: pickBestPersonalEmail(name, mailto, extractEmails(block.text(), domain)),
        linkedinUrl: linkedin,
        source: "page",
        affiliationText: `${name} ${siblingTitle} ${block.text()}`.slice(0, 500),
      });
    });
  }

  // Team / staff card grids (common on React marketing sites)
  $(
    "[class*='team-member'], [class*='team_member'], [class*='staff-member'], [class*='person-card'], [class*='profile-card'], [class*='member-card'], [class*='employee'], [class*='leadership'], [class*='our-team'], [class*='staff']"
  ).each((_, element) => {
    parseContextBlock($(element), "page");
  });

  // Common two-line blocks inside team/about sections
  $("[class*='team'], [class*='people'], [class*='leadership'], [class*='staff'], [class*='about']")
    .find("h2, h3, h4, h5")
    .each((_, element) => {
      const name = $(element).text().trim();
      if (!looksLikePersonName(name)) return;

      const siblingTitle = $(element)
        .next("p, span, div, h3, h4, h5")
        .first()
        .text()
        .trim();
      if (!siblingTitle || !looksLikeTitle(siblingTitle)) return;

      parseContextBlock($(element).parent(), "page");
    });

  // Board / directory tables (corporate governance pages)
  $("table tr").each((_, element) => {
    const cells = $(element)
      .find("td, th")
      .map((__, cell) => $(cell).text().trim())
      .get()
      .filter(Boolean);

    if (cells.length < 2) return;

    const name = cells.find(looksLikePersonName);
    if (!name) return;

    const title =
      cells.find((cell) => cell !== name && looksLikeTitle(cell)) ??
      cells.find((cell) => cell !== name) ??
      "Team Member";

    const row = $(element);
    const linkedin = row.find("a[href*='linkedin.com/in']").first().attr("href") ?? null;
    const mailto =
      row
        .find("a[href^='mailto:']")
        .first()
        .attr("href")
        ?.replace(/^mailto:/i, "")
        .split("?")[0]
        .trim() ?? null;
    const localEmails = extractEmails(row.text(), domain);

    addContact({
      fullName: name,
      title: looksLikeTitle(title) ? title : "Team Member",
      email: pickBestPersonalEmail(name, mailto, localEmails),
      linkedinUrl: linkedin,
      source: "page",
      affiliationText: row.text().slice(0, 500),
    });
  });

  // Definition lists on leadership / directory pages
  $("dl").each((_, element) => {
    const $dl = $(element);
    $dl.find("dt").each((__, dt) => {
      const name = $(dt).text().trim();
      if (!looksLikePersonName(name)) return;
      const dd = $(dt).next("dd");
      const ddText = dd.text().trim();
      const title =
        (looksLikeTitle(ddText) ? ddText : dd.find("[class*='title']").first().text().trim()) ||
        "Team Member";
      const linkedin = dd.find("a[href*='linkedin.com/in']").first().attr("href") ?? null;
      const mailto =
        dd
          .find("a[href^='mailto:']")
          .first()
          .attr("href")
          ?.replace(/^mailto:/i, "")
          .split("?")[0]
          .trim() ?? null;
      const localEmails = extractEmails(dd.text(), domain);

      addContact({
        fullName: name,
        title: looksLikeTitle(title) ? title : "Team Member",
        email: pickBestPersonalEmail(name, mailto, localEmails),
        linkedinUrl: linkedin,
        source: "page",
        affiliationText: `${name} ${title} ${dd.text()}`.slice(0, 500),
      });
    });
  });

  // h3/h4 name with role in the next sibling (Framer, Webflow, Shopify themes)
  $("h2, h3, h4").each((_, element) => {
    const name = $(element).text().trim();
    if (!looksLikePersonName(name)) return;

    const role =
      $(element)
        .nextAll("p, span, div, h5, h6, [class*='qualification'], [class*='title'], [class*='role']")
        .first()
        .text()
        .trim() ||
      $(element)
        .parent()
        .find("span.qualification, .qualification, [class*='qualification'], [class*='job-title'], [class*='position']")
        .first()
        .text()
        .trim();

    if (!role) return;
    if (!looksLikeTitle(role) && (!leadershipPage || role.length > 80 || role.includes("."))) {
      return;
    }
    const block = $(element).closest("div, li, article, section").length
      ? $(element).closest("div, li, article, section")
      : $(element).parent();
    const linkedin = block.find("a[href*='linkedin.com/in']").first().attr("href") ?? null;
    const mailto =
      block
        .find("a[href^='mailto:']")
        .first()
        .attr("href")
        ?.replace(/^mailto:/i, "")
        .split("?")[0]
        .trim() ?? null;
    addContact({
      fullName: name,
      title: looksLikeTitle(role) || leadershipPage ? role : "Team Member",
      email: pickBestPersonalEmail(name, mailto, extractEmails(block.text(), domain)),
      linkedinUrl: linkedin,
      source: "page",
      affiliationText: `${name} ${role} ${block.text()}`.slice(0, 500),
    });
  });

  // LinkedIn profile links with adjacent name text
  $("a[href*='linkedin.com/in']").each((_, element) => {
    const linkedin = $(element).attr("href") ?? null;
    const block = $(element).closest("div, li, article, section, [class*='team'], [class*='member']");
    const lines = block
      .text()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const name = lines.find(looksLikePersonName);
    if (!name) return;

    const title = lines.find((line) => line !== name && looksLikeTitle(line)) ?? "Team Member";
    const localEmails = extractEmails(block.text(), domain);

    addContact({
      fullName: name,
      title,
      email: pickBestPersonalEmail(name, null, localEmails),
      linkedinUrl: linkedin,
      source: "page",
      affiliationText: block.text().slice(0, 500),
    });
  });

  if (sourceUrl && isLeadershipPressUrl(sourceUrl)) {
    for (const person of parseLeadershipFromPressHtml(html, sourceUrl)) {
      addContact({
        fullName: person.fullName,
        title: person.title,
        email: person.email,
        linkedinUrl: person.linkedinUrl,
        source: person.source,
        affiliationText: person.affiliationText,
      });
    }
  }

  return contacts;
}

export function guessEmailPatterns(
  contact: ParsedContact,
  domain: string
): string | null {
  if (contact.email) return contact.email;

  const first = contact.firstName.toLowerCase().replace(/[^a-z]/g, "");
  const last = (contact.lastName ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!first) return null;

  if (last) {
    return `${first}.${last}@${domain}`;
  }

  return `${first}@${domain}`;
}

export function inferIndustry(description: string | null, industryHint: string): string | null {
  if (industryHint.trim()) return industryHint.trim();
  if (!description) return null;
  return description.split(".")[0]?.trim().slice(0, 80) ?? null;
}
