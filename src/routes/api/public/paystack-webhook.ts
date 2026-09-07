import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

import { activatePlan } from "@/lib/payments.functions";
import type { BillingCycle, PlanTier } from "@/lib/plans";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        if (event?.event === "charge.success") {
          const meta = event.data?.metadata ?? {};
          const plan = (meta.plan === "pro" ? "pro" : "plus") as PlanTier;
          const cycle = (meta.billing_cycle === "annual" ? "annual" : "monthly") as BillingCycle;
          if (meta.profile_id) {
            await activatePlan(
              String(meta.profile_id),
              plan,
              cycle,
              String(event.data?.reference ?? ""),
              event.data?.authorization ?? null,
            );
          }
        }

        return new Response("ok");
      },
    },
  },
});
