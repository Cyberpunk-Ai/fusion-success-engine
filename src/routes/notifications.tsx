import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Heart,
  UserPlus,
  MessageCircle,
  Repeat2,
  AtSign,
  Radio,
  DollarSign,
  CheckCheck,
  BellOff,
  Loader2,
} from "lucide-react";
import { AppShell, PageHeader, Panel } from "@/components/social/AppShell";
import { Avatar } from "@/components/social/Avatar";
import { TimeAgo } from "@/components/social/TimeAgo";
import { DefaultRail } from "@/components/social/RightRail";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/lib/types";

function NotificationsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="glass-panel flex items-start gap-4 rounded-3xl p-4.5 shadow-soft">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4.5 w-44 rounded-md" />
              <Skeleton className="h-3 w-14 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
import { getProfile } from "@/lib/profile-service";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api-client";
import { clearAllUnreadNotifications, decrementUnreadNotifications } from "@/lib/unread-state";
import { useRealtime } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Spaces" },
      {
        name: "description",
        content:
          "Every like, follow, mention, live Space invite, and tip in one clean timeline. Stay close to your Spaces community without the noise.",
      },
      { property: "og:title", content: "Notifications — Spaces" },
      {
        property: "og:description",
        content: "Likes, follows, mentions, Space invites, and tips — all in one calm timeline.",
      },
    ],
  }),
  component: NotificationsPage,
});

const meta: Record<Notification["type"], { icon: typeof Heart; tint: string }> = {
  like: { icon: Heart, tint: "from-rose-500 to-pink-500" },
  follow: { icon: UserPlus, tint: "from-violet-500 to-fuchsia-500" },
  comment: { icon: MessageCircle, tint: "from-sky-500 to-cyan-500" },
  reply: { icon: MessageCircle, tint: "from-blue-500 to-indigo-500" },
  repost: { icon: Repeat2, tint: "from-emerald-500 to-teal-500" },
  mention: { icon: AtSign, tint: "from-amber-500 to-orange-500" },
  space: { icon: Radio, tint: "from-indigo-500 to-violet-500" },
  tip: { icon: DollarSign, tint: "from-amber-500 to-orange-500" },
};

const filters = ["All", "Mentions", "Follows", "Likes", "Tips", "Spaces"] as const;

function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getNotifications()
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Realtime hook for incoming notifications
  useRealtime(
    (event) => {
      const notif = event.notification || (event.type === "notification" ? (event.data || (event.id ? event : null)) : null);
      if (notif && notif.id) {
        setItems((prev) => {
          if (prev.some((n) => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });
        if (notif.body) toast.info(notif.body);
      }
    },
    ["notification", "like", "repost", "follow", "space_tip"]
  );

  async function handleMarkAllRead() {
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    clearAllUnreadNotifications();
    toast.success("All notifications marked as read");
    try {
      await markAllNotificationsRead();
    } catch {}
  }

  async function handleMarkRead(id: string) {
    const item = items.find((x) => x.id === id);
    if (item && !item.read) {
      decrementUnreadNotifications(1);
    }
    setItems((p) => p.map((x) => (x.id === id ? { ...x, read: true } : x)));
    try {
      await markNotificationRead(id);
    } catch {}
  }

  const visible = items.filter((n) => {
    if (filter === "All") return true;
    if (filter === "Mentions") return n.type === "mention" || n.type === "comment";
    if (filter === "Follows") return n.type === "follow";
    if (filter === "Likes") return n.type === "like" || n.type === "repost";
    if (filter === "Tips") return n.type === "tip";
    if (filter === "Spaces") return n.type === "space";
    return true;
  });

  const unread = items.filter((n) => !n.read).length;

  return (
    <AppShell title="Notifications" right={<DefaultRail />}>
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          title="Notifications"
          subtitle={unread ? `${unread} new since your last visit` : "You're all caught up"}
          action={
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground/5 active:scale-95 cursor-pointer"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          }
        />

        <div className="glass-panel flex items-center gap-1 rounded-full p-1.5 shadow-soft overflow-x-auto [scrollbar-width:none]">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 rounded-full px-3.5 py-2 text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap cursor-pointer",
                filter === f
                  ? "bg-gradient-to-r from-brand to-brand-pink text-white shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <NotificationsSkeleton />
        ) : (
          <div className="space-y-3">
            {visible.map((n, i) => {
              const actor = getProfile(n.actor_id);
              const { icon: Icon, tint } = meta[n.type] || meta.like;
              return (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  style={{ animationDelay: `${i * 45}ms` }}
                  className={cn(
                    "glass-panel flex w-full animate-in items-start gap-3 rounded-3xl p-4 text-left shadow-soft transition-all duration-300 fade-in slide-in-from-bottom-3 hover:-translate-y-0.5 hover:shadow-lift cursor-pointer",
                    !n.read && "ring-1 ring-brand/25 bg-brand/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white",
                      tint,
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Avatar
                        name={actor.display_name}
                        src={actor.avatar_url}
                        className="h-6 w-6 text-[0.6rem]"
                      />
                      <span className="truncate text-sm font-bold">{actor.display_name}</span>
                      <TimeAgo
                        iso={n.created_at}
                        className="shrink-0 text-xs text-muted-foreground"
                      />
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{n.body}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </button>
              );
            })}

            {visible.length === 0 && (
              <Panel className="flex flex-col items-center gap-3 py-12 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground" />
                <p className="font-bold">Nothing here yet</p>
                <p className="text-sm text-muted-foreground">
                  New {filter.toLowerCase()} will show up in this tab.
                </p>
              </Panel>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
