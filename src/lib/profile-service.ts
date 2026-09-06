import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

export const GUEST_PROFILE: Profile = {
  id: "guest",
  username: "guest",
  display_name: "Guest",
  bio: "",
  avatar_url: null,
  location: "",
  website: "",
  followers: 0,
  following: 0,
  verified: false,
  plan: "free",
  role: "user",
  status: "active",
  warning_count: 0,
};

/**
 * Live binding to the signed-in profile. Updated by auth-state whenever the
 * session changes so plain (non-hook) call sites stay in sync.
 */
export let currentUser: Profile = GUEST_PROFILE;
export let currentUserId: string = GUEST_PROFILE.id;

const profileCache = new Map<string, Profile>();
const inflight = new Map<string, Promise<Profile | null>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener failures */
    }
  });
}

export function subscribeProfiles(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setCurrentUser(profile: Profile | null) {
  currentUser = profile ?? GUEST_PROFILE;
  currentUserId = currentUser.id;
  if (profile) profileCache.set(profile.id, profile);
  notify();
}

export function cacheProfiles(rows: Profile[]) {
  let changed = false;
  for (const row of rows) {
    if (!row?.id) continue;
    profileCache.set(row.id, row);
    changed = true;
  }
  if (changed) notify();
}

/**
 * Compatibility view over the profile cache: a plain-object style registry
 * (`profileRegistry[id]`) backed by the live cache, used by list/search UIs.
 */
export const profileRegistry: Record<string, Profile> = new Proxy(
  {},
  {
    get: (_t, key: string) => profileCache.get(key),
    has: (_t, key: string) => profileCache.has(key as string),
    ownKeys: () => Array.from(profileCache.keys()),
    getOwnPropertyDescriptor: (_t, key: string) =>
      profileCache.has(key)
        ? { enumerable: true, configurable: true, value: profileCache.get(key) }
        : undefined,
  },
) as Record<string, Profile>;

/** Merge one profile into the shared cache and notify subscribers. */
export function updateProfileCache(profile: Profile) {
  if (!profile?.id) return;
  profileCache.set(profile.id, profile);
  notify();
}

export const defaultUserProfile = GUEST_PROFILE;

export function getCachedProfile(id: string): Profile | undefined {
  return profileCache.get(id);
}

export function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row["id"] ?? ""),
    username: String(row["username"] ?? "unknown"),
    display_name: String(row["display_name"] ?? row["username"] ?? "Unknown"),
    bio: String(row["bio"] ?? ""),
    avatar_url: (row["avatar_url"] as string | null) ?? null,
    location: String(row["location"] ?? ""),
    website: String(row["website"] ?? ""),
    followers: Number(row["followers"] ?? 0),
    following: Number(row["following"] ?? 0),
    verified: Boolean(row["verified"]),
    plan: (row["plan"] as Profile["plan"]) ?? "free",
    status: (row["status"] as Profile["status"]) ?? "active",
    warning_count: Number(row["warning_count"] ?? 0),
    joined_at: (row["created_at"] as string | undefined) ?? undefined,
    last_active: (row["last_active"] as string | undefined) ?? undefined,
  };
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  if (!id || id === "guest") return null;
  const cached = profileCache.get(id);
  if (cached) return cached;

  const existing = inflight.get(id);
  if (existing) return existing;

  const request: Promise<Profile | null> = Promise.resolve(
    supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .then(({ data }) => {
      inflight.delete(id);
      if (!data) return null;
      const profile = rowToProfile(data as Record<string, unknown>);
      profileCache.set(id, profile);
      notify();
      return profile;
    }),
  );

  inflight.set(id, request);
  return request;
}

/**
 * Synchronous profile lookup used by render paths. Returns the cached profile
 * when available and kicks off a background fetch otherwise.
 */
export function getProfile(id: string): Profile {
  const cached = id ? profileCache.get(id) : undefined;
  if (cached) return cached;
  if (id && id !== "guest") void fetchProfile(id);
  return { ...GUEST_PROFILE, id: id || "guest", display_name: "Loading…", username: "unknown" };
}

/** Reactive profile lookup used by cards and headers. */
export function useProfile(id: string | undefined | null): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(() =>
    id ? (profileCache.get(id) ?? null) : null,
  );

  useEffect(() => {
    if (!id) {
      setProfile(null);
      return;
    }
    let active = true;
    const sync = () => {
      const next = profileCache.get(id) ?? null;
      if (active && next) setProfile(next);
    };
    sync();
    if (!profileCache.has(id)) void fetchProfile(id);
    const unsubscribe = subscribeProfiles(sync);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id]);

  return profile;
}
