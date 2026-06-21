import { createLogger } from "@/lib/logger";

const log = createLogger("scraping.robots");
const robotsCache = new Map<string, { fetchedAt: number; disallow: string[] }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function parseRobotsTxt(content: string): string[] {
  const disallow: string[] = [];
  let activeAgent = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [directive, ...valueParts] = trimmed.split(":");
    const value = valueParts.join(":").trim();
    const key = directive.toLowerCase();

    if (key === "user-agent") {
      activeAgent = value === "*" || value.toLowerCase().includes("leadforge");
      continue;
    }

    if (activeAgent && key === "disallow" && value) {
      disallow.push(value);
    }
  }

  return disallow;
}

export function isPathDisallowed(path: string, disallowRules: string[]): boolean {
  return disallowRules.some((rule) => {
    if (rule === "/") return true;
    return path.startsWith(rule);
  });
}

export async function fetchRobotsRules(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.disallow;
  }

  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": "LeadForgeBot/1.0 (+https://righttail.com)" },
      signal: AbortSignal.timeout(4_000),
    });

    if (!response.ok) {
      robotsCache.set(origin, { fetchedAt: Date.now(), disallow: [] });
      return [];
    }

    const content = await response.text();
    const disallow = parseRobotsTxt(content);
    robotsCache.set(origin, { fetchedAt: Date.now(), disallow });
    return disallow;
  } catch (error) {
    log.warn("Failed to fetch robots.txt", { origin, error: String(error) });
    robotsCache.set(origin, { fetchedAt: Date.now(), disallow: [] });
    return [];
  }
}

export async function canFetchUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const rules = await fetchRobotsRules(parsed.origin);
    return !isPathDisallowed(parsed.pathname, rules);
  } catch {
    return false;
  }
}

export function clearRobotsCacheForTests(): void {
  robotsCache.clear();
}
