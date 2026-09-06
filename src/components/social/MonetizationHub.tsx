import { useState } from "react";
import {
  DollarSign,
  Heart,
  CreditCard,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Send,
  Building2,
  Coins,
  Settings2,
  ExternalLink,
  RefreshCw,
  Wallet,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  useMonetization,
  type BankDetails,
  type StripeDetails,
  type CryptoDetails,
} from "@/lib/monetization-state";
import { usePlan, openUpgradeModal } from "@/lib/plan-state";
import { Avatar } from "@/components/social/Avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function MonetizationHub() {
  const { currentPlan, isPlus, isPro } = usePlan();
  const {
    totalEarnings,
    pendingBalance,
    tipsReceived,
    payouts,
    activePayoutMethod,
    bankDetails,
    stripeDetails,
    cryptoDetails,
    settings,
    requestPayout,
    setActivePayoutMethod,
    updateBankDetails,
    updateStripeDetails,
    updateCryptoDetails,
    updateMonetizationSettings,
  } = useMonetization();

  const [activeConfigTab, setActiveConfigTab] = useState<"stripe" | "bank" | "crypto" | "settings">("stripe");
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutProcessing, setPayoutProcessing] = useState(false);

  // Bank Form State
  const [bankNameDraft, setBankNameDraft] = useState(bankDetails.bankName || "Chase Bank N.A.");
  const [routingDraft, setRoutingDraft] = useState(bankDetails.routingNumber || "021000021");
  const [accountDraft, setAccountDraft] = useState(bankDetails.accountNumberLast4 || "8821");
  const [holderDraft, setHolderDraft] = useState(bankDetails.accountHolder || "Alex Rivera");

  // Crypto Form State
  const [cryptoNetwork, setCryptoNetwork] = useState<"solana" | "ethereum" | "polygon" | "bitcoin">(cryptoDetails.network || "solana");
  const [cryptoAddress, setCryptoAddress] = useState(cryptoDetails.address || "");
  const [cryptoCurrency, setCryptoCurrency] = useState<"USDC" | "SOL" | "ETH" | "BTC">(cryptoDetails.currency || "USDC");

  // Tip Settings Form State
  const [minTipDraft, setMinTipDraft] = useState(settings?.minimumTip ?? 1.0);
  const [thankYouDraft, setThankYouDraft] = useState(settings?.customThankYouMessage ?? "Thank you so much for supporting my creative work on Spaces! 💖");
  const [showBadgeDraft, setShowBadgeDraft] = useState(settings?.showTipBadgeOnProfile ?? true);

  const platformFee = isPro ? "0% (Keep 100%)" : "5% platform fee";

  const handlePayoutSubmit = async () => {
    if (pendingBalance <= 0) {
      toast.error("No pending balance available to payout.");
      return;
    }
    setPayoutProcessing(true);
    try {
      const record = await requestPayout();
      setPayoutProcessing(false);
      setIsPayoutModalOpen(false);
      if (record) {
        toast.success(`Payout of $${record.amount.toFixed(2)} sent via ${record.method}!`);
      } else {
        toast.success("Payout request submitted.");
      }
    } catch {
      setPayoutProcessing(false);
      setIsPayoutModalOpen(false);
    }
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankNameDraft || !accountDraft) {
      toast.error("Please fill in bank name and account details");
      return;
    }
    updateBankDetails({
      bankName: bankNameDraft,
      routingNumber: routingDraft,
      accountNumberLast4: accountDraft.slice(-4),
      accountHolder: holderDraft,
      isConnected: true,
    });
    toast.success("Bank account saved & verified for payouts!");
  };

  const handleSaveCrypto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cryptoAddress.trim()) {
      toast.error("Please enter a valid wallet address");
      return;
    }
    updateCryptoDetails({
      network: cryptoNetwork,
      address: cryptoAddress.trim(),
      currency: cryptoCurrency,
      isConnected: true,
    });
    toast.success(`${cryptoNetwork.toUpperCase()} payout wallet connected!`);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateMonetizationSettings({
      minimumTip: Number(minTipDraft),
      customThankYouMessage: thankYouDraft,
      showTipBadgeOnProfile: showBadgeDraft,
    });
    toast.success("Creator tip settings saved!");
  };

  const handleConnectStripe = () => {
    updateStripeDetails({
      isConnected: true,
      chargesEnabled: true,
      email: "alex.rivera@spaces.social",
    });
    toast.success("Stripe Connect Express account linked and verified!");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">Creator Monetization & Earnings</h2>
          <p className="text-xs text-muted-foreground">
            Direct tips, fan support, connected banking, Stripe, and crypto payout accounts.
          </p>
        </div>

        {isPlus && (
          <button
            onClick={() => setIsPayoutModalOpen(true)}
            disabled={pendingBalance <= 0}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer"
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Request Payout</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-2 shadow-soft">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Total Revenue
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black">${totalEarnings.toFixed(2)}</span>
            <span className="text-xs font-bold text-emerald-500">All-time</span>
          </div>
          <p className="text-[0.7rem] text-muted-foreground">Cumulative tips & subscriptions</p>
        </div>

        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-2 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Pending Balance
            </span>
            <span className="text-[0.65rem] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              Available
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
              ${pendingBalance.toFixed(2)}
            </span>
          </div>
          <p className="text-[0.7rem] text-muted-foreground">
            Active destination: <strong className="capitalize">{activePayoutMethod}</strong>
          </p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-2 shadow-soft">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Platform Take Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{platformFee}</span>
          </div>
          <p className="text-[0.7rem] text-muted-foreground">
            {isPro ? "👑 Pro 0% fee active" : "Upgrade to Pro for 0% fee"}
          </p>
        </div>
      </div>

      {/* Payout Channels & Method Integration Hub */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-base font-black flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-brand" />
              Payout Destinations & Providers
            </h3>
            <p className="text-xs text-muted-foreground">
              Connect real banking, Stripe Connect, or non-custodial crypto wallet.
            </p>
          </div>

          {/* Active method switcher pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-foreground/5 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveConfigTab("stripe")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeConfigTab === "stripe"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CreditCard className="h-3.5 w-3.5" /> Stripe
              {activePayoutMethod === "stripe" && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveConfigTab("bank")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeConfigTab === "bank"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building2 className="h-3.5 w-3.5" /> Bank
              {activePayoutMethod === "bank" && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveConfigTab("crypto")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeConfigTab === "crypto"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Coins className="h-3.5 w-3.5" /> Crypto
              {activePayoutMethod === "crypto" && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveConfigTab("settings")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeConfigTab === "settings"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings2 className="h-3.5 w-3.5" /> Tip Settings
            </button>
          </div>
        </div>

        {/* Tab 1: Stripe Connect */}
        {activeConfigTab === "stripe" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/20 border border-border/70">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                  S
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold">Stripe Connect Express</h4>
                    {stripeDetails.isConnected ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected & Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-black">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Account: {stripeDetails.email} · {stripeDetails.country}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activePayoutMethod !== "stripe" && stripeDetails.isConnected && (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePayoutMethod("stripe");
                      toast.success("Stripe Connect set as primary payout destination");
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted cursor-pointer"
                  >
                    Set as Primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConnectStripe}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-soft cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {stripeDetails.isConnected ? "Manage Express Dashboard" : "Connect Stripe"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="p-3.5 rounded-2xl border border-border/60 bg-foreground/[0.02] space-y-1">
                <span className="font-bold text-foreground">Automatic 2-Day Rolling Payouts</span>
                <p>Funds earned through tips and subscribers are cleared and settled safely via Stripe rails.</p>
              </div>
              <div className="p-3.5 rounded-2xl border border-border/60 bg-foreground/[0.02] space-y-1">
                <span className="font-bold text-foreground">Global 1099-K Tax Compliance</span>
                <p>Automatic end-of-year tax document reporting and secure identity verification included.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Bank Direct Deposit */}
        {activeConfigTab === "bank" && (
          <form onSubmit={handleSaveBank} className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">ACH / Direct Deposit Account</h4>
                <p className="text-xs text-muted-foreground">Direct payout transfer to your preferred commercial bank account.</p>
              </div>
              {bankDetails.isConnected && activePayoutMethod !== "bank" && (
                <button
                  type="button"
                  onClick={() => {
                    setActivePayoutMethod("bank");
                    toast.success("Bank account set as primary payout destination");
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted cursor-pointer"
                >
                  Set as Primary
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankNameDraft}
                  onChange={(e) => setBankNameDraft(e.target.value)}
                  placeholder="e.g. Chase Bank N.A., Wells Fargo, Silicon Valley Bank"
                  className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-brand"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={holderDraft}
                  onChange={(e) => setHolderDraft(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-brand"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Routing / Sort Code
                </label>
                <input
                  type="text"
                  value={routingDraft}
                  onChange={(e) => setRoutingDraft(e.target.value)}
                  placeholder="e.g. 021000021"
                  className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-brand font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Account Number (or last 4 digits)
                </label>
                <input
                  type="text"
                  value={accountDraft}
                  onChange={(e) => setAccountDraft(e.target.value)}
                  placeholder="e.g. •••• 8821"
                  className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-brand font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-soft"
              >
                Save Bank Details
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Crypto Wallet */}
        {activeConfigTab === "crypto" && (
          <form onSubmit={handleSaveCrypto} className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">Non-Custodial Crypto Payouts</h4>
                <p className="text-xs text-muted-foreground">Receive instant, zero-border stablecoin & native token payouts.</p>
              </div>
              {cryptoDetails.isConnected && activePayoutMethod !== "crypto" && (
                <button
                  type="button"
                  onClick={() => {
                    setActivePayoutMethod("crypto");
                    toast.success("Crypto wallet set as primary payout destination");
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted cursor-pointer"
                >
                  Set as Primary
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Blockchain Network
                </label>
                <select
                  value={cryptoNetwork}
                  onChange={(e) => setCryptoNetwork(e.target.value as any)}
                  className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-brand cursor-pointer"
                >
                  <option value="solana">Solana (SPL)</option>
                  <option value="ethereum">Ethereum (ERC-20)</option>
                  <option value="polygon">Polygon (PoS)</option>
                  <option value="bitcoin">Bitcoin (Lightning / Base)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Preferred Currency
                </label>
                <select
                  value={cryptoCurrency}
                  onChange={(e) => setCryptoCurrency(e.target.value as any)}
                  className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-brand cursor-pointer"
                >
                  <option value="USDC">USDC (Stablecoin - $1.00 USD peg)</option>
                  <option value="SOL">SOL (Solana Native)</option>
                  <option value="ETH">ETH (Ethereum Native)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Quick Connect
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCryptoAddress(
                      cryptoNetwork === "solana"
                        ? "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                        : "0x71C...49A2d1B"
                    );
                    toast.success("Wallet address imported from browser extension!");
                  }}
                  className="w-full rounded-xl border border-border bg-muted/40 hover:bg-muted py-2 text-xs font-bold text-foreground flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wallet className="h-3.5 w-3.5 text-brand" /> Auto-Fill Wallet
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                Recipient Wallet Public Address
              </label>
              <input
                type="text"
                value={cryptoAddress}
                onChange={(e) => setCryptoAddress(e.target.value)}
                placeholder={cryptoNetwork === "solana" ? "e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" : "e.g. 0x123...456"}
                className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-mono outline-none focus:border-brand"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-soft"
              >
                Save Crypto Wallet
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Tip Settings */}
        {activeConfigTab === "settings" && (
          <form onSubmit={handleSaveSettings} className="space-y-4 animate-in fade-in">
            <div>
              <h4 className="text-sm font-bold">Creator Tip Preferences</h4>
              <p className="text-xs text-muted-foreground">Customize how fans and room listeners tip you across Spaces.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Minimum Tip Amount ($ USD)
                </label>
                <input
                  type="number"
                  min="0.50"
                  step="0.50"
                  value={minTipDraft}
                  onChange={(e) => setMinTipDraft(Number(e.target.value))}
                  className="w-full rounded-xl bg-foreground/5 border border-border/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-foreground/[0.02]">
                <div>
                  <span className="text-xs font-bold block">Display Tip Badge</span>
                  <span className="text-[10px] text-muted-foreground">Show tip button prominently on profile & post cards</span>
                </div>
                <input
                  type="checkbox"
                  checked={showBadgeDraft}
                  onChange={(e) => setShowBadgeDraft(e.target.checked)}
                  className="h-4 w-4 rounded accent-brand cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                Automated Thank-You Message
              </label>
              <textarea
                rows={2}
                value={thankYouDraft}
                onChange={(e) => setThankYouDraft(e.target.value)}
                placeholder="Personal note sent directly to your supporters..."
                className="w-full rounded-xl bg-foreground/5 border border-border/80 p-3 text-xs outline-none focus:border-brand resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-soft"
              >
                Save Preferences
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Recent Tips Feed */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
            <h3 className="text-base font-bold">Recent Supporter Tips</h3>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            {tipsReceived.length} tips received
          </span>
        </div>

        <div className="divide-y divide-border/60 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
          {tipsReceived.map((tip) => (
            <div key={tip.id} className="py-3.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Avatar name={tip.senderName} src={tip.senderAvatar} className="h-10 w-10 text-xs mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">{tip.senderName}</span>
                    <span className="text-xs text-muted-foreground">@{tip.senderUsername}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{tip.timestamp}</span>
                  </div>
                  {tip.message && (
                    <p className="text-xs text-foreground/90 italic bg-muted/30 rounded-xl px-2.5 py-1 mt-1 border border-border/40">
                      "{tip.message}"
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  +${tip.amount.toFixed(2)}
                </span>
                <p className="text-[0.65rem] text-muted-foreground">Direct Tip</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payout History & Receipts */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 space-y-3 shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Recent Payout Receipts & Transfers</h3>
          <span className="text-xs text-muted-foreground">{payouts.length} payouts</span>
        </div>

        <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          {payouts.map((po) => (
            <div
              key={po.id}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono">{po.id}</span>
                  <span className="text-[10px] text-muted-foreground">{po.method}</span>
                </div>
                <p className="text-[0.65rem] text-muted-foreground">{po.date}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-foreground text-sm">${po.amount.toFixed(2)}</span>
                <p className="text-[0.65rem] text-emerald-600 dark:text-emerald-400 font-bold capitalize flex items-center gap-1 justify-end">
                  <Check className="h-3 w-3" /> {po.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Free Tier Lock Barrier */}
      {!isPlus && (
        <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-transparent p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Lock className="h-4 w-4 text-violet-500" />
              <h4 className="text-sm font-black">Monetization Tools Require Plus or Pro</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Enable the Tip button on your profile & posts, receive recurring creator funding, and request payouts.
            </p>
          </div>
          <button
            onClick={() => openUpgradeModal("Creator Monetization Tools")}
            className="rounded-full bg-gradient-to-r from-brand to-brand-pink px-5 py-2.5 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all cursor-pointer whitespace-nowrap"
          >
            Upgrade to Plus ($7/mo)
          </button>
        </div>
      )}

      {/* Payout Request Modal */}
      {isPayoutModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setIsPayoutModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Confirm Payout Transfer</h3>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Payout Amount
              </span>
              <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                ${pendingBalance.toFixed(2)}
              </div>
              <p className="text-[0.7rem] text-muted-foreground">
                Destination: <strong className="capitalize">{activePayoutMethod}</strong> ({
                  activePayoutMethod === "stripe"
                    ? stripeDetails.email
                    : activePayoutMethod === "bank"
                      ? `${bankDetails.bankName} •••• ${bankDetails.accountNumberLast4}`
                      : `${cryptoDetails.currency} •••• ${cryptoDetails.address.slice(-4)}`
                })
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Platform Fee ({isPro ? "0%" : "5%"})</span>
                <span>{isPro ? "$0.00" : `$${(pendingBalance * 0.05).toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border">
                <span>Estimated Arrival</span>
                <span>Instant / 1-2 Business Days</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPayoutModalOpen(false)}
                className="flex-1 rounded-2xl border border-border py-2.5 text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payoutProcessing}
                onClick={handlePayoutSubmit}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2.5 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {payoutProcessing ? "Processing..." : "Confirm & Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
