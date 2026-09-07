/**
 * Real AI generation (post drafts, story captions, room summaries) with
 * server-side daily usage limits enforced against the subscriptions table.
 *
 * The provider is swappable: set AI_GATEWAY_URL / AI_MODEL / AI_API_KEY_NAME
 * to point at any OpenAI-compatible endpoint. Defaults to the built-in gateway.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_DETAILS, type PlanTier } from "@/lib/plans";

type Json = Record<string, unknown>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function chat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const baseUrl = process.env["AI_GATEWAY_URL"] ?? "https://ai.gateway.lovable.dev/v1";
  const model = process.env["AI_MODEL"] ?? "openai/gpt-5.6-sol";
  const apiKey = process.env["AI_API_KEY"] ?? process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured on this deployment");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("AI provider error", res.status, detail.slice(0, 500));
    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment");
    throw new Error("AI request failed");
  }
  const data = (await res.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) throw new Error("AI returned an empty response");
  return text;
}

function parseJson<T extends Json>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    return { ...fallback, ...(JSON.parse(cleaned.slice(start, end + 1)) as T) };
  } catch {
    return fallback;
  }
}

/** Reads the caller's profile + plan, enforces the daily cap, records usage. */
async function consumeQuota(supabase: any, authUserId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, plan")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!profile) throw new Error("Profile not found");

  const plan = ((profile.plan as PlanTier) || "free") as PlanTier;
  const limit = (PLAN_DETAILS[plan] ?? PLAN_DETAILS.free).limits.aiDraftsPerDay;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("ai_drafts_used, ai_usage_date")
    .eq("user_id", profile.id)
    .maybeSingle();

  const sameDay = sub?.ai_usage_date === today();
  const used = sameDay ? Number(sub?.ai_drafts_used ?? 0) : 0;
  if (used >= limit) {
    throw new Error(`Daily AI limit reached (${limit}). Upgrade your plan for more.`);
  }

  await supabase.from("subscriptions").upsert({
    user_id: profile.id,
    plan,
    ai_drafts_used: used + 1,
    ai_usage_date: today(),
  });

  return { used: used + 1, limit };
}

const draftInput = (input: { prompt: string; currentDraft?: string }) => ({
  prompt: String(input.prompt ?? "").slice(0, 500),
  currentDraft: input.currentDraft ? String(input.currentDraft).slice(0, 1000) : undefined,
});

export const generatePostDraftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(draftInput)
  .handler(async ({ data, context }) => {
    const quota = await consumeQuota(context.supabase, context.userId);
    const raw = await chat([
      {
        role: "system",
        content:
          "You write short, high-engagement social posts. Reply ONLY with JSON: " +
          '{"content": string (max 280 chars, no hashtags inside), "suggestedTags": string[] (max 3, lowercase, no #)}.',
      },
      {
        role: "user",
        content: data.currentDraft
          ? `Improve this draft about "${data.prompt}":\n\n${data.currentDraft}`
          : `Write a post about: ${data.prompt}`,
      },
    ]);
    const parsed = parseJson(raw, { content: raw.trim(), suggestedTags: [] as string[] });
    return {
      content: String(parsed.content ?? "").slice(0, 500),
      suggestedTags: (Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [])
        .map((t) => String(t).replace(/^#/, "").toLowerCase())
        .slice(0, 3),
      usage: quota,
    };
  });

export const generateStoryCaptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) => ({ prompt: String(input.prompt ?? "").slice(0, 300) }))
  .handler(async ({ data, context }) => {
    const quota = await consumeQuota(context.supabase, context.userId);
    const raw = await chat([
      {
        role: "system",
        content:
          "You write punchy story captions. Reply ONLY with JSON: " +
          '{"text": string (max 120 chars), "mood": string (one word), "suggestedStickers": string[] (3 emoji)}.',
      },
      { role: "user", content: `Caption for a story about: ${data.prompt}` },
    ]);
    const parsed = parseJson(raw, {
      text: raw.trim().slice(0, 120),
      mood: "inspired",
      suggestedStickers: ["✨", "🔥", "💫"] as string[],
    });
    return {
      text: String(parsed.text ?? "").slice(0, 220),
      mood: String(parsed.mood ?? "inspired"),
      suggestedStickers: (Array.isArray(parsed.suggestedStickers) ? parsed.suggestedStickers : []).slice(0, 3),
      usage: quota,
    };
  });

export const summarizeRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; topic: string; messages: string[] }) => ({
    title: String(input.title ?? "").slice(0, 200),
    topic: String(input.topic ?? "").slice(0, 200),
    messages: (Array.isArray(input.messages) ? input.messages : []).slice(-60).map((m) => String(m).slice(0, 400)),
  }))
  .handler(async ({ data, context }) => {
    const quota = await consumeQuota(context.supabase, context.userId);
    const raw = await chat([
      {
        role: "system",
        content:
          "You summarize live audio rooms for attendees. Reply ONLY with JSON: " +
          '{"summary": string (2-3 sentences), "keyTakeaways": string[] (3-5 short bullets)}.',
      },
      {
        role: "user",
        content: `Room title: ${data.title}\nTopic: ${data.topic}\nTranscript/chat:\n${data.messages.join("\n") || "(no messages yet)"}`,
      },
    ]);
    const parsed = parseJson(raw, { summary: raw.trim(), keyTakeaways: [] as string[] });
    return {
      summary: String(parsed.summary ?? ""),
      keyTakeaways: (Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : []).map(String).slice(0, 5),
      usage: quota,
    };
  });
