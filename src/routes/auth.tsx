import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Join — Spaces" },
      {
        name: "description",
        content:
          "Create your Spaces account or sign back in to post, join live audio rooms, message creators and tip the people you follow.",
      },
      { property: "og:title", content: "Sign In or Join — Spaces" },
      { property: "og:description", content: "Create a Spaces account or sign in to post, chat and go live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function ensureProfile(authUserId: string, fallbackEmail: string) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (existing) return;

    const handle = (fallbackEmail.split("@")[0] || "member").replace(/[^a-z0-9_]/gi, "").toLowerCase();
    await supabase.from("profiles").insert({
      auth_user_id: authUserId,
      username: `${handle}${Math.floor(Math.random() * 9000 + 1000)}`,
      display_name: displayName.trim() || handle,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (data.user) await ensureProfile(data.user.id, email);
        toast.success("Account created — welcome to Spaces!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await ensureProfile(data.user.id, email);
        toast.success("Signed in");
      }
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-pink text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <h1 className="text-xl font-black">{mode === "signin" ? "Welcome back" : "Join Spaces"}</h1>
        </div>

        <div className="mb-5 flex rounded-2xl bg-muted/40 p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                mode === m ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
              )}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-2xl bg-foreground/5 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl bg-foreground/5 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl bg-foreground/5 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-pink py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
