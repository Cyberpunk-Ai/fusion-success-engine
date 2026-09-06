import { useEffect, useState } from "react";

import {
  deleteOwnedRow,
  insertOwnedRow,
  loadOwnedRows,
  signedInProfileId,
} from "@/lib/remote-store";

export interface ApiKey {
  id: string;
  name: string;
  maskedKey: string;
  fullKey?: string;
  createdAt: string;
  lastUsed: string;
}

export interface Webhook {
  id: string;
  url: string;
  description: string;
  events: string[];
  status: "active" | "paused";
  createdAt: string;
}

interface DeveloperState {
  apiKeys: ApiKey[];
  webhooks: Webhook[];
  totalApiCallsThisMonth: number;
}

const STORAGE_KEY = "spaces:developer";
const DEFAULTS: DeveloperState = { apiKeys: [], webhooks: [], totalApiCallsThisMonth: 0 };

function read(): DeveloperState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as DeveloperState) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let state = read();
const listeners = new Set<() => void>();

function commit(next: DeveloperState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hydrate() {
  if (!signedInProfileId()) return;
  const [apiKeys, webhooks] = await Promise.all([
    loadOwnedRows<ApiKey>("api_keys", (row) => ({
      id: String(row.id),
      name: String(row.name),
      maskedKey: `${row.prefix}••••••••${String(row.key_hash).slice(-6)}`,
      createdAt: new Date(row.created_at).toLocaleDateString(),
      lastUsed: row.last_used_at ? new Date(row.last_used_at).toLocaleDateString() : "Never",
    })),
    loadOwnedRows<Webhook>("webhooks", (row) => ({
      id: String(row.id),
      url: String(row.url),
      description: "",
      events: Array.isArray(row.events) ? (row.events as string[]) : [],
      status: row.active ? "active" : "paused",
      createdAt: new Date(row.created_at).toLocaleDateString(),
    })),
  ]);
  commit({ ...state, apiKeys, webhooks });
}

export function useDeveloper() {
  const [snapshot, setSnapshot] = useState<DeveloperState>(state);

  useEffect(() => {
    const sync = () => setSnapshot({ ...state });
    listeners.add(sync);
    sync();
    void hydrate();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  async function generateApiKey(name: string): Promise<ApiKey> {
    const token = `sk_live_${randomToken()}`;
    const row = await insertOwnedRow("api_keys", {
      name,
      prefix: "sk_live_",
      key_hash: token.slice(-12),
      scopes: ["read"],
    });
    const key: ApiKey = {
      id: String(row?.id ?? `key_${Date.now()}`),
      name,
      maskedKey: `sk_live_••••••••${token.slice(-6)}`,
      fullKey: token,
      createdAt: new Date().toLocaleDateString(),
      lastUsed: "Never",
    };
    commit({ ...state, apiKeys: [key, ...state.apiKeys] });
    return key;
  }

  function revokeApiKey(id: string) {
    void deleteOwnedRow("api_keys", id).catch(() => undefined);
    commit({ ...state, apiKeys: state.apiKeys.filter((k) => k.id !== id) });
  }

  async function addWebhook(url: string, description: string, events: string[]) {
    const row = await insertOwnedRow("webhooks", { url, events, active: true }).catch(() => null);
    const hook: Webhook = {
      id: String(row?.id ?? `wh_${Date.now()}`),
      url,
      description,
      events,
      status: "active",
      createdAt: new Date().toLocaleDateString(),
    };
    commit({ ...state, webhooks: [hook, ...state.webhooks] });
  }

  function removeWebhook(id: string) {
    void deleteOwnedRow("webhooks", id).catch(() => undefined);
    commit({ ...state, webhooks: state.webhooks.filter((w) => w.id !== id) });
  }

  return {
    apiKeys: snapshot.apiKeys,
    webhooks: snapshot.webhooks,
    totalApiCallsThisMonth: snapshot.totalApiCallsThisMonth,
    generateApiKey,
    revokeApiKey,
    addWebhook,
    removeWebhook,
  };
}
