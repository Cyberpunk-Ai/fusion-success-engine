import { useEffect, useState } from "react";

import { attachRemoteRecord, insertOwnedRow, loadOwnedRows, signedInProfileId } from "@/lib/remote-store";
import { getTipsForMe, sendTipApi } from "@/lib/api-client";

export interface BankDetails {
  bankName: string;
  routingNumber: string;
  accountNumberLast4: string;
  accountHolder: string;
  isConnected: boolean;
}

export interface StripeDetails {
  email: string;
  country: string;
  isConnected: boolean;
  chargesEnabled: boolean;
}

export interface CryptoDetails {
  network: "solana" | "ethereum" | "polygon" | "bitcoin";
  address: string;
  currency: "USDC" | "SOL" | "ETH" | "BTC";
  isConnected: boolean;
}

export interface TipRecord {
  id: string;
  senderName: string;
  senderUsername: string;
  senderAvatar?: string;
  amount: number;
  message?: string;
  timestamp: string;
}

export interface PayoutRecord {
  id: string;
  amount: number;
  method: string;
  date: string;
  status: "paid" | "pending";
}

export interface MonetizationSettings {
  minimumTip: number;
  customThankYouMessage: string;
  showTipBadgeOnProfile: boolean;
}

export type PayoutMethod = "stripe" | "bank" | "crypto";

export interface SendTipInput {
  recipientUsername: string;
  amount: number;
  message?: string;
  senderName: string;
  senderUsername: string;
  senderAvatar?: string;
  postId?: string;
  spaceId?: string;
}

interface MonetizationState {
  totalEarnings: number;
  pendingBalance: number;
  tipsReceived: TipRecord[];
  payouts: PayoutRecord[];
  activePayoutMethod: PayoutMethod;
  bankDetails: BankDetails;
  stripeDetails: StripeDetails;
  cryptoDetails: CryptoDetails;
  settings: MonetizationSettings;
}

const STORAGE_KEY = "spaces:monetization";

const DEFAULTS: MonetizationState = {
  totalEarnings: 0,
  pendingBalance: 0,
  tipsReceived: [],
  payouts: [],
  activePayoutMethod: "stripe",
  bankDetails: {
    bankName: "",
    routingNumber: "",
    accountNumberLast4: "",
    accountHolder: "",
    isConnected: false,
  },
  stripeDetails: { email: "", country: "US", isConnected: false, chargesEnabled: false },
  cryptoDetails: { network: "solana", address: "", currency: "USDC", isConnected: false },
  settings: {
    minimumTip: 1,
    customThankYouMessage: "Thank you so much for supporting my creative work on Spaces! 💖",
    showTipBadgeOnProfile: true,
  },
};

function read(): MonetizationState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as MonetizationState) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let state = read();
const listeners = new Set<() => void>();

const remote = attachRemoteRecord<MonetizationState>({
  table: "monetization_settings",
  fromRow: (row) => ({
    activePayoutMethod: (row.payout_method ?? "bank") as PayoutMethod,
    bankDetails: { ...state.bankDetails, ...(row.bank_details ?? {}) },
    stripeDetails: { ...state.stripeDetails, ...(row.stripe_details ?? {}) },
    cryptoDetails: { ...state.cryptoDetails, ...(row.crypto_details ?? {}) },
    settings: {
      ...state.settings,
      minimumTip: Number(row.min_tip ?? state.settings.minimumTip),
    },
  }),
  toRow: (s) => ({
    payout_method: s.activePayoutMethod,
    bank_details: s.bankDetails,
    stripe_details: s.stripeDetails,
    crypto_details: s.cryptoDetails,
    min_tip: s.settings.minimumTip,
    tips_enabled: true,
  }),
  apply: (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  },
});

async function hydrateLedger() {
  if (!signedInProfileId()) return;
  const [tips, payouts] = await Promise.all([
    getTipsForMe(),
    loadOwnedRows("payouts", (row) => ({
      id: String(row.id),
      amount: Number(row.amount),
      method: String(row.method),
      date: new Date(row.created_at).toLocaleDateString(),
      status: (row.status === "paid" ? "paid" : "pending") as PayoutRecord["status"],
    })),
  ]);
  const tipsReceived: TipRecord[] = tips.map((row: any) => ({
    id: String(row.id),
    senderName: String(row.from_user_id),
    senderUsername: String(row.from_user_id),
    amount: Number(row.amount),
    message: row.message || undefined,
    timestamp: new Date(row.created_at).toLocaleString(),
  }));
  const totalEarnings = tipsReceived.reduce((sum, t) => sum + t.amount, 0);
  const paidOut = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  commit({
    tipsReceived,
    payouts,
    totalEarnings,
    pendingBalance: Math.max(0, totalEarnings - paidOut),
  });
}

function commit(patch: Partial<MonetizationState>) {
  state = { ...state, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
  remote.push(state);
}

export function useMonetization() {
  const [snapshot, setSnapshot] = useState<MonetizationState>(state);

  useEffect(() => {
    const sync = () => setSnapshot({ ...state });
    listeners.add(sync);
    sync();
    void hydrateLedger();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  async function sendTip(input: SendTipInput) {
    await sendTipApi({
      recipientUsername: input.recipientUsername,
      amount: input.amount,
      message: input.message,
      postId: input.postId,
      spaceId: input.spaceId,
    });
    const record: TipRecord = {
      id: `tip_${Date.now()}`,
      senderName: input.senderName,
      senderUsername: input.senderUsername,
      senderAvatar: input.senderAvatar,
      amount: input.amount,
      message: input.message,
      timestamp: new Date().toLocaleString(),
    };
    commit({
      tipsReceived: [record, ...state.tipsReceived],
      totalEarnings: state.totalEarnings + input.amount,
      pendingBalance: state.pendingBalance + input.amount,
    });
    return record;
  }

  async function requestPayout(): Promise<PayoutRecord | null> {
    if (state.pendingBalance <= 0) return null;
    const row = await insertOwnedRow("payouts", {
      amount: state.pendingBalance,
      method: state.activePayoutMethod,
      status: "paid",
    });
    const record: PayoutRecord = {
      id: String(row?.id ?? `po_${Date.now()}`),
      amount: state.pendingBalance,
      method: state.activePayoutMethod,
      date: new Date().toLocaleDateString(),
      status: "paid",
    };
    commit({ payouts: [record, ...state.payouts], pendingBalance: 0 });
    return record;
  }

  return {
    ...snapshot,
    sendTip,
    requestPayout,
    setActivePayoutMethod: (method: PayoutMethod) => commit({ activePayoutMethod: method }),
    updateBankDetails: (patch: Partial<BankDetails>) =>
      commit({ bankDetails: { ...state.bankDetails, ...patch } }),
    updateStripeDetails: (patch: Partial<StripeDetails>) =>
      commit({ stripeDetails: { ...state.stripeDetails, ...patch } }),
    updateCryptoDetails: (patch: Partial<CryptoDetails>) =>
      commit({ cryptoDetails: { ...state.cryptoDetails, ...patch } }),
    updateMonetizationSettings: (patch: Partial<MonetizationSettings>) =>
      commit({ settings: { ...state.settings, ...patch } }),
  };
}
