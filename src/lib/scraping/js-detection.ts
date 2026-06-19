/** Heuristics for pages that need a headless browser (React, Next.js, Vue, etc.). */
export function isLikelyJsRendered(html: string): boolean {
  if (!html || html.length < 200) return true;

  const signals = [
    /__NEXT_DATA__/i,
    /id=["']__next["']/i,
    /id=["']root["']/i,
    /id=["']app["']/i,
    /data-reactroot/i,
    /ng-version/i,
    /window\.__NUXT__/i,
    /vite\/client/i,
  ];

  if (signals.some((pattern) => pattern.test(html))) {
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // SPA shell: framework markers but almost no visible text
    if (bodyText.length < 120) return true;
  }

  return false;
}

export function shouldTryPlaywrightFallback(
  html: string | null,
  hasUsefulData: boolean
): boolean {
  if (hasUsefulData) return false;
  if (!html) return true;
  return isLikelyJsRendered(html);
}
