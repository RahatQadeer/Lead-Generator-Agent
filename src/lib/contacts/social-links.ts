import type { PersonSocialProfiles, SocialNetwork } from "@/types/contact";

const NETWORK_LABELS: Record<SocialNetwork, string> = {
  twitter: "X",
  facebook: "Facebook",
  instagram: "Instagram",
};

export interface SocialProfileLink {
  network: SocialNetwork;
  label: string;
  url: string;
}

/** Populated social profiles as display-ready links, in a stable order. */
export function socialProfileLinks(
  profiles: PersonSocialProfiles | null | undefined
): SocialProfileLink[] {
  if (!profiles) return [];

  return (Object.keys(NETWORK_LABELS) as SocialNetwork[])
    .map((network) => ({ network, label: NETWORK_LABELS[network], url: profiles[network] }))
    .filter((entry): entry is SocialProfileLink => Boolean(entry.url));
}
