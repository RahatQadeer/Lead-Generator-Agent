import type { CompanyPublicView, PersonPublicView } from "@/lib/pipeline/public-views";

export const DISCOVERY_DISPLAY_BATCH = 20;

export type CompanySortKey = "fit" | "confidence" | "name";
export type CompanyFilterKey = "all" | "strong_fit";
export type ContactSortKey = "relevance" | "name" | "company";
export type ContactFilterKey = "all" | "title_match" | "linkedin" | "alt_only";

export function sortCompanies(
  companies: CompanyPublicView[],
  sortBy: CompanySortKey
): CompanyPublicView[] {
  const sorted = [...companies];
  switch (sortBy) {
    case "confidence":
      return sorted.sort(
        (a, b) =>
          b.confidenceScore - a.confidenceScore ||
          b.fitScore - a.fitScore ||
          a.name.localeCompare(b.name)
      );
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "fit":
    default:
      return sorted.sort(
        (a, b) =>
          b.fitScore - a.fitScore ||
          b.confidenceScore - a.confidenceScore ||
          a.name.localeCompare(b.name)
      );
  }
}

export function filterCompanies(
  companies: CompanyPublicView[],
  filterBy: CompanyFilterKey
): CompanyPublicView[] {
  if (filterBy === "strong_fit") {
    return companies.filter((company) => company.fitScore >= 70);
  }
  return companies;
}

export function sortContacts(
  contacts: PersonPublicView[],
  sortBy: ContactSortKey
): PersonPublicView[] {
  const sorted = [...contacts];
  switch (sortBy) {
    case "name":
      return sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
    case "company":
      return sorted.sort(
        (a, b) =>
          a.companyName.localeCompare(b.companyName) ||
          b.confidenceScore - a.confidenceScore
      );
    case "relevance":
    default:
      return sorted.sort((a, b) => {
        const titleBoost =
          (b.titleMatched === false ? 0 : 10) - (a.titleMatched === false ? 0 : 10);
        return (
          b.confidenceScore - a.confidenceScore ||
          titleBoost ||
          a.fullName.localeCompare(b.fullName)
        );
      });
  }
}

export function filterContacts(
  contacts: PersonPublicView[],
  filterBy: ContactFilterKey
): PersonPublicView[] {
  switch (filterBy) {
    case "title_match":
      return contacts.filter((contact) => contact.titleMatched !== false);
    case "linkedin":
      return contacts.filter((contact) => Boolean(contact.linkedinUrl));
    case "alt_only":
      return contacts.filter((contact) => contact.titleMatched === false);
    case "all":
    default:
      return contacts;
  }
}
