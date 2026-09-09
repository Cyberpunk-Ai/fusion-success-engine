/**
 * App-wide incoming call handling: shows the ringing screen anywhere in the
 * app and opens the live call once the invite is accepted.
 */
import { useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";

import { Avatar } from "@/components/social/Avatar";
import { CallModal } from "@/components/social/CallModal";
import { useIncomingCall, type CallKind } from "@/lib/webrtc-call";
import type { Profile } from "@/lib/types";

export function CallCenter() {
  const { incoming, decline, dismiss } = useIncomingCall();
  const [answered, setAnswered] = useState<
    { id: string; partner: Profile; kind: CallKind } | null
  >(null);

  if (answered) {
    return (
      <CallModal
        partner={answered.partner}
        type={answered.kind}
        isOpen
        role="callee"
        callId={answered.id}
        onClose={() => setAnswered(null)}
      />
    );
  }

  if (!incoming) return null;

  const caller = incoming.fromProfile;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming ${incoming.kind} call`}
      className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 sm:p-4 animate-in slide-in-from-top duration-300"
    >
      <div className="glass-panel flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/95 p-3 text-white shadow-2xl sm:p-4">
        <Avatar
          name={caller?.display_name ?? "Caller"}
          src={caller?.avatar_url}
          className="h-12 w-12 shrink-0 ring-2 ring-brand/50"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{caller?.display_name ?? "Someone"}</p>
          <p className="flex items-center gap-1 truncate text-xs text-white/60">
            {incoming.kind === "video" ? (
              <Video className="h-3 w-3" />
            ) : (
              <Phone className="h-3 w-3" />
            )}
            Incoming {incoming.kind} call…
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => decline(incoming)}
            aria-label="Decline call"
            title="Decline"
            className="cursor-pointer rounded-full bg-rose-600 p-3 text-white transition-transform active:scale-95 hover:bg-rose-700"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setAnswered({ id: incoming.id, partner: caller, kind: incoming.kind });
              dismiss();
            }}
            aria-label="Accept call"
            title="Accept"
            className="cursor-pointer rounded-full bg-emerald-600 p-3 text-white transition-transform active:scale-95 hover:bg-emerald-700"
          >
            <Phone className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
