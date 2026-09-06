import { useEffect, useState } from "react";

import { insertOwnedRow, loadOwnedRows, signedInProfileId } from "@/lib/remote-store";

export interface SupportTicket {
  id: string;
  subject: string;
  category: "Creator Studio" | "Billing & Payouts" | "Spaces & Audio" | "API & Webhooks" | "Account Security";
  priority: "Urgent (15 min SLA)" | "High (1 hr SLA)" | "Normal (4 hr SLA)";
  status: "open" | "in_progress" | "resolved";
  lastMessage: string;
  updatedAt: string;
  createdAt: string;
}

const STORAGE_KEY = "spaces:support";

function read(): SupportTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SupportTicket[]) : [];
  } catch {
    return [];
  }
}

let tickets = read();
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
}

async function hydrate() {
  if (!signedInProfileId()) return;
  tickets = await loadOwnedRows<SupportTicket>("support_tickets", (row) => ({
    id: String(row.id),
    subject: String(row.subject),
    category: row.category as SupportTicket["category"],
    priority: row.priority as SupportTicket["priority"],
    status: (row.status ?? "open") as SupportTicket["status"],
    lastMessage: String(row.body ?? ""),
    updatedAt: new Date(row.updated_at ?? row.created_at).toLocaleString(),
    createdAt: new Date(row.created_at).toLocaleString(),
  }));
  persist();
}

export function useSupport() {
  const [list, setList] = useState<SupportTicket[]>(tickets);

  useEffect(() => {
    const sync = () => setList([...tickets]);
    listeners.add(sync);
    sync();
    void hydrate();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  async function createTicket(
    subject: string,
    category: SupportTicket["category"],
    priority: SupportTicket["priority"],
    message: string,
  ) {
    const row = await insertOwnedRow("support_tickets", {
      subject,
      category,
      priority,
      body: message,
      status: "open",
    }).catch(() => null);
    const ticket: SupportTicket = {
      id: String(row?.id ?? `TKT-${Date.now().toString().slice(-6)}`),
      subject,
      category,
      priority,
      status: "open",
      lastMessage: message,
      updatedAt: new Date().toLocaleString(),
      createdAt: new Date().toLocaleString(),
    };
    tickets = [ticket, ...tickets];
    persist();
    return ticket;
  }

  return {
    tickets: list,
    conciergeAssigned: {
      name: "Dedicated VIP Concierge",
      title: "Spaces Priority Executive Support",
      avatar: null as string | null,
    },
    createTicket,
  };
}
