import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Send,
  Phone,
  Video,
  Info,
  Smile,
  Paperclip,
  ArrowLeft,
  Loader2,
  DollarSign,
  Plus,
  Mic,
  Square,
  Sparkles,
  X,
  CheckCheck,
  Edit2,
  Trash2,
  Check,
  MoreVertical,
  Play,
} from "lucide-react";
import { AppShell } from "@/components/social/AppShell";
import { Avatar } from "@/components/social/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeAgo, useLiveNow } from "@/components/social/TimeAgo";
import { CallModal } from "@/components/social/CallModal";
import { InfoModal } from "@/components/social/InfoModal";
import { TipModal } from "@/components/social/TipModal";
import { timeAgo } from "@/lib/formatters";
import { currentUserId, currentUser, getProfile, profileRegistry } from "@/lib/profile-service";
import type { Conversation, Message, Profile } from "@/lib/types";
import { getConversations, getMessages, sendMessage, uploadMedia, getUserProfile, getUsers } from "@/lib/api-client";
import { decrementUnreadMessages } from "@/lib/unread-state";
import { useRealtime } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): { user?: string; id?: string } => ({
    user: search.user ? String(search.user) : undefined,
    id: search.id ? String(search.id) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — Spaces" },
      {
        name: "description",
        content:
          "Private, fast conversations on Spaces. Catch up with collaborators, share frames, and keep every thread in one calm inbox.",
      },
      { property: "og:title", content: "Messages — Spaces" },
      {
        property: "og:description",
        content: "Private, fast conversations with the people you create with on Spaces.",
      },
    ],
  }),
  component: MessagesPage,
});

const DEFAULT_USERS_TO_START = [
  { id: "u_sora", username: "sora", display_name: "Sora Takahashi", bio: "Kinetic UI & WebGL" },
  { id: "u_elena", username: "elena", display_name: "Elena Rostova", bio: "Generative soundscapes" },
  { id: "u_kai", username: "kai", display_name: "Kai Vance", bio: "Building micro-tools" },
  { id: "u_maya", username: "maya", display_name: "Maya Lin", bio: "Product architect" },
  { id: "u_zane", username: "zane", display_name: "Zane Sterling", bio: "Motion designer" },
];

function VoiceNotePlayer({ body, isMine }: { body: string; isMine: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const match = body.match(/\((\d+)s\)/);
  const duration = match ? parseInt(match[1], 10) : 5;

  // Extract optional recorded audio url: [url]
  const matchUrl = body.match(/\[(.*?)\]/);
  const audioUrl = matchUrl ? matchUrl[1] : null;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }
  }, [audioUrl]);

  useEffect(() => {
    if (audioUrl) return; // Managed by audioRef timeupdate

    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 100 / (duration * 10);
        });
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration, audioUrl]);

  const togglePlay = () => {
    if (audioUrl) {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (progress >= 100) {
          audioRef.current.currentTime = 0;
          setProgress(0);
        }
        audioRef.current.play().catch((err) => {
          console.warn("Audio playback issue:", err);
          toast.error("Audio playback blocked or unavailable");
        });
        setIsPlaying(true);
      }
    } else {
      if (progress >= 100) setProgress(0);
      setIsPlaying(!isPlaying);
    }
  };

  const bars = [40, 70, 30, 85, 50, 95, 60, 40, 80, 100, 65, 45, 90, 75, 35, 80, 50, 30];

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[210px] sm:min-w-[240px]">
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 cursor-pointer shadow-sm",
          isMine
            ? "bg-white text-brand hover:bg-white/95"
            : "bg-brand text-white hover:bg-brand/90"
        )}
      >
        {isPlaying ? (
          <span className="flex items-center gap-0.5">
            <span className="h-3 w-1 rounded-full bg-current animate-pulse" />
            <span className="h-3 w-1 rounded-full bg-current animate-pulse delay-75" />
          </span>
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-0.5 h-6">
          {bars.map((height, i) => {
            const barProgress = (i / bars.length) * 100;
            const isActive = progress >= barProgress;
            return (
              <span
                key={i}
                style={{ height: `${isPlaying ? Math.max(20, Math.min(100, height * (0.7 + (i % 3) * 0.2))) : height}%` }}
                className={cn(
                  "w-1 rounded-full transition-all duration-150",
                  isActive
                    ? isMine ? "bg-white" : "bg-brand"
                    : isMine ? "bg-white/40" : "bg-muted-foreground/30"
                )}
              />
            );
          })}
        </div>
        <div className={cn("flex justify-between text-[10px] font-semibold", isMine ? "text-white/80" : "text-muted-foreground")}>
          <span>{isPlaying ? `${Math.floor((progress / 100) * duration)}s` : "Voice Note"}</span>
          <span>{duration}s</span>
        </div>
      </div>
    </div>
  );
}

function ConvsSkeleton() {
  return (
    <div className="space-y-2 p-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl p-3">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-3 w-10 rounded-md" />
            </div>
            <Skeleton className="h-3 w-40 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesPage() {
  const search = Route.useSearch();
  const targetUserParam = search.user || search.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>("");
  const [all, setAll] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<{ user: Profile; type: "audio" | "video" } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showNewMsgModal, setShowNewMsgModal] = useState(false);
  const [newMsgQuery, setNewMsgQuery] = useState("");
  const [sending, setSending] = useState(false);
  
  // Edit message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Voice note simulation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Message reactions state: Record<msgId, Record<emoji, number>>
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({
    m_sample_1: { "❤️": 2, "🔥": 1 },
  });

  const [candidateUsers, setCandidateUsers] = useState<Profile[]>([]);

  useEffect(() => {
    getUsers()
      .then((res) => {
        const list = res?.profiles || [];
        if (list.length > 0) {
          setCandidateUsers(list.filter((u) => u.id !== currentUserId));
        }
      })
      .catch(() => {});
  }, []);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const now = useLiveNow();

  // Load conversations from backend
  useEffect(() => {
    setConvsLoading(true);
    getConversations()
      .then((data) => {
        if (data && data.length > 0) {
          let targetConvId = activeId || data[0].id;

          // If target user was passed in URL query param
          if (targetUserParam) {
            const cleanTarget = targetUserParam.replace(/^@/, "");
            const found = data.find(
              (c) => c.participant_id === targetUserParam || c.participant_id === cleanTarget
            );
            if (found) {
              targetConvId = found.id;
            } else {
              // Create temporary conversation for this participant
              const resolved = getProfile(targetUserParam);
              const newConvId = `c_${resolved.id}_${Date.now()}`;
              const newConv: Conversation = {
                id: newConvId,
                participant_id: resolved.id,
                preview: "Direct message thread",
                updated_at: new Date().toISOString(),
                unread: 0,
                online: true,
              };
              data.unshift(newConv);
              targetConvId = newConvId;
            }
            setMobileOpen(true);
          }

          const targetConv = data.find((c) => c.id === targetConvId);
          if (targetConv && targetConv.unread > 0) {
            decrementUnreadMessages(targetConv.unread);
          }
          const initialData = data.map((c) => (c.id === targetConvId ? { ...c, unread: 0 } : c));
          setConversations(initialData);
          setActiveId(targetConvId);
        } else if (targetUserParam) {
          // If no conversations existed yet, start one with target
          const resolved = getProfile(targetUserParam);
          const newConvId = `c_${resolved.id}_${Date.now()}`;
          const newConv: Conversation = {
            id: newConvId,
            participant_id: resolved.id,
            preview: "Direct message thread",
            updated_at: new Date().toISOString(),
            unread: 0,
            online: true,
          };
          setConversations([newConv]);
          setActiveId(newConvId);
          setMobileOpen(true);
        }
      })
      .catch((err) => console.warn("Conversations load:", err))
      .finally(() => setConvsLoading(false));
  }, [targetUserParam]);

  function selectConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (conv && conv.unread > 0) {
      decrementUnreadMessages(conv.unread);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
      );
    }
    setActiveId(id);
    setMobileOpen(true);
  }

  // Load messages for the active conversation
  useEffect(() => {
    if (!activeId) return;
    getMessages(activeId)
      .then((msgs) => {
        if (msgs && msgs.length > 0) {
          setAll((prev) => {
            const others = prev.filter((m) => m.conversation_id !== activeId);
            return [...others, ...msgs];
          });
        }
      })
      .catch((err) => console.warn("Messages load:", err));
  }, [activeId]);

  const active = (activeId ? conversations.find((c) => c.id === activeId) : conversations[0]) || null;
  const partner = active ? getProfile(active.participant_id) : null;
  const thread = useMemo(() => all.filter((m) => m.conversation_id === activeId), [all, activeId]);

  const list = conversations.filter((c) => {
    const p = getProfile(c.participant_id);
    const q = query.toLowerCase();
    return !q || p.display_name.toLowerCase().includes(q) || p.username.includes(q);
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length]);

  // Realtime hook for incoming messages
  useRealtime(
    (event) => {
      const msg = event.message || (event.type === "new_message" ? (event.data || (event.id ? event : null)) : null);
      if ((event.type === "message" || event.type === "new_message") && msg) {
        const msgBody = msg.body || msg.content || "";
        const msgSender = msg.sender_id || (partner ? partner.id : "");
        const msgConvId = msg.conversation_id || activeId;

        setAll((prev) => {
          // If already in thread by ID, skip
          if (prev.some((m) => m.id === msg.id)) return prev;
          
          // If it's sent by current user and we have a matching un-synced/optimistic message, reconcile ID
          if (msgSender === currentUserId) {
            const matchIndex = prev.findIndex((m) => {
              if (m.sender_id !== currentUserId || m.conversation_id !== msgConvId) return false;
              if (m.body === msgBody) return true;
              if (m.body.includes("Voice Note") && msgBody.includes("Voice Note")) {
                return m.body.split(" [")[0] === msgBody.split(" [")[0];
              }
              return false;
            });
            if (matchIndex !== -1) {
              const updated = [...prev];
              updated[matchIndex] = {
                ...updated[matchIndex],
                id: msg.id || updated[matchIndex].id,
                body: msgBody, // Sync with final uploaded media URL
              };
              const seen = new Set<string>();
              return updated.filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
              });
            }
          }

          const newList = [
            ...prev,
            {
              id: msg.id || `m_${Date.now()}`,
              conversation_id: msgConvId,
              sender_id: msgSender,
              body: msgBody,
              created_at: msg.created_at || new Date().toISOString(),
              media_url: msg.media_url,
            },
          ];
          const seen = new Set<string>();
          return newList.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });

        setConversations((prev) =>
          prev.map((c) =>
            c.id === msgConvId
              ? { ...c, preview: msgBody || "Media attachment", updated_at: new Date().toISOString() }
              : c
          )
        );
      }
    },
    ["message", "new_message"]
  );

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMsg: Message = {
      id: tempId,
      conversation_id: activeId,
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
    };

    setAll((prev) => [...prev, newMsg]);
    setDraft("");

    try {
      const res: any = await sendMessage(activeId, body);
      const serverMsg = res?.message || res;
      if (serverMsg?.id) {
        setAll((prev) => {
          const updated = prev.map((m) => (m.id === tempId ? { ...m, id: serverMsg.id } : m));
          const seen = new Set<string>();
          return updated.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, preview: body, updated_at: new Date().toISOString() }
            : c
        )
      );
    } catch {
      // Keep optimistic message
    } finally {
      setSending(false);
    }
  }

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setReactions((prev) => {
      const msgMap = { ...(prev[msgId] || {}) };
      if (msgMap[emoji]) {
        msgMap[emoji] = msgMap[emoji] - 1;
        if (msgMap[emoji] <= 0) delete msgMap[emoji];
      } else {
        msgMap[emoji] = (msgMap[emoji] || 0) + 1;
      }
      return { ...prev, [msgId]: msgMap };
    });
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditDraft(msg.body);
  };

  const handleSaveEdit = (msgId: string) => {
    if (!editDraft.trim()) return;
    setAll((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, body: editDraft.trim(), is_edited: true } : m
      )
    );
    setEditingMsgId(null);
    setEditDraft("");
    toast.success("Message edited");
  };

  const handleDeleteMessage = (msgId: string) => {
    const targetMsg = all.find((m) => m.id === msgId);
    setAll((prev) => prev.filter((m) => m.id !== msgId));
    toast.success("Message deleted", {
      action: targetMsg
        ? {
            label: "Undo",
            onClick: () => setAll((prev) => [...prev, targetMsg]),
          }
        : undefined,
    });
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();

      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      toast.error("Microphone access denied or error starting recording");
    }
  };

  const cancelVoiceRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setRecordDuration(0);
  };

  const sendVoiceNote = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    const duration = recordDuration || 1;
    setRecordDuration(0);

    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) {
      toast.error("No active recording found");
      return;
    }

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });

        const tempId = `temp_voice_${Date.now()}`;
        const tempLocalUrl = URL.createObjectURL(audioBlob);
        const tempBody = `🎙️ Voice Note (${duration}s) [${tempLocalUrl}]`;

        const newMsg: Message = {
          id: tempId,
          conversation_id: activeId,
          sender_id: currentUserId,
          body: tempBody,
          created_at: new Date().toISOString(),
        };

        setAll((prev) => [...prev, newMsg]);

        try {
          toast.loading("Uploading voice note...", { id: "voice-upload" });
          const res = await uploadMedia(audioFile, "messages");
          toast.success("Voice note uploaded", { id: "voice-upload" });

          const realBody = `🎙️ Voice Note (${duration}s) [${res.url}]`;
          const apiRes: any = await sendMessage(activeId, realBody);
          const serverMsg = apiRes?.message || apiRes;
          if (serverMsg?.id) {
            setAll((prev) => {
              const updated = prev.map((m) =>
                m.id === tempId ? { ...m, id: serverMsg.id, body: realBody } : m
              );
              const seen = new Set<string>();
              return updated.filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
              });
            });
          }
        } catch (err) {
          console.error("Voice note upload failed:", err);
          toast.error("Failed to upload voice note", { id: "voice-upload" });
        }
        resolve();
      };

      mediaRecorder.stop();
    });
  };

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const tempId = `temp_file_${Date.now()}`;
    try {
      toast.loading("Uploading attachment...", { id: "msg-upload" });
      const res = await uploadMedia(file, "messages");
      toast.success("Attachment ready", { id: "msg-upload" });
      
      const newMsg: Message = {
        id: tempId,
        conversation_id: activeId,
        sender_id: currentUserId,
        body: res.url,
        created_at: new Date().toISOString(),
      };
      setAll((prev) => [...prev, newMsg]);
      const sendRes: any = await sendMessage(activeId, res.url);
      const serverMsg = sendRes?.message || sendRes;
      if (serverMsg?.id) {
        setAll((prev) => {
          const updated = prev.map((m) => (m.id === tempId ? { ...m, id: serverMsg.id } : m));
          const seen = new Set<string>();
          return updated.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
      }
    } catch (err: any) {
      console.warn("Upload fallback local preview:", err);
      const url = URL.createObjectURL(file);
      const newMsg: Message = {
        id: tempId,
        conversation_id: activeId,
        sender_id: currentUserId,
        body: url,
        created_at: new Date().toISOString(),
      };
      setAll((prev) => [...prev, newMsg]);
      toast.success("Attachment added", { id: "msg-upload" });
    }
  }

  function startChatWithUser(user: { id: string; username: string; display_name: string }) {
    setShowNewMsgModal(false);
    const existing = conversations.find((c) => c.participant_id === user.id);
    if (existing) {
      selectConversation(existing.id);
      return;
    }
    const newConvId = `c_${user.id}_${Date.now()}`;
    const newConv: Conversation = {
      id: newConvId,
      participant_id: user.id,
      preview: "Started a conversation",
      updated_at: new Date().toISOString(),
      unread: 0,
      online: true,
    };
    setConversations([newConv, ...conversations]);
    setActiveId(newConvId);
    setMobileOpen(true);
    toast.success(`Direct message started with ${user.display_name}`);
  }

  const availableCandidates = useMemo(() => {
    if (candidateUsers.length > 0) return candidateUsers;
    const registryList = Object.values(profileRegistry).filter((p) => p.id !== currentUserId);
    if (registryList.length > 0) return registryList;
    return DEFAULT_USERS_TO_START as Profile[];
  }, [candidateUsers]);

  const filteredStartUsers = availableCandidates.filter(
    (u) =>
      !newMsgQuery ||
      u.display_name.toLowerCase().includes(newMsgQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(newMsgQuery.toLowerCase())
  );

  return (
    <AppShell title="Messages">
      <div className="glass-panel grid h-[calc(100vh-8.5rem)] grid-cols-1 overflow-hidden rounded-3xl shadow-soft lg:h-[calc(100vh-3rem)] lg:grid-cols-[20rem_1fr]">
        {/* conversation list */}
        <div
          className={cn(
            "flex min-h-0 flex-col border-border/60 lg:flex lg:border-r",
            mobileOpen ? "hidden" : "flex",
          )}
        >
          <div className="border-b border-border/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-extrabold tracking-tight">Messages</h1>
              <button
                type="button"
                onClick={() => setShowNewMsgModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand/10 hover:bg-brand/20 text-brand text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-foreground/5 px-4 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
            {convsLoading ? (
              <ConvsSkeleton />
            ) : (
              <>
                {list.map((c) => {
                  const p = getProfile(c.participant_id);
                  const isActive = c.id === activeId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-all duration-300 cursor-pointer",
                        isActive
                          ? "bg-gradient-to-r from-brand/12 to-brand-pink/12"
                          : "hover:bg-foreground/5",
                      )}
                    >
                      <span className="relative">
                        <Avatar
                          name={p.display_name}
                          src={p.avatar_url}
                          className="h-11 w-11 text-xs"
                        />
                        {c.online && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-bold">{p.display_name}</span>
                          <TimeAgo
                            iso={c.updated_at}
                            className="shrink-0 text-[0.7rem] text-muted-foreground"
                          />
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">
                            {c.preview}
                          </span>
                          {c.unread > 0 && (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-r from-brand to-brand-pink px-1.5 text-[0.65rem] font-bold text-white">
                              {c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {list.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
                    <p>No conversations found.</p>
                    <button
                      onClick={() => setShowNewMsgModal(true)}
                      className="px-4 py-2 rounded-full bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-all cursor-pointer"
                    >
                      Start a conversation
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* thread */}
        <div className={cn("flex min-h-0 flex-col", mobileOpen ? "flex" : "hidden lg:flex")}>
          {!active || !partner ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Select a conversation or start a new message to begin.</p>
              <button
                onClick={() => setShowNewMsgModal(true)}
                className="px-4 py-2 rounded-full bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-all cursor-pointer"
              >
                Send a Direct Message
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border/60 p-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Back to conversations"
                  className="rounded-full p-2 transition-colors hover:bg-foreground/5 lg:hidden cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Link
                  to="/profile"
                  search={{ id: partner.id, user: partner.username }}
                  className="shrink-0 transition-transform hover:scale-105 active:scale-95"
                >
                  <Avatar
                    name={partner.display_name}
                    src={partner.avatar_url}
                    className="h-10 w-10 text-xs"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/profile"
                    search={{ id: partner.id, user: partner.username }}
                    className="truncate block text-sm font-bold hover:text-brand hover:underline transition-colors"
                  >
                    {partner.display_name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
                    {active.online ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Online now</span>
                      </>
                    ) : (
                      `Active ${timeAgo(active.updated_at, now)} ago`
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {/* Tip Button */}
                  <button
                    onClick={() => setShowTipModal(true)}
                    title={`Send a tip to ${partner.display_name}`}
                    className="flex items-center gap-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 px-3 py-1.5 text-xs font-bold transition-all min-h-[36px] cursor-pointer"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tip</span>
                  </button>

                  <button
                    onClick={() => setActiveCall({ user: partner, type: "audio" })}
                    aria-label="Start Voice Call"
                    className="rounded-full p-2 transition-all duration-300 hover:bg-foreground/5 hover:text-foreground min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setActiveCall({ user: partner, type: "video" })}
                    aria-label="Start Video Call"
                    className="rounded-full p-2 transition-all duration-300 hover:bg-foreground/5 hover:text-foreground min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowInfo(true)}
                    aria-label="Conversation Info"
                    className="rounded-full p-2 transition-all duration-300 hover:bg-foreground/5 hover:text-foreground min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-3 sm:p-4 [scrollbar-width:thin]">
                {thread.map((m, idx) => {
                  const mine = m.sender_id === currentUserId;
                  const isLatestMine = mine && idx === thread.length - 1;
                  const msgReactions = reactions[m.id] || {};
                  const isEditingThis = editingMsgId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "group relative flex animate-in fade-in slide-in-from-bottom-2 duration-300 items-end gap-1.5",
                        mine ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[88%] sm:max-w-[78%] rounded-3xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm leading-relaxed shadow-soft relative",
                          mine
                            ? "rounded-br-lg bg-gradient-to-r from-brand to-brand-pink text-white"
                            : "rounded-bl-lg bg-foreground/5",
                        )}
                      >
                        {isEditingThis ? (
                          /* Inline Edit Mode */
                          <div className="space-y-2 min-w-[200px] text-foreground">
                            <input
                              type="text"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(m.id)}
                              className="w-full rounded-xl bg-card border border-border px-3 py-1.5 text-xs sm:text-sm outline-none text-foreground"
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => setEditingMsgId(null)}
                                className="px-2 py-1 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(m.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.body.includes("Voice Note") || m.body.includes("🎙️") ? (
                              <VoiceNotePlayer body={m.body} isMine={mine} />
                            ) : m.body.startsWith("data:image") || m.body.startsWith("/uploads/") || (m.body.startsWith("http") && (m.body.includes(".png") || m.body.includes(".jpg") || m.body.includes(".webp") || m.body.includes(".jpeg") || m.body.includes("/uploads/"))) ? (
                              <div className="overflow-hidden rounded-2xl max-w-xs my-1">
                                <img
                                  src={m.body}
                                  alt="Attachment"
                                  className="max-h-60 w-full object-cover rounded-2xl cursor-pointer hover:opacity-95"
                                  onClick={() => window.open(m.body, "_blank")}
                                />
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            )}

                            {/* Timestamp & Status footer */}
                            <div
                              className={cn(
                                "mt-1 flex items-center gap-1.5 text-[0.65rem]",
                                mine ? "text-white/80 justify-end" : "text-muted-foreground",
                              )}
                            >
                              <span>{timeAgo(m.created_at, now)}</span>
                              {(m as any).is_edited && (
                                <span className="italic opacity-80">(edited)</span>
                              )}
                              {mine && (
                                <span className="flex items-center gap-0.5 ml-1" title="Seen by recipient">
                                  <CheckCheck className="h-3.5 w-3.5 text-white" />
                                </span>
                              )}
                            </div>
                          </>
                        )}

                        {/* Display Reactions */}
                        {Object.keys(msgReactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Object.entries(msgReactions).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(m.id, emoji)}
                                className="cursor-pointer text-[11px] bg-background/80 dark:bg-card/90 backdrop-blur-xs px-2 py-0.5 rounded-full shadow-xs border border-border/40 hover:scale-105 transition-transform flex items-center gap-1 text-foreground"
                              >
                                <span>{emoji}</span>
                                {count > 1 && <span className="font-bold text-[10px] text-muted-foreground">{count}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Message Actions Hover Menu (Reactions, Edit, Delete) */}
                      {!isEditingThis && (
                        <div
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card/95 backdrop-blur-md border border-border/80 rounded-full px-1.5 py-1 shadow-md text-xs shrink-0",
                            mine ? "order-first" : "order-last"
                          )}
                        >
                          {["❤️", "🔥", "👏", "😂", "🎉", "💡"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(m.id, emoji)}
                              className="hover:scale-125 transition-transform p-0.5"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}

                          {mine && (
                            <>
                              <span className="w-px h-3 bg-border/60 mx-0.5" />
                              <button
                                type="button"
                                onClick={() => handleStartEdit(m)}
                                title="Edit message"
                                className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-foreground/5 transition-colors"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                title="Delete message"
                                className="p-1 text-muted-foreground hover:text-rose-500 rounded-full hover:bg-foreground/5 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Seen status note under last message */}
                {thread.length > 0 && thread[thread.length - 1].sender_id === currentUserId && (
                  <div className="text-right pr-2">
                    <span className="text-[10px] text-muted-foreground font-semibold flex items-center justify-end gap-1">
                      <CheckCheck className="h-3 w-3 text-brand" /> Seen just now
                    </span>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              {/* Bottom Message Input bar */}
              <div className="border-t border-border/60 p-2.5 sm:p-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileAttach}
                  className="hidden"
                />

                {isRecording ? (
                  /* Live voice recording state */
                  <div className="flex items-center justify-between rounded-full bg-rose-500/10 border border-rose-500/30 px-4 py-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                      </span>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        Recording audio... {recordDuration}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelVoiceRecording}
                        className="px-3 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-xs font-semibold text-muted-foreground transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={sendVoiceNote}
                        className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="h-3 w-3" /> Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-foreground/5 px-2.5 sm:px-3 py-1.5 sm:py-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach image or file"
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:text-brand min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder={`Message ${partner.display_name.split(" ")[0]}...`}
                      className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => startVoiceRecording()}
                      title="Record voice note"
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:text-rose-500 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((p) => p + " ✨")}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:text-brand min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                    <button
                      onClick={send}
                      disabled={!draft.trim() || sending}
                      aria-label="Send message"
                      className="grid h-9 w-9 min-w-[36px] place-items-center rounded-full bg-gradient-to-r from-brand to-brand-pink text-white transition-all duration-300 hover:shadow-glow disabled:opacity-40 active:scale-95 shrink-0 cursor-pointer"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Direct Message Modal */}
      {showNewMsgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">New Message</h3>
              <button
                onClick={() => setShowNewMsgModal(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={newMsgQuery}
                onChange={(e) => setNewMsgQuery(e.target.value)}
                placeholder="Search creators & collaborators..."
                className="w-full rounded-2xl bg-muted/40 border border-border pl-9 pr-4 py-2.5 text-xs sm:text-sm outline-none focus:border-brand"
                autoFocus
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto [scrollbar-width:thin]">
              <p className="text-[11px] font-bold uppercase text-muted-foreground px-1">Suggested Creators</p>
              {filteredStartUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => startChatWithUser(user)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-muted/50 transition-colors text-left cursor-pointer"
                >
                  <Avatar name={user.display_name} className="h-10 w-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold truncate">{user.display_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">@{user.username} • {user.bio}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-brand/10 text-brand text-[11px] font-bold">Chat</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call Modal */}
      {activeCall && (
        <CallModal
          partner={activeCall.user}
          type={activeCall.type}
          isOpen={Boolean(activeCall)}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Tip Modal */}
      {showTipModal && partner && (
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          recipient={partner}
        />
      )}

      {/* Conversation Info Modal */}
      <InfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        type="Privacy"
      />
    </AppShell>
  );
}
