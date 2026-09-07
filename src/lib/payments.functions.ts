/**
 * Real checkout through Paystack. Credentials come from the environment so the
 * app is not tied to any single host:
 *   PAYSTACK_SECRET_KEY   (server, required)
 *   PAYSTACK_CURRENCY     (optional, default USD)
 *   PAYSTACK_WEBHOOK_PATH is fixed at /api/public/paystack-webhook
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_DETAILS, type BillingCycle, type PlanTier } from "@/lib/plans";

const PAID_PLANS: PlanTier[] = ["plus", "pro"];

function amountFor(plan: PlanTier, cycle: BillingCycle) {
  const details = PLAN_DETAILS[plan];
  const usd = cycle === "annual" ? details.annualBilledTotal : details.priceMonthly;
  return Math.round(usd * 100); // smallest currency unit
}

async function paystack(path: string, init?: RequestInit) {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured on this deployment");
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || body?.status === false) {
    console.error("Paystack error", res.status, JSON.stringify(body).slice(0, 500));
    throw new Error(body?.message || "Payment provider request failed");
  }
  return body;
}

async function profileOf(supabase: any, authUserId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, plan")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!data) throw new Error("Profile not found");
  return data as { id: string; plan: PlanTier };
}

/** Creates a Paystack transaction and returns the hosted checkout URL. */
export const startCheckoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: PlanTier; cycle: BillingCycle }) => {
    if (!PAID_PLANS.includes(input.plan)) throw new Error("Unknown plan");
    return {
      plan: input.plan,
      cycle: (input.cycle === "annual" ? "annual" : "monthly") as BillingCycle,
    };
  })
  .handler(async ({ data, context }) => {
    const profile = await profileOf(context.supabase, context.userId);
    const email = (context.claims as any)?.email;
    if (!email) throw new Error("Your account needs an email address to check out");

    const origin = new URL(getRequest().url).origin;
    const body = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: amountFor(data.plan, data.cycle),
        currency: process.env["PAYSTACK_CURRENCY"] ?? "USD",
        callback_url: `${origin}/pricing?checkout=paystack`,
        metadata: {
          profile_id: profile.id,
          plan: data.plan,
          billing_cycle: data.cycle,
        },
      }),
    });

    return {
      checkoutUrl: String(body.data.authorization_url),
      reference: String(body.data.reference),
    };
  });

/** Verifies a completed transaction and activates the plan for the caller. */
export const verifyCheckoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({
    reference: String(input.reference ?? "").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const profile = await profileOf(context.supabase, context.userId);
    const body = await paystack(`/transaction/verify/${encodeURIComponent(data.reference)}`);
    const tx = body.data ?? {};
    if (tx.status !== "success") return { activated: false, status: String(tx.status ?? "pending") };
    if (tx.metadata?.profile_id && tx.metadata.profile_id !== profile.id) {
      throw new Error("This payment belongs to another account");
    }

    const plan = (PAID_PLANS.includes(tx.metadata?.plan) ? tx.metadata.plan : "plus") as PlanTier;
    const cycle = (tx.metadata?.billing_cycle === "annual" ? "annual" : "monthly") as BillingCycle;
    await activatePlan(profile.id, plan, cycle, data.reference, tx.authorization ?? null);
    return { activated: true, status: "success", plan, cycle };
  });

/** Shared by the verify call and the webhook: writes the subscription + badge. */
export async function activatePlan(
  profileId: string,
  plan: PlanTier,
  cycle: BillingCycle,
  reference: string,
  authorization: any,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const renews = new Date();
  if (cycle === "annual") renews.setFullYear(renews.getFullYear() + 1);
  else renews.setMonth(renews.getMonth() + 1);

  await supabaseAdmin.from("subscriptions").upsert({
    user_id: profileId,
    plan,
    billing_cycle: cycle,
    status: "active",
    renews_at: renews.toISOString(),
    provider: "paystack",
    provider_subscription_id: reference,
    payment_method: authorization
      ? {
          brand: authorization.card_type ?? authorization.channel ?? "card",
          last4: authorization.last4 ?? "",
          exp: [authorization.exp_month, authorization.exp_year].filter(Boolean).join("/"),
        }
      : {},
  });
  await supabaseAdmin.from("profiles").update({ plan }).eq("id", profileId);
}
