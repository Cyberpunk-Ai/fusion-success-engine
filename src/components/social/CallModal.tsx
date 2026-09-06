import { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
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

interface CallModalProps {
  partner: Profile | null;
  type: "audio" | "video";
  isOpen: boolean;
  onClose: () => void;
}

export function CallModal({ partner, type, isOpen, onClose }: CallModalProps) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(type === "audio");
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showInCallChat, setShowInCallChat] = useState(false);
  const [inCallNotes, setInCallNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; left: number }>>([]);
  const [noiseSuppression, setNoiseSuppression] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Timer
  useEffect(() => {
    if (!isOpen) {
      setSeconds(0);
      return;
    }
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Handle local camera stream if video call or toggled video
  useEffect(() => {
    if (!isOpen) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      return;
    }

    if (!videoOff && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          mediaStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Camera/Mic permission fallback:", err);
          // Graceful fallback to simulated connection
        });
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      }
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [isOpen, videoOff]);

  // Sync mute state with actual audio tracks
  useEffect(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }, [muted]);

  // Sync video off state with actual video tracks
  useEffect(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !videoOff;
      });
    }
  }, [videoOff]);

  const handleEndCall = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    toast.info("Call ended");
    onClose();
  };

  if (!isOpen || !partner) return null;

  const formattedTime = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  function triggerReaction(emoji: string) {
    const id = `react_${Date.now()}_${Math.random()}`;
    const left = Math.floor(Math.random() * 60) + 20;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  }

  async function handleToggleScreenShare() {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      toast.info("Screen sharing ended");
    } else {
      try {
        if (navigator.mediaDevices?.getDisplayMedia) {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          setIsScreenSharing(true);
          toast.success("Sharing your screen");
          displayStream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
          };
        } else {
          setIsScreenSharing(true);
          toast.success("Sharing your screen (simulated)");
        }
      } catch {
        // user cancelled picker
      }
    }
  }

  function handleSendNote() {
    if (!noteDraft.trim()) return;
    setInCallNotes((prev) => [...prev, noteDraft.trim()]);
    setNoteDraft("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="glass-panel relative flex flex-col justify-between h-[85vh] max-h-[640px] w-full max-w-md overflow-hidden rounded-3xl p-5 shadow-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating live reaction hearts/emojis */}
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
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {!videoOff ? "1080p Ultra HD" : "Crystal Opus 48kHz"}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
              <Wifi className="h-3 w-3 text-emerald-400" /> 18ms
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full">{formattedTime}</span>
        </div>

        {/* Center Calling Area */}
        <div className="my-auto relative flex flex-col items-center justify-center text-center w-full z-10">
          {/* Main Partner View */}
          <div className="relative flex flex-col items-center">
            {/* Pulsing Audio Waveform Equalizer simulation */}
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
                <Volume2 className="h-4 w-4 animate-pulse" />
              </span>
            </div>

            <h3 className="mt-5 text-xl font-extrabold tracking-tight">{partner.display_name}</h3>
            <p className="text-xs text-white/60 mt-1">@{partner.username} · Connected</p>

            {/* Live Audio Equalizer Waveform bars */}
            {!muted && (
              <div className="mt-4 flex items-center gap-1 h-6">
                {[40, 75, 100, 60, 90, 45, 80, 55, 95, 65, 30].map((h, i) => (
                  <span
                    key={i}
                    style={{
                      height: `${Math.max(6, (h * (seconds % 3 + 1)) / 3)}px`,
                      animationDelay: `${i * 90}ms`,
                    }}
                    className="w-1 rounded-full bg-gradient-to-t from-brand to-brand-pink transition-all duration-150"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Self Camera Inset (if video active) */}
          {!videoOff && (
            <div className="absolute right-2 bottom-0 w-28 h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black animate-in zoom-in duration-200">
              <video
                ref={localVideoRef}
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

          {/* In-Call Quick Notes/Chat Overlay */}
          {showInCallChat && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-between border border-white/10 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-brand" /> Quick In-Call Chat
                </span>
                <button
                  onClick={() => setShowInCallChat(false)}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 py-2 text-left">
                <div className="rounded-xl bg-white/10 p-2 text-xs">
                  <p className="text-white/60 text-[10px]">@{partner.username}</p>
                  <p>Audio is super clear!</p>
                </div>
                {inCallNotes.map((n, i) => (
                  <div key={i} className="rounded-xl bg-brand/30 p-2 text-xs text-right">
                    <p className="text-white/60 text-[10px]">You</p>
                    <p>{n}</p>
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
                  className="p-1.5 rounded-full bg-brand text-white"
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
            { emoji: "👏", label: "Clap" },
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
          {/* Mute Mic */}
          <button
            onClick={() => setMuted(!muted)}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              muted ? "bg-rose-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
            )}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Toggle Video */}
          <button
            onClick={() => setVideoOff(!videoOff)}
            aria-label={videoOff ? "Turn on camera" : "Turn off camera"}
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              videoOff ? "bg-rose-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
            )}
            title={videoOff ? "Turn on video" : "Turn off video"}
          >
            {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            aria-label="Share screen"
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              isScreenSharing ? "bg-indigo-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
            )}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <Monitor className="h-5 w-5" />
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => setShowInCallChat(!showInCallChat)}
            aria-label="Open in-call chat"
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              showInCallChat ? "bg-brand text-white" : "bg-white/15 text-white hover:bg-white/25"
            )}
            title="In-call chat"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Speaker Toggle */}
          <button
            onClick={() => {
              setIsSpeakerOn(!isSpeakerOn);
              toast(isSpeakerOn ? "Audio routed to earpiece" : "Speakerphone enabled");
            }}
            aria-label="Toggle speaker"
            className={cn(
              "rounded-full p-3.5 backdrop-blur-md transition-all active:scale-95 shadow-md cursor-pointer",
              !isSpeakerOn ? "bg-amber-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
            )}
            title={isSpeakerOn ? "Speaker ON" : "Speaker OFF"}
          >
            {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          {/* End Call */}
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

