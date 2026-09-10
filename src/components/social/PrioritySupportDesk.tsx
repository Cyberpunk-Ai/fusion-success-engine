import { useState } from "react";
import {
  Headphones,
  Crown,
  ShieldCheck,
  Clock,
  Send,
  Plus,
  Lock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useSupport, useTicketThread, type SupportTicket } from "@/lib/support-state";
import { usePlan, openUpgradeModal } from "@/lib/plan-state";
import { Avatar } from "@/components/social/Avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PrioritySupportDesk() {
  const { isPro } = usePlan();
  const { tickets, conciergeAssigned, createTicket } = useSupport();

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicket["category"]>("Creator Studio");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("Urgent (15 min SLA)");
  const [message, setMessage] = useState("");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const thread = useTicketThread(openTicketId);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    const text = replyDraft.trim();
    if (!text) return;
    const ok = await thread.reply(text);
    if (ok) {
      setReplyDraft("");
    } else {
      toast.error("Reply could not be sent. Please try again.");
    }
  }

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    createTicket(subject.trim(), category, priority, message.trim());
    toast.success("Priority ticket submitted! Our VIP Concierge is assigned.");
    setSubject("");
    setMessage("");
    setIsTicketModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black">Priority VIP Support Desk</h2>
            <span className="flex items-center gap-1 text-[0.65rem] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Crown className="h-3 w-3" /> Pro Feature
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Direct access to senior engineers and dedicated account concierge with guaranteed 15-minute SLA.
          </p>
        </div>

        {isPro ? (
          <button
            onClick={() => setIsTicketModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Open VIP Ticket</span>
          </button>
        ) : (
          <button
            onClick={() => openUpgradeModal("24/7 Priority Support Desk")}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all cursor-pointer"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Upgrade to Pro ($19/mo)</span>
          </button>
        )}
      </div>

      {/* Concierge Status Card */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar name={conciergeAssigned?.name || "VIP Concierge"} src={conciergeAssigned?.avatar} className="h-12 w-12 text-sm" />
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{conciergeAssigned?.name || "Dedicated VIP Concierge"}</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-extrabold text-emerald-600 dark:text-emerald-400">
                  Online Now
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{conciergeAssigned?.title || "Spaces Priority Executive Support"}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span>SLA: &lt; 15 Minutes</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>24/7 Dedicated Queue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tickets List */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Headphones className="h-4 w-4 text-amber-500" />
            <span>Active Priority Tickets</span>
          </h3>
          <span className="text-xs text-muted-foreground font-semibold">{tickets.length} Tickets</span>
        </div>

        <div className="divide-y divide-border/60 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          {tickets.map((t) => {
            const isOpen = openTicketId === t.id;
            return (
              <div key={t.id} className="py-3.5 space-y-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOpenTicketId(isOpen ? null : t.id);
                    setReplyDraft("");
                  }}
                  className="w-full space-y-2 text-left cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{t.id.slice(0, 8)}</span>
                      <span className="truncate font-bold text-foreground">{t.subject}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden rounded bg-muted px-2 py-0.5 text-[0.65rem] font-bold text-muted-foreground sm:inline">
                        {t.category}
                      </span>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-extrabold text-amber-600 capitalize dark:text-amber-400">
                        ● {t.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <p className="rounded-xl border border-border/40 bg-muted/20 p-2.5 text-muted-foreground">
                    "{t.lastMessage}"
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5 text-[0.65rem] text-muted-foreground">
                    <span>Priority: {t.priority}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {isOpen ? "Hide conversation" : "View & reply"}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-3">
                    <div className="max-h-56 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                      {thread.loading && <p className="text-muted-foreground">Loading conversation…</p>}
                      {!thread.loading && thread.messages.length === 0 && (
                        <p className="text-muted-foreground">
                          No replies yet — our concierge will respond shortly.
                        </p>
                      )}
                      {thread.messages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed",
                            m.fromSupport
                              ? "bg-card border border-border/60"
                              : "ml-auto bg-gradient-to-r from-amber-500 to-orange-500 text-white",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p
                            className={cn(
                              "mt-1 text-[0.6rem]",
                              m.fromSupport ? "text-muted-foreground" : "text-white/70",
                            )}
                          >
                            {m.fromSupport ? "Support" : "You"} · {m.createdAt}
                          </p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleReply} className="flex items-end gap-2">
                      <textarea
                        rows={2}
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Write a reply…"
                        className="min-w-0 flex-1 resize-none rounded-2xl border border-border bg-card p-2.5 text-xs outline-none focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={thread.sending || !replyDraft.trim()}
                        className="flex shrink-0 items-center gap-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{thread.sending ? "Sending" : "Send"}</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
          {tickets.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No tickets yet. Open one and our concierge replies within 15 minutes.
            </p>
          )}
        </div>
      </div>

      {/* Pro Tier Lock Barrier */}
      {!isPro && (
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-black">24/7 Priority Support Requires Pro</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Get direct VIP ticket routing, 15-minute SLA guarantees, and dedicated audio space hosting assistance.
            </p>
          </div>
          <button
            onClick={() => openUpgradeModal("24/7 Priority Support")}
            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all cursor-pointer whitespace-nowrap"
          >
            Upgrade to Pro ($19/mo)
          </button>
        </div>
      )}

      {/* Create Ticket Modal */}
      {isTicketModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setIsTicketModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Submit Priority VIP Ticket</h3>
              <button
                onClick={() => setIsTicketModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="Describe your request..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-2xl bg-muted/40 border border-border px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full rounded-2xl bg-muted/40 border border-border px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-amber-500"
                >
                  <option value="Creator Studio">Creator Studio & Monetization</option>
                  <option value="API & Webhooks">API & Webhooks</option>
                  <option value="Spaces & Audio">Spaces & Audio Live Stream</option>
                  <option value="Billing">Billing & Subscription</option>
                  <option value="General">General Inquiries</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Message Details
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide any relevant URLs, error logs, or requirements..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-2xl bg-muted/40 border border-border p-3 text-xs font-medium outline-none resize-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTicketModalOpen(false)}
                  className="flex-1 rounded-2xl border border-border py-2.5 text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all cursor-pointer"
                >
                  Submit VIP Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
