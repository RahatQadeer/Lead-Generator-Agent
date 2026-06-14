import type { Profile } from "@/types/database";

export function getProfileDisplayName(profile: {
  full_name: string | null;
  email: string;
}): string {
  return profile.full_name?.trim() || profile.email.split("@")[0] || "User";
}

/** First letter of email when no name; up to 2 chars from name when available. */
export function getProfileInitials(profile: {
  full_name: string | null;
  email: string;
}): string {
  const name = profile.full_name?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  const local = profile.email.split("@")[0]?.trim();
  return (local?.[0] ?? "U").toUpperCase();
}

export function toSenderProfile(profile: Profile) {
  return {
    email: profile.email,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  };
}

export type SenderProfile = ReturnType<typeof toSenderProfile>;
