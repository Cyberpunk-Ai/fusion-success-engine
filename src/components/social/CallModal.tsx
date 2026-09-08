import { useEffect, useMemo, useState } from "react";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Monitor,
  Heart,
  Flame,
  Laugh,
  ThumbsUp,
  MessageSquare,
  Send,
  Wifi,
} from "lucide-react";
import { Avatar } from "@/components/social/Avatar";
import { type Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { currentUserId } from "@/lib/profile-service";
import { emitRealtime, useRealtime } from "@/lib/realtime";
import { newCallId, useCallConnection, type CallKind, type CallRole } from "@/lib/webrtc-call";

interface CallModalProps {
  partner: Profile | null;
  type: CallKind;
  isOpen: boolean;
  onClose: () => void;
  /** "caller" rings the partner; "callee" answers an accepted invite. */
  role?: CallRole;
  /** Shared id from the invite. Generated automatically for outgoing calls. */
  callId?: string;
}

export function CallModal({
  partner,
  type,
  isOpen,
  onClose,
  role = "caller",
  callId,
}: CallModalProps) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(type === "audio");
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showInCallChat, setShowInCallChat] = useState(false);
  const [messages, setMessages] = useState<Array<{ mine: boolean; body: string }>>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; left: number }>>([]);

  const generatedId = useMemo(() => callId ?? newCallId(), [callId]);
  const session = useMemo(
    () =>
      partner && isOpen
        ? { id: generatedId, partner, kind: type, role }
        : null,
    [partner, isOpen, generatedId, type, role],
  );

  const call = useCallConnection(session, isOpen && Boolean(partner));

  // Reflect the connection lifecycle back to the caller of this modal.
  useEffect(() => {
    if (!isOpen) return;
    if (call.phase === "declined") {
      toast.info(`${partner?.display_name ?? "They"} declined the call`);
      onClose();
    } else if (call.phase === "failed") {
      toast.error("We couldn't connect that call — check your camera and mic permissions");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.phase, isOpen]);

  useEffect(() => {
    call.setMicEnabled(!muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  useEffect(() => {
    call.setCameraEnabled(!videoOff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoOff]);

  useRealtime(
    {
      "call:chat": (p: any) => {
        if (!session || p?.callId !== session.id || p?.from === currentUserId) return;
        setMessages((prev) => [...prev, { mine: false, body: String(p.body ?? "") }]);
      },
      "call:react": (p: any) => {
        if (!session || p?.callId !== session.id || p?.from === currentUserId) return;
        pushReaction(String(p.emoji ?? "❤️"));
      },
    },
    [session?.id],
  );

  if (!isOpen || !partner) return null;

  const formattedTime = `${Math.floor(call.seconds / 60)
    .toString()
    .padStart(2, "0")}:${(call.seconds % 60).toString().padStart(2, "0")}`;

  const statusLabel =
    call.phase === "connected"
      ? "Connected"
      : call.phase === "ringing"
        ? "Ringing…"
        : call.phase === "connecting"
          ? "Connecting…"
          : "Call ended";

  function pushReaction(emoji: string) {
    const id = `react_${Date.now()}_${Math.random()}`;
    const left = Math.floor(Math.random() * 60) + 20;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2000);
  }

  function triggerReaction(emoji: string) {
    pushReaction(emoji);
    if (session) {
      emitRealtime("call:react", {
        callId: session.id,
        to: session.partner.id,
        from: currentUserId,
        emoji,
      });
    }
  }

  function handleEndCall() {
    call.hangUp();
    onClose();
  }

  async function handleToggleScreenShare() {
    try {
      const sharing = await call.shareScreen(!isScreenSharing);
      setIsScreenSharing(sharing);
      toast[sharing ? "success" : "info"](sharing ? "Sharing your screen" : "Screen sharing ended");
    } catch {
      /* user cancelled the picker */
    }
  }

  function handleSendNote() {
    const body = noteDraft.trim();
    if (!body || !session) return;
    setMessages((prev) => [...prev, { mine: true, body }]);
    setNoteDraft("");
    emitRealtime("call:chat", {
      callId: session.id,
      to: session.partner.id,
      from: currentUserId,
      body,
    });
  }

  const showRemoteVideo = type === "video" && call.phase === "connected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="glass-panel relative flex flex-col justify-between h-[85vh] max-h-[640px] w-full max-w-md overflow-hidden rounded-3xl p-5 shadow-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Remote audio always plays, even on audio-only calls */}
        <audio ref={call.remoteAudioRef} autoPlay playsInline muted={!isSpeakerOn} />

        {/* Floating live reactions */}
        <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
          {reactions.map((r) => (
            <span
              key={r.id}
              style={{ left: `${r.left}%` }}
              className="absolute bottom-20 text-3xl animate-in fade-in slide-in-from-bottom-8 duration-1000 -translate-y-36 opacity-90"
            >
              {r.emoji}
            </span>
          ))}
        </div>

        {/* Top Header */}
        <div className="flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border",
                call.phase === "connected"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30",
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
              </span>
              {statusLabel}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
              <Wifi className="h-3 w-3 text-emerald-400" />
              {type === "video" ? "HD video" : "HD audio"}
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
            {formattedTime}
          </span>
        </div>

        {/* Center Calling Area */}
        <div className="my-auto relative flex flex-col items-center justify-center text-center w-full z-10">
          {showRemoteVideo ? (
            <div className="relative w-full aspect-3/4 max-h-[22rem] overflow-hidden rounded-2xl bg-black border border-white/10">
              <video
                ref={call.remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold">
                {partner.display_name}
                {call.remoteMuted ? " · muted" : ""}
              </span>
            </div>
          ) : (
            <div className="relative flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-brand/30 via-brand-pink/30 to-brand-orange/30 blur-xl animate-pulse" />
                <div className="relative rounded-full p-2 ring-4 ring-brand/40 shadow-glow">
                  <Avatar
                    name={partner.display_name}
                    src={partner.avatar_url}
                    className="h-28 w-28 text-3xl ring-4 ring-white/20 shadow-2xl"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-2 text-white shadow-md ring-2 ring-slate-950">
                  {call.remoteMuted ? <MicOff className="h-4 w-4" /> : <Volume2 className="h-4 w-4 animate-pulse" />}
                </span>
              </div>

              <h3 className="mt-5 text-xl font-extrabold tracking-tight">{partner.display_name}</h3>
              <p className="text-xs text-white/60 mt-1">
                @{partner.username} · {statusLabel}
              </p>
            </div>
          )}

          {/* Self camera inset */}
          {type === "video" && !videoOff && (
            <div className="absolute right-2 bottom-0 w-24 h-32 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black animate-in zoom-in duration-200">
              <video
                ref={call.localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded-md text-white/90">
                You
              </span>
            </div>
          )}

          {/* In-call chat */}
          {showInCallChat && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-between border border-white/10 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-brand" /> In-call chat
                </span>
                <button
                  onClick={() => setShowInCallChat(false)}
                  className="text-xs text-white/60 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 py-2 text-left">
                {messages.length === 0 && (
                  <p className="text-xs text-white/40">Messages here stay in this call only.</p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl p-2 text-xs",
                      m.mine ? "bg-brand/30 text-right" : "bg-white/10",
                    )}
                  >
                    <p className="text-white/60 text-[10px]">{m.mine ? "You" : `@${partner.username}`}</p>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendNote()}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/10 rounded-full px-3 py-1.5 text-xs text-white placeholder:text-white/40 outline-none"
                />
                <button
                  onClick={handleSendNote}
                  aria-label="Send message"
                  className="p-1.5 rounded-full bg-brand text-white cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Reactions Bar */}
        <div className="flex items-center justify-center gap-2 py-2 border-t border-white/10 z-20">
          {[
            { emoji: "❤️", icon: Heart },
            { emoji: "🔥", icon: Flame },
            { emoji: "👏" },
            { emoji: "😂", icon: Laugh },
            { emoji: "👍", icon: ThumbsUp },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => triggerReaction(item.emoji)}
              className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-base transition-transform active:scale-125 cursor-pointer"
              title={`Send ${item.emoji}`}
            >
              {item.emoji}
            </button>
          ))}
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center justify-center gap-3 pt-3 border-t border-white/10 z-20">
          <button
            onClick={() => setMuted(!muted)}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              muted ? "bg-rose-500 text-white" : "bg-white/15 text-white hover:bg-white/25",
            )}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {type === "video" && (
            <button
              onClick={() => setVideoOff(!videoOff)}
              aria-label={videoOff ? "Turn on camera" : "Turn off camera"}
              className={cn(
                "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
                videoOff ? "bg-rose-500 text-white" : "bg-white/15 text-white hover:bg-white/25",
              )}
              title={videoOff ? "Turn on video" : "Turn off video"}
            >
              {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>
          )}

          <button
            onClick={handleToggleScreenShare}
            aria-label="Share screen"
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              isScreenSharing ? "bg-indigo-600 text-white" : "bg-white/15 text-white hover:bg-white/25",
            )}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <Monitor className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowInCallChat(!showInCallChat)}
            aria-label="Open in-call chat"
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              showInCallChat ? "bg-brand text-white" : "bg-white/15 text-white hover:bg-white/25",
            )}
            title="In-call chat"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            aria-label="Toggle speaker"
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              !isSpeakerOn ? "bg-amber-500 text-white" : "bg-white/15 text-white hover:bg-white/25",
            )}
            title={isSpeakerOn ? "Speaker on" : "Speaker muted"}
          >
            {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            onClick={handleEndCall}
            aria-label="End call"
            className="rounded-full bg-rose-600 hover:bg-rose-700 p-3.5 text-white transition-all active:scale-95 shadow-lg shadow-rose-600/40 cursor-pointer"
            title="Hang up"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
