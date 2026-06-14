import { getProfileInitials } from "@/lib/profile/initials";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-20 w-20 text-xl",
};

interface UserAvatarProps {
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
  ringClassName?: string;
}

export function UserAvatar({
  email,
  fullName = null,
  avatarUrl = null,
  size = "md",
  className = "",
  ringClassName = "ring-2 ring-white",
}: UserAvatarProps) {
  const dim = SIZE_CLASSES[size];
  const initials = getProfileInitials({ full_name: fullName, email });

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ${ringClassName} ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-800 to-gray-950 font-bold tracking-wide text-white ${ringClassName} ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
