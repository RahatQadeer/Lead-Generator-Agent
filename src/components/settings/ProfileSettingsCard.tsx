"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { inputClassName } from "@/components/ui/Field";
import {
  alertErrorClassName,
  alertSuccessClassName,
  btnGhostClassName,
  btnPrimaryClassName,
  hintClassName,
  labelClassName,
} from "@/lib/ui/styles";
import { getProfileDisplayName } from "@/lib/profile/initials";
import type { Profile } from "@/types/database";
import { getApiErrorMessage } from "@/lib/ui/user-messages";

interface ProfileSettingsCardProps {
  profile: Profile;
}

export function ProfileSettingsCard({ profile: initialProfile }: ProfileSettingsCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [fullName, setFullName] = useState(initialProfile.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayName = getProfileDisplayName(profile);
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleSaveName() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to update profile."));
        return;
      }

      setProfile(data.profile);
      setMessage("Profile updated.");
      router.refresh();
    } catch {
      setError("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(file: File) {
    setUploading(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to upload photo."));
        return;
      }

      setProfile(data.profile);
      setMessage("Profile photo updated.");
      router.refresh();
    } catch {
      setError("Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = await res.json();

      if (!data.success) {
        setError(getApiErrorMessage(data.error, "Failed to remove photo."));
        return;
      }

      setProfile(data.profile);
      setMessage("Profile photo removed.");
      router.refresh();
    } catch {
      setError("Failed to remove photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="h-28 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

      <div className="px-5 pb-6 sm:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <div className="relative -mt-10 shrink-0">
            <UserAvatar
              email={profile.email}
              fullName={profile.full_name}
              avatarUrl={profile.avatar_url}
              size="xl"
              ringClassName="ring-4 ring-white shadow-lg"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition-colors hover:bg-gray-50 disabled:opacity-50"
              aria-label="Upload profile photo"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAvatarChange(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
            <p className="text-lg font-semibold text-gray-900">{displayName}</p>
            <p className="mt-0.5 break-all text-sm text-gray-500">{profile.email}</p>
            <p className="mt-1 text-xs text-gray-400">Member since {memberSince}</p>
          </div>
        </div>

        <p className={`mt-5 ${hintClassName}`}>
          Your photo appears in the header and on outreach emails. Without a
          photo, we show the first letter of your email address.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="profile-full-name" className={labelClassName}>
              Display name
            </label>
            <input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`mt-2 ${inputClassName}`}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSaveName}
            disabled={saving || uploading}
            className={btnPrimaryClassName}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save profile"
            )}
          </button>
          {profile.avatar_url && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={saving || uploading}
              className={btnGhostClassName}
            >
              <Trash2 className="h-4 w-4" />
              Remove photo
            </button>
          )}
        </div>

        {message && (
          <div className={`mt-3 ${alertSuccessClassName}`} role="status">
            {message}
          </div>
        )}
        {error && (
          <div className={`mt-3 ${alertErrorClassName}`} role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
