import { createLogger } from "@/lib/logger";
import type { ParsedContact } from "@/lib/scraping/parse-html";
import {
  isScrapingToolAvailable,
  recordScrapingToolFailure,
  recordScrapingToolMiss,
  recordScrapingToolSuccess,
} from "@/lib/scraping/tool-health";
import * as cheerio from "cheerio";

const log = createLogger("scraping.ai-extraction");

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || "meta-llama/llama-3.1-8b-instruct:free";

export function isAiPageExtractionEnabled(): boolean {
  const flag = process.env.SCRAPING_AI_EXTRACTION_ENABLED?.toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function htmlToPromptText(html: string, maxChars = 12_000): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return text.slice(0, maxChars);
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

interface AiPersonRow {
  fullName?: string;
  name?: string;
  title?: string;
  jobTitle?: string;
  email?: string | null;
}

export function parseAiPeopleJson(raw: string): AiPersonRow[] {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    return Array.isArray(parsed) ? (parsed as AiPersonRow[]) : [];
  } catch {
    return [];
  }
}

export function mapAiRowsToContacts(
  rows: AiPersonRow[],
  sourceUrl: string,
  domain: string
): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const fullName = (row.fullName ?? row.name ?? "").trim();
    const title = (row.title ?? row.jobTitle ?? "Team Member").trim();
    if (!fullName || fullName.length < 3) continue;

    const key = `${fullName.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { firstName, lastName } = splitName(fullName);
    contacts.push({
      fullName,
      firstName,
      lastName,
      title,
      email: row.email?.trim() || null,
      linkedinUrl: null,
      source: "page",
      sourceUrl,
      affiliationText: `${fullName} — ${title}`,
      extractionSource: "website_team",
    });
  }

  return contacts.slice(0, 12);
}

/**
 * Tier 🥈 — AI extraction when Cheerio + Playwright find no structured people.
 * Uses OpenRouter free models (optional OPENROUTER_API_KEY).
 */
export async function extractContactsWithAi(
  html: string,
  input: { companyName: string; domain: string; sourceUrl: string }
): Promise<ParsedContact[]> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || !isAiPageExtractionEnabled()) return [];
  if (!isScrapingToolAvailable("ai-extraction")) return [];

  const pageText = htmlToPromptText(html);
  if (pageText.length < 80) return [];

  const prompt = `Extract leadership and executive people listed on this company website page.
Company: ${input.companyName}
Domain: ${input.domain}

Return ONLY a JSON array (no markdown). Each item:
{"fullName":"Jane Doe","title":"Chief Technology Officer","email":null}

Rules:
- Only real people with executive or leadership titles (CEO, CTO, Founder, Director, VP, Head of, Editor in Chief, etc.)
- Skip marketing slogans, section headings, and product names
- Max 8 people
- email only if explicitly shown on the page, else null

Page text:
${pageText}`;

  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "LeadForge Scraping",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "You extract structured leadership data from website text. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      log.warn("AI extraction request failed", { status: response.status });
      recordScrapingToolFailure("ai-extraction");
      return [];
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    const rows = parseAiPeopleJson(content);
    const contacts = mapAiRowsToContacts(rows, input.sourceUrl, input.domain);

    if (contacts.length > 0) {
      log.info("AI page extraction found people", {
        domain: input.domain,
        count: contacts.length,
      });
      recordScrapingToolSuccess("ai-extraction");
    } else {
      recordScrapingToolMiss("ai-extraction");
    }

    return contacts;
  } catch (error) {
    log.warn("AI extraction failed", { domain: input.domain, error: String(error) });
    recordScrapingToolFailure("ai-extraction");
    return [];
  }
}
