export interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function extractPlainTextFromPart(part: GmailMessagePart): string | null {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  if (!part.parts?.length) return null;

  const plainPart = part.parts.find((child) => child.mimeType === "text/plain");
  if (plainPart) return extractPlainTextFromPart(plainPart);

  for (const child of part.parts) {
    const text = extractPlainTextFromPart(child);
    if (text) return text;
  }

  return null;
}

export function extractPlainTextFromGmailPayload(
  payload: GmailMessagePart | undefined
): string | null {
  if (!payload) return null;
  return extractPlainTextFromPart(payload);
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

const QUOTED_REPLY_PATTERNS = [
  /\s+On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[\s\S]+?\s+wrote:\s*/i,
  /\s+On\s+[\s\S]+?\s+wrote:\s*/i,
  /\n-{3,}\s*Original Message\s*-{3,}[\s\S]*/i,
  /\nFrom:\s*.+\nSent:[\s\S]*/i,
  /\n_{3,}[\s\S]*/i,
];

export function stripQuotedReplyContent(text: string): string {
  let cleaned = text.replace(/\r\n/g, "\n").trim();

  for (const pattern of QUOTED_REPLY_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match?.index !== undefined && match.index > 0) {
      cleaned = cleaned.slice(0, match.index).trim();
      break;
    }
  }

  cleaned = cleaned
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .trim();

  return cleaned;
}

function truncateSnippet(text: string, maxLength = 500): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function formatReplySnippetForDisplay(snippet: string): string {
  const decoded = decodeHtmlEntities(snippet);
  const stripped = stripQuotedReplyContent(decoded);
  return truncateSnippet(stripped || decoded.trim());
}

export function buildReplySnippet(
  plainBody: string | null,
  fallbackSnippet?: string
): string {
  if (plainBody?.trim()) {
    return formatReplySnippetForDisplay(plainBody);
  }

  if (fallbackSnippet?.trim()) {
    return formatReplySnippetForDisplay(fallbackSnippet);
  }

  return "Reply received";
}
