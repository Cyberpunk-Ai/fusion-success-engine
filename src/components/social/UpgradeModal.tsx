import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Crown,
  Check,
  CreditCard,
  Zap,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { type PlanTier, type BillingCycle, PLAN_DETAILS } from "@/lib/plans";
import { usePlan } from "@/lib/plan-state";
import { useAuth } from "@/lib/auth-state";
import { cn } from "@/lib/utils";

export function UpgradeModal() {
  const { currentPlan, cycle: defaultCycle, upgradePlan } = usePlan();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [featureHint, setFeatureHint] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"plus" | "pro">("plus");
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Mock checkout card state (clean placeholders instead of hardcoded dummy card)
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    expiry: "",
    cvc: "",
    name: "",
  });

  // Sync user display name as default cardholder name when loaded
  useEffect(() => {
    if (user && !cardForm.name) {
      setCardForm((prev) => ({ ...prev, name: user.display_name }));
    }
  }, [user]);

  useEffect(() => {
    const handleOpen = (e: any) => {
      const hint = e.detail?.featureHint || null;
      setFeatureHint(hint);
      if (
        hint?.toLowerCase().includes("pro") ||
        hint?.toLowerCase().includes("team") ||
        hint?.toLowerCase().includes("api")
      ) {
        setSelectedPlan("pro");
      } else {
        setSelectedPlan("plus");
      }
      setIsSuccess(false);
      setIsOpen(true);
    };

    window.addEventListener("spaces:open-upgrade-modal", handleOpen);
    window.addEventListener("spaces:open-upgrade-modal", handleOpen);
    return () => {
      window.removeEventListener("spaces:open-upgrade-modal", handleOpen);
      window.removeEventListener("spaces:open-upgrade-modal", handleOpen);
    };
  }, []);

  if (!isOpen) return null;

  const targetPlanDetails = PLAN_DETAILS[selectedPlan];
  const basePrice = cycle === "annual" ? targetPlanDetails.priceAnnual : targetPlanDetails.priceMonthly;
  const rawTotal = cycle === "annual" ? targetPlanDetails.annualBilledTotal : targetPlanDetails.priceMonthly;
  const discountMultiplier = appliedDiscount ? (100 - appliedDiscount) / 100 : 1;
  const finalTotal = (rawTotal * discountMultiplier).toFixed(2);

  const handleApplyPromo = () => {
    setPromoError(null);
    const code = promoCode.trim().toUpperCase();
    if (code === "CREATOR50" || code === "SPACES50" || code === "LUMEN50") {
      setAppliedDiscount(50);
    } else if (code === "VIP" || code === "EARLYACCESS") {
      setAppliedDiscount(30);
    } else {
      setPromoError("Invalid code. Try 'CREATOR50' for 50% off");
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      await upgradePlan(selectedPlan, cycle, {
        brand: "Visa",
        last4: "4242",
        exp: cardForm.expiry,
      });
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
      }, 1800);
    } catch {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-background shadow-2xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Top Gradient Bar */}
        <div
          className={cn(
            "h-2 w-full bg-gradient-to-r transition-all duration-500",
            selectedPlan === "pro"
              ? "from-amber-400 via-orange-500 to-amber-500"
              : "from-brand via-brand-pink to-purple-600",
          )}
        />

        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground hover:bg-foreground/15 hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full shadow-glow animate-bounce",
                selectedPlan === "pro"
                  ? "bg-gradient-to-tr from-amber-500 to-orange-400 text-white"
                  : "bg-gradient-to-tr from-brand to-brand-pink text-white",
              )}
            >
              {selectedPlan === "pro" ? <Crown className="h-10 w-10" /> : <Sparkles className="h-10 w-10" />}
            </div>
            <h3 className="mt-6 text-2xl font-black">
              Welcome to Spaces {targetPlanDetails.name}!
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Your account has been upgraded. The {targetPlanDetails.badge} badge and full plan capabilities are now active immediately across the platform.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-500">
              <Check className="h-4 w-4" /> Subscription Active & Verified
            </div>
          </div>
        ) : (
          <div className="max-h-[90vh] overflow-y-auto p-6 md:p-8">
            {/* Header */}
            <div className="text-center">
              {featureHint ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3.5 py-1 text-xs font-bold text-violet-700 dark:text-violet-300 mb-3 border border-brand/20">
                  <Zap className="h-3.5 w-3.5 text-brand" /> {featureHint}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand/15 to-brand-pink/15 px-3.5 py-1 text-xs font-bold text-violet-700 dark:text-violet-300 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-brand" /> Unlock Clean Creator Power
                </div>
              )}
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                Upgrade your Spaces Experience
              </h2>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                Unlock authenticity badges, high-capacity Spaces, and monetization.
              </p>
            </div>

            {/* Plan Selector Switcher */}
            <div className="mt-6 grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-foreground/5 border border-border/50">
              <button
                type="button"
                onClick={() => setSelectedPlan("plus")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all",
                  selectedPlan === "plus"
                    ? "bg-background text-foreground shadow-md ring-1 ring-brand/30"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles className="h-4 w-4 text-brand" />
                <span>Plus Plan</span>
                <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[0.65rem] font-extrabold text-brand">
                  $7/mo
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan("pro")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all",
                  selectedPlan === "pro"
                    ? "bg-background text-amber-500 shadow-md ring-1 ring-amber-500/40"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Crown className="h-4 w-4 text-amber-500" />
                <span>Pro Plan</span>
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[0.65rem] font-black text-amber-500">
                  $23/mo
                </span>
              </button>
            </div>

            {/* Billing Interval Toggle */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className={cn("text-xs font-semibold", cycle === "monthly" ? "text-foreground" : "text-muted-foreground")}>
                Monthly
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={cycle === "annual"}
                onClick={() => setCycle(cycle === "annual" ? "monthly" : "annual")}
                className="relative h-6 w-12 rounded-full bg-foreground/15 p-0.5 transition-colors focus:outline-none"
              >
                <span
                  className={cn(
                    "block h-5 w-5 rounded-full bg-gradient-to-r from-brand to-brand-pink shadow transition-transform",
                    cycle === "annual" ? "translate-x-6" : "translate-x-0",
                  )}
                />
              </button>
              <span className={cn("text-xs font-semibold flex items-center gap-1.5", cycle === "annual" ? "text-foreground font-bold" : "text-muted-foreground")}>
                <span>Annual Billing</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-extrabold text-emerald-500 border border-emerald-500/20">
                  Save 20%
                </span>
              </span>
            </div>

            {/* Perks List */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-foreground/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Included in {targetPlanDetails.name}
                </span>
                <span className={cn("text-xs font-extrabold px-2 py-0.5 rounded-full", targetPlanDetails.badgeColor)}>
                  {targetPlanDetails.badge}
                </span>
              </div>
              <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {targetPlanDetails.keyPerks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground/90 font-medium">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Checkout Form */}
            <form onSubmit={handleCheckout} className="mt-6 space-y-4">
              {/* Promo Code Row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Promo code (e.g. CREATOR50)"
                    className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-xs uppercase placeholder:normal-case focus:border-brand focus:outline-none"
                  />
                  {appliedDiscount && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[0.65rem] font-extrabold text-emerald-500">
                      {appliedDiscount}% OFF Applied
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold hover:bg-foreground/5 transition-colors"
                >
                  Apply
                </button>
              </div>
              {promoError && <p className="text-[0.7rem] text-rose-500">{promoError}</p>}

              {/* Payment Details Input */}
              <div className="rounded-2xl border border-border/60 p-3.5 space-y-3 bg-background">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <CreditCard className="h-4 w-4 text-brand" /> Payment Method
                  </span>
                  <span className="flex items-center gap-1 text-[0.7rem]">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> 256-bit Encrypted
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <label className="text-[0.65rem] text-muted-foreground uppercase font-bold tracking-wider">Card Number</label>
                    <input
                      type="text"
                      required
                      placeholder="4242 4242 4242 4242"
                      value={cardForm.cardNumber}
                      onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-mono focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[0.65rem] text-muted-foreground uppercase font-bold tracking-wider">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      placeholder={user?.display_name || "Jane Doe"}
                      value={cardForm.name}
                      onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-xs focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[0.65rem] text-muted-foreground uppercase font-bold tracking-wider">Expiration Date</label>
                    <input
                      type="text"
                      required
                      value={cardForm.expiry}
                      onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-mono focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none placeholder:text-muted-foreground/60"
                      placeholder="MM/YY"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[0.65rem] text-muted-foreground uppercase font-bold tracking-wider">CVC</label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={cardForm.cvc}
                      onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-center font-mono focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none placeholder:text-muted-foreground/60"
                      placeholder="123"
                    />
                  </div>
                </div>
              </div>

              {/* Price & Summary */}
              <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black">${finalTotal}</span>
                    <span className="text-xs text-muted-foreground">
                      /{cycle === "annual" ? "year" : "month"}
                    </span>
                  </div>
                  <p className="text-[0.68rem] text-muted-foreground">
                    {cycle === "annual"
                      ? `Equivalent to $${basePrice}/month. Billed annually.`
                      : "Billed monthly, cancel anytime."}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-extrabold text-white shadow-soft transition-all duration-300 hover:shadow-glow hover:brightness-105 active:scale-[0.98] disabled:opacity-50",
                    selectedPlan === "pro"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500"
                      : "bg-gradient-to-r from-brand to-brand-pink",
                  )}
                >
                  {isProcessing ? (
                    <span>Activating Plan...</span>
                  ) : (
                    <>
                      <span>Upgrade to {targetPlanDetails.name}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
