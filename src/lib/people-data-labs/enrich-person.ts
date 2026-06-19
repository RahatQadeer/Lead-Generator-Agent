import { createLogger } from "@/lib/logger";
import { getPeopleDataLabsApiKey } from "@/lib/people-data-labs/config";

const log = createLogger("people-data-labs.enrich");
const PDL_ENRICH_URL = "https://api.peopledatalabs.com/v5/person/enrich";

export interface PdlEnrichedPerson {
  pdlId: string | null;
  fullName: string | null;
  jobTitle: string | null;
  workEmail: string | null;
  linkedinUrl: string | null;
  location: string | null;
}

interface PdlEnrichResponse {
  status?: number;
  likelihood?: number;
  data?: {
    id?: string;
    full_name?: string | null;
    job_title?: string | null;
    work_email?: string | boolean | null;
    linkedin_url?: string | null;
    location_name?: string | null;
    emails?: Array<{ address?: string; type?: string }> | null;
  };
  error?: { message?: string };
}

function normalizeLinkedIn(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function extractWorkEmail(data: PdlEnrichResponse["data"]): string | null {
  if (!data) return null;

  if (typeof data.work_email === "string" && data.work_email.includes("@")) {
    return data.work_email.trim().toLowerCase();
  }

  const emails = data.emails ?? [];
  const work = emails.find(
    (entry) =>
      entry.address?.includes("@") &&
      (entry.type === "current_professional" ||
        entry.type === "professional" ||
        entry.type === "work")
  );
  if (work?.address) return work.address.trim().toLowerCase();

  const any = emails.find((entry) => entry.address?.includes("@"));
  return any?.address?.trim().toLowerCase() ?? null;
}

function looksLikePdlId(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^[A-Za-z0-9_-]+_\d+$/.test(value.trim());
}

export async function enrichPersonFromPeopleDataLabs(input: {
  pdlId?: string | null;
  fullName: string;
  companyName?: string;
  companyDomain?: string | null;
  linkedinUrl?: string | null;
}): Promise<PdlEnrichedPerson | null> {
  const apiKey = getPeopleDataLabsApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams();
  params.set("pretty", "false");
  params.set("min_likelihood", "4");

  if (looksLikePdlId(input.pdlId)) {
    params.set("pdl_id", input.pdlId!.trim());
  } else if (input.linkedinUrl?.includes("linkedin.com/in/")) {
    params.set("profile", input.linkedinUrl.trim());
  } else {
    params.set("name", input.fullName.trim());
    const company = input.companyDomain?.replace(/^www\./, "") || input.companyName?.trim();
    if (company) params.set("company", company);
  }

  try {
    const response = await fetch(`${PDL_ENRICH_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(25_000),
    });

    if (response.status === 404) {
      return null;
    }

    const body = (await response.json()) as PdlEnrichResponse;

    if (!response.ok || !body.data) {
      log.warn("PDL person enrich failed", {
        name: input.fullName,
        status: response.status,
        message: body.error?.message ?? "unknown",
      });
      return null;
    }

    const workEmail = extractWorkEmail(body.data);
    const linkedinUrl = normalizeLinkedIn(body.data.linkedin_url ?? input.linkedinUrl);

    if (!workEmail && !linkedinUrl) {
      return null;
    }

    return {
      pdlId: body.data.id ?? input.pdlId ?? null,
      fullName: body.data.full_name ?? input.fullName,
      jobTitle: body.data.job_title ?? null,
      workEmail,
      linkedinUrl,
      location: body.data.location_name ?? null,
    };
  } catch (error) {
    log.warn("PDL person enrich request error", {
      name: input.fullName,
      error: String(error),
    });
    return null;
  }
}
