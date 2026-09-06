import { useEffect, useState } from "react";

import { currentUser } from "@/lib/profile-service";
import { supabase } from "@/integrations/supabase/client";
import { signedInProfileId } from "@/lib/remote-store";

const db = supabase as any;

export type WorkspaceRole = "Owner" | "Admin" | "Editor" | "Analyst" | "Contributor";

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: WorkspaceRole;
  status: "active" | "invited";
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoEmoji: string;
  createdAt: string;
  seatsTotal: number;
  members: WorkspaceMember[];
}

const STORAGE_KEY = "spaces:workspaces";

function defaultWorkspaces(): Workspace[] {
  return [
    {
      id: "ws_default",
      name: "My Creator Studio",
      slug: "creator-studio",
      logoEmoji: "🚀",
      createdAt: new Date().toLocaleDateString(),
      seatsTotal: 5,
      members: [
        {
          id: "member_owner",
          name: currentUser.display_name || "You",
          email: currentUser.email || "you@spaces.app",
          avatar_url: currentUser.avatar_url ?? null,
          role: "Owner",
          status: "active",
        },
      ],
    },
  ];
}

function read(): Workspace[] {
  if (typeof window === "undefined") return defaultWorkspaces();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Workspace[]) : null;
    return parsed && parsed.length > 0 ? parsed : defaultWorkspaces();
  } catch {
    return defaultWorkspaces();
  }
}

let workspaces = read();
let activeWsId = workspaces[0]?.id ?? "ws_default";
const listeners = new Set<() => void>();

function commit(next: Workspace[]) {
  workspaces = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
}

function mutateActive(fn: (ws: Workspace) => Workspace) {
  commit(workspaces.map((ws) => (ws.id === activeWsId ? fn(ws) : ws)));
}

async function hydrate() {
  const userId = signedInProfileId();
  if (!userId) return;
  const { data: owned } = await db.from("workspaces").select("*").order("created_at");
  const rows = (owned ?? []) as Record<string, any>[];
  if (rows.length === 0) return;
  const { data: memberRows } = await db
    .from("workspace_members")
    .select("*")
    .in("workspace_id", rows.map((r) => r.id));
  const members = (memberRows ?? []) as Record<string, any>[];
  const next: Workspace[] = rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.name).toLowerCase().replace(/\s+/g, "-"),
    logoEmoji: "🚀",
    createdAt: new Date(row.created_at).toLocaleDateString(),
    seatsTotal: 5,
    members: members
      .filter((m) => m.workspace_id === row.id)
      .map((m) => ({
        id: String(m.id),
        name: String(m.name || String(m.email).split("@")[0]),
        email: String(m.email),
        avatar_url: null,
        role: (m.role ?? "Contributor") as WorkspaceRole,
        status: (m.status === "active" ? "active" : "invited") as WorkspaceMember["status"],
      })),
  }));
  activeWsId = next[0]!.id;
  commit(next);
}

export function useWorkspace() {
  const [, force] = useState(0);

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    listeners.add(rerender);
    void hydrate();
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeWsId) ?? workspaces[0]!;

  return {
    workspaces,
    activeWorkspace,
    activeWsId,
    setActiveWsId: (id: string) => {
      activeWsId = id;
      listeners.forEach((fn) => fn());
    },
    async inviteMember(email: string, role: WorkspaceRole) {
      if (signedInProfileId() && !activeWsId.startsWith("ws_")) {
        await db
          .from("workspace_members")
          .insert({ workspace_id: activeWsId, email, role, status: "invited" });
      }
      mutateActive((ws) => ({
        ...ws,
        members: [
          ...ws.members,
          {
            id: `member_${Date.now()}`,
            name: email.split("@")[0] || "Teammate",
            email,
            avatar_url: null,
            role,
            status: "invited",
          },
        ],
      }));
    },
    removeMember(id: string) {
      void db.from("workspace_members").delete().eq("id", id);
      mutateActive((ws) => ({ ...ws, members: ws.members.filter((m) => m.id !== id) }));
    },
    updateMemberRole(id: string, role: WorkspaceRole) {
      void db.from("workspace_members").update({ role }).eq("id", id);
      mutateActive((ws) => ({
        ...ws,
        members: ws.members.map((m) => (m.id === id ? { ...m, role } : m)),
      }));
    },
    async createWorkspace(name: string, logoEmoji = "✨") {
      const userId = signedInProfileId();
      let id = `ws_${Date.now()}`;
      if (userId) {
        const { data } = await db
          .from("workspaces")
          .insert({ name, owner_id: userId })
          .select("id")
          .maybeSingle();
        if (data?.id) id = String(data.id);
      }
      const ws: Workspace = {
        id,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        logoEmoji,
        createdAt: new Date().toLocaleDateString(),
        seatsTotal: 5,
        members: [],
      };
      commit([...workspaces, ws]);
      activeWsId = ws.id;
    },
  };
}
