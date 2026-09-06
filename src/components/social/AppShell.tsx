import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import {
  Home,
  Compass,
  Radio,
  MessagesSquare,
  Bell,
  Bookmark,
  User,
  Settings,
  Feather,
  Search,
  Sparkles,
  Zap,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { Avatar } from "@/components/social/Avatar";
import { UserBadge } from "@/components/social/UserBadge";
import { AnnouncementBanner } from "@/components/social/AnnouncementBanner";
import { currentUser } from "@/lib/profile-service";
import { useAuth } from "@/lib/auth-state";
import { usePlan, openUpgradeModal } from "@/lib/plan-state";
import { PLAN_DETAILS } from "@/lib/plans";
import { useUnreadCounts } from "@/lib/unread-state";
import { useTheme } from "@/lib/theme-state";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  to: string;
  icon: typeof Home;
  badge?: string | number | null;
};

function NavLink({ item, onClick }: { item: NavItem; onClick?: (() => void) | undefined }) {
  const { pathname } = useLocation();
  const active = pathname === item.to;
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[0.95rem] font-semibold transition-all duration-300",
        active
          ? "bg-gradient-to-r from-brand/12 to-brand-pink/12 text-brand"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand to-brand-pink transition-all duration-300",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        className={cn(
          "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
          active && "text-brand",
        )}
      />
      <span>{item.label}</span>
      {item.badge ? (
        <span className="ml-auto rounded-full bg-gradient-to-r from-brand to-brand-pink px-2 py-0.5 text-[0.65rem] font-bold text-white shadow-xs">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function Sidebar({
  onNavigate,
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  onNavigate?: () => void;
  unreadMessages?: number;
  unreadNotifications?: number;
}) {
  const { currentPlan, isPlus, isPro } = usePlan();
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const planInfo = PLAN_DETAILS[currentPlan] || PLAN_DETAILS.free;
  const activeUser = user || currentUser;

  const navItems: NavItem[] = [
    { label: "Home", to: "/feed", icon: Home },
    { label: "Explore", to: "/explore", icon: Compass },
    { label: "Spaces", to: "/spaces", icon: Radio },
    {
      label: "Messages",
      to: "/messages",
      icon: MessagesSquare,
      badge: unreadMessages > 0 ? (unreadMessages > 9 ? "9+" : unreadMessages) : null,
    },
    {
      label: "Notifications",
      to: "/notifications",
      icon: Bell,
      badge: unreadNotifications > 0 ? (unreadNotifications > 9 ? "9+" : unreadNotifications) : null,
    },
    { label: "Bookmarks", to: "/bookmarks", icon: Bookmark },
    { label: "Plans & Perks", to: "/pricing", icon: Zap },
    { label: "Profile", to: "/profile", icon: User },
    { label: "Settings", to: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="mb-4 flex items-center justify-between px-2 py-2">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-pink">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">Spaces</span>
        </Link>
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle theme"
          className="rounded-xl p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
        >
          {isDark ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5" />}
        </button>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.to} item={item} onClick={onNavigate} />
        ))}
      </nav>

      <Link
        to="/feed"
        search={{ compose: "true" }}
        onClick={() => {
          onNavigate?.();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("spaces:trigger_compose"));
          }
        }}
        className="mt-4 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-pink px-6 py-3 font-bold text-white shadow-soft transition-all duration-300 hover:shadow-glow hover:brightness-105 active:scale-[0.98]"
      >
        <Feather className="h-4 w-4" /> Compose
      </Link>

      {/* Upgrade Callout Card for Free Users */}
      {currentPlan === "free" ? (
        <div className="mt-4 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/10 via-brand-pink/5 to-purple-600/10 p-3.5 text-xs shadow-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-brand">
            <Sparkles className="h-4 w-4" /> Upgrade to Plus
          </div>
          <p className="mt-1 text-[0.72rem] text-muted-foreground leading-snug">
            Unlock 100 AI drafts/day, 250-listener Spaces & ✨ verified creator badge.
          </p>
          <button
            onClick={() => openUpgradeModal("Sidebar Upgrade")}
            className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-brand to-brand-pink py-1.5 text-center font-extrabold text-white shadow-xs hover:brightness-105 transition-all text-[0.72rem]"
          >
            Upgrade for $7/mo
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border/60 bg-foreground/[0.02] p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
              Active Tier
            </span>
            <span className={cn("text-[0.65rem] font-black px-2 py-0.5 rounded-full", planInfo.badgeColor)}>
              {planInfo.badge || "Free"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[0.72rem]">
            <span className="text-muted-foreground">{isPro ? "Studio Audio & Teams" : "HD Audio & AI Perks"}</span>
            <Link to="/pricing" className="font-bold text-brand hover:underline">
              Perks
            </Link>
          </div>
        </div>
      )}

      <div className="mt-auto pt-4">
        <Link
          to="/profile"
          onClick={onNavigate}
          className="glass-panel flex items-center gap-3 rounded-2xl p-3 transition-all duration-300 hover:shadow-soft hover:bg-foreground/5"
        >
          <Avatar
            name={activeUser.display_name}
            src={activeUser.avatar_url}
            className={cn(
              "h-10 w-10 text-xs",
              isPro ? "ring-2 ring-amber-400" : isPlus ? "ring-2 ring-violet-500" : "ring-1 ring-border",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold">{activeUser.display_name}</p>
              <UserBadge isMe verified={activeUser.verified} size="xs" />
            </div>
            <p className="truncate text-xs text-muted-foreground">@{activeUser.username}</p>
          </div>
        </Link>
        {user ? (
          <button
            onClick={() => {
              void signOut();
              onNavigate?.();
            }}
            className="mt-2 w-full rounded-2xl border border-border/70 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/auth"
            onClick={onNavigate}
            className="mt-2 block rounded-2xl border border-brand/40 py-2 text-center text-xs font-bold text-brand transition-colors hover:bg-brand/10"
          >
            Sign in or join
          </Link>
        )}
      </div>

    </div>
  );
}

export function AppShell({
  children,
  right,
  title,
}: {
  children: ReactNode;
  right?: ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const { notifications: unreadNotifications, messages: unreadMessages } = useUnreadCounts();
  const { isDark, toggleTheme } = useTheme();

  const mobileItems: NavItem[] = [
    { label: "Home", to: "/feed", icon: Home },
    { label: "Explore", to: "/explore", icon: Compass },
    { label: "Spaces", to: "/spaces", icon: Radio },
    {
      label: "Messages",
      to: "/messages",
      icon: MessagesSquare,
      badge: unreadMessages > 0 ? (unreadMessages > 9 ? "9+" : unreadMessages) : null,
    },
    {
      label: "Alerts",
      to: "/notifications",
      icon: Bell,
      badge: unreadNotifications > 0 ? (unreadNotifications > 9 ? "9+" : unreadNotifications) : null,
    },
    { label: "Profile", to: "/profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-25 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-[24rem] w-[24rem] rounded-full bg-violet-400/30 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-[20rem] w-[20rem] rounded-full bg-pink-400/30 blur-[100px]" />
      </div>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-card/90 backdrop-blur-md border-b border-border/80 lg:hidden shadow-xs">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-xl p-2 text-foreground transition-colors hover:bg-foreground/5 cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-lg font-extrabold tracking-tight">Spaces</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-xl p-2 hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link to="/explore" aria-label="Search" className="rounded-xl p-2 hover:bg-foreground/5 cursor-pointer">
            <Search className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-all duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-[18rem] max-w-[85vw] bg-card border-r border-border/80 rounded-r-3xl p-5 shadow-2xl transition-transform duration-300 ease-out overflow-y-auto custom-scrollbar",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="absolute right-4 top-4 rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <Sidebar
            onNavigate={() => setOpen(false)}
            unreadMessages={unreadMessages}
            unreadNotifications={unreadNotifications}
          />
        </aside>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[90rem] gap-6 px-3 sm:px-4 pb-20 lg:px-6 lg:pb-0 lg:h-screen lg:overflow-hidden">
        <aside className="hidden h-screen w-[17rem] shrink-0 overflow-y-auto custom-scrollbar py-6 lg:block">
          <Sidebar
            unreadMessages={unreadMessages}
            unreadNotifications={unreadNotifications}
          />
        </aside>

        <main className="min-w-0 flex-1 py-4 sm:py-6 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pr-1.5">
          <AnnouncementBanner />
          {children}
        </main>

        {right && (
          <aside className="hidden h-screen w-[21rem] shrink-0 overflow-y-auto custom-scrollbar py-6 xl:block">
            {right}
          </aside>
        )}
      </div>

      {/* Mobile Floating Compose Button */}
      <Link
        to="/feed"
        search={{ compose: "true" }}
        onClick={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("spaces:trigger_compose"));
          }
        }}
        aria-label="Create post"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 aspect-square items-center justify-center rounded-full bg-gradient-to-r from-brand to-brand-pink text-white shadow-glow transition-transform duration-200 hover:scale-105 active:scale-95 lg:hidden cursor-pointer shrink-0"
      >
        <Feather className="h-5 w-5" />
      </Link>

      {/* mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 bg-card/95 backdrop-blur-md border-t border-border/80 lg:hidden shadow-lg">
        {mobileItems.map((item) => (
          <MobileTab key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}

function MobileTab({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const active = pathname === item.to;
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[0.65rem] font-semibold transition-colors",
        active ? "text-brand" : "text-muted-foreground",
      )}
    >
      <div className="relative">
        <Icon className={cn("h-5 w-5 transition-transform duration-300", active && "scale-110")} />
        {item.badge ? (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-black text-white">
            {item.badge}
          </span>
        ) : null}
      </div>
      {item.label}
    </Link>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "glass-panel rounded-3xl p-5 shadow-soft transition-shadow duration-500 hover:shadow-lift",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
