interface PainPointInput {
  industry: string | null;
  role: string;
  technologies: string[];
  employeeCount: number | null;
  searchKeywords?: string[];
}

const INDUSTRY_PAIN_POINTS: Record<string, string[]> = {
  healthcare: [
    "HIPAA compliance and patient data security",
    "integrating legacy EHR systems with modern tools",
    "reducing clinician workflow friction",
  ],
  fintech: [
    "scaling payment infrastructure reliably",
    "meeting regulatory and audit requirements",
    "reducing fraud and improving transaction monitoring",
  ],
  saas: [
    "shipping product features faster without breaking quality",
    "reducing churn through better product experience",
    "scaling the platform as customer volume grows",
  ],
  "e-commerce": [
    "improving checkout conversion and site performance",
    "managing inventory and order fulfillment at scale",
    "personalizing the customer journey across channels",
  ],
  manufacturing: [
    "connecting shop-floor systems with cloud analytics",
    "reducing downtime through better operational visibility",
    "modernizing supply chain and production tooling",
  ],
};

const ROLE_PAIN_POINTS: Record<string, string[]> = {
  ceo: ["accelerating product roadmap without overextending the team"],
  founder: ["validating product direction while keeping burn under control"],
  cto: ["reducing technical debt while maintaining delivery velocity"],
  "vp sales": ["equipping the sales team with better tooling and insights"],
  "marketing director": [
    "proving marketing ROI with better attribution and automation",
  ],
};

const TECH_PAIN_POINTS: Record<string, string> = {
  react: "modernizing the frontend experience",
  aws: "optimizing cloud costs and infrastructure reliability",
  kubernetes: "simplifying deployment and container orchestration",
  salesforce: "connecting CRM workflows with custom product data",
  hubspot: "automating lead nurturing across marketing and sales",
};

function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

function matchIndustryPainPoints(industry: string | null): string[] {
  if (!industry) return [];

  const key = normalizeKey(industry);
  for (const [pattern, points] of Object.entries(INDUSTRY_PAIN_POINTS)) {
    if (key.includes(pattern)) return points;
  }

  return [
    `keeping pace with digital transformation in ${industry}`,
    "delivering reliable software without slowing down the business",
  ];
}

function matchRolePainPoints(role: string): string[] {
  const key = normalizeKey(role);
  for (const [pattern, points] of Object.entries(ROLE_PAIN_POINTS)) {
    if (key.includes(pattern)) return points;
  }
  return [];
}

function matchTechnologyPainPoints(technologies: string[]): string[] {
  const points: string[] = [];

  for (const tech of technologies) {
    const key = normalizeKey(tech);
    for (const [pattern, point] of Object.entries(TECH_PAIN_POINTS)) {
      if (key.includes(pattern) && !points.includes(point)) {
        points.push(point);
      }
    }
  }

  return points;
}

function matchSizePainPoints(employeeCount: number | null): string[] {
  if (employeeCount === null) return [];
  if (employeeCount < 50) {
    return ["doing more with a lean engineering team"];
  }
  if (employeeCount > 500) {
    return ["aligning multiple teams around a consistent product vision"];
  }
  return [];
}

function dedupe(points: string[]): string[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = point.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function inferPainPoints(input: PainPointInput): string[] {
  const fromKeywords = (input.searchKeywords ?? [])
    .slice(0, 2)
    .map((keyword) => `addressing challenges around ${keyword}`);

  const inferred = dedupe([
    ...matchIndustryPainPoints(input.industry),
    ...matchRolePainPoints(input.role),
    ...matchTechnologyPainPoints(input.technologies),
    ...matchSizePainPoints(input.employeeCount),
    ...fromKeywords,
  ]);

  return inferred.slice(0, 4);
}
