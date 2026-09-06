import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, Video, Smile, MapPin, Sparkles, Loader2, X, Palette, BarChart2, Plus, Trash2, Hash } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/social/Avatar";
import type { Post, Poll } from "@/lib/types";
import { currentUser } from "@/lib/profile-service";
import { createPost, uploadMedia } from "@/lib/api-client";
import { AiDraftModal } from "@/components/social/AiDraftModal";
import { useAuth } from "@/lib/auth-state";
import { cn } from "@/lib/utils";

const LIMIT = 1000;

const sampleLocations = ["San Francisco, CA", "New York, NY", "Tokyo, Japan", "Berlin, DE", "Design Studio Loft", "Remote 🌿"];
const popularEmojis = ["✨", "🚀", "💡", "🎨", "❤️", "🔥", "🙌", "🌊", "☕", "🧠", "🎯", "⚡"];
const popularHashtags = ["design", "build", "tech", "creators", "photography", "ai", "webdev", "minimalism", "art", "music", "startup", "inspiration"];

const gradientThemes = [
  { name: "Neon Sunset", value: "from-fuchsia-600 via-pink-600 to-amber-500" },
  { name: "Electric Cyan", value: "from-cyan-500 via-blue-600 to-indigo-600" },
  { name: "Aurora Green", value: "from-emerald-500 via-teal-600 to-cyan-700" },
  { name: "Violet Dusk", value: "from-violet-600 via-purple-600 to-pink-500" },
];

export function Composer({
  onPost,
  placeholder = "What's lighting you up today?",
  compact = false,
}: {
  onPost?: (created: Post) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const activeUser = user || currentUser;
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedGradient, setSelectedGradient] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Hashtags
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [showHashtagPicker, setShowHashtagPicker] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  // Popover controls
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showGradientPicker, setShowGradientPicker] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and scroll to composer on trigger or URL param
  useEffect(() => {
    function handleTrigger() {
      setFocused(true);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }

    if (typeof window !== "undefined") {
      if (window.location.search.includes("compose=true") || window.location.hash === "#compose") {
        handleTrigger();
      }
      window.addEventListener("spaces:trigger_compose", handleTrigger);
      window.addEventListener("spaces:trigger_compose", handleTrigger);
      return () => {
        window.removeEventListener("spaces:trigger_compose", handleTrigger);
        window.removeEventListener("spaces:trigger_compose", handleTrigger);
      };
    }
  }, []);

  const remaining = LIMIT - draft.length;
  const pct = Math.min(draft.length / LIMIT, 1);
  const hasValidPoll = showPollBuilder && pollOptions.filter((o) => o.trim()).length >= 2;
  const canPost = (draft.trim().length > 0 || attachedImage || selectedGradient || hasValidPoll || customTags.length > 0) && remaining >= 0 && !posting;

  function handleAddTag(tagRaw: string) {
    const clean = tagRaw.trim().replace(/^#+/, "").toLowerCase();
    if (!clean) return;
    if (!customTags.includes(clean)) {
      setCustomTags((prev) => [...prev, clean]);
    }
    setCustomTagInput("");
  }

  function handleRemoveTag(tagToRemove: string) {
    setCustomTags((prev) => prev.filter((t) => t !== tagToRemove));
  }

  function handleToggleTag(tag: string) {
    if (customTags.includes(tag)) {
      handleRemoveTag(tag);
    } else {
      handleAddTag(tag);
    }
  }

  async function handleMediaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    setUploadingImage(true);
    try {
      const res = await uploadMedia(file, "posts");
      setAttachedImage(res.url);
      setSelectedGradient(null);
      toast.success(isVideo ? "Video attached" : "Image attached");
    } catch (err) {
      console.warn("Upload fallback preview:", err);
      const previewUrl = URL.createObjectURL(file);
      setAttachedImage(previewUrl);
      setSelectedGradient(null);
      toast.success(isVideo ? "Video attached" : "Image attached");
    } finally {
      setUploadingImage(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    setPosting(true);

    try {
      const rawContent = draft.trim();
      const contentWithLocation = selectedLocation
        ? `${rawContent}\n📍 ${selectedLocation}`
        : rawContent;

      let pollData: Poll | undefined;
      if (showPollBuilder && pollOptions.filter((o) => o.trim()).length >= 2) {
        pollData = {
          id: `poll_${Date.now()}`,
          question: pollQuestion.trim() || rawContent,
          options: pollOptions
            .filter((o) => o.trim())
            .map((text, idx) => ({
              id: `opt_${Date.now()}_${idx}`,
              text: text.trim(),
              votes: 0,
              votedByMe: false,
            })),
          totalVotes: 0,
          closed: false,
        };
      }

      const created = await createPost({
        content: contentWithLocation,
        image_gradient: selectedGradient || undefined,
        media_url: attachedImage || undefined,
        tags: customTags,
        poll: pollData,
      });

      setDraft("");
      setSelectedGradient(null);
      setSelectedLocation(null);
      setAttachedImage(null);
      setCustomTags([]);
      setShowHashtagPicker(false);
      setShowEmojiPicker(false);
      setShowLocationPicker(false);
      setShowGradientPicker(false);
      setShowPollBuilder(false);
      setPollQuestion("");
      setPollOptions(["", ""]);

      onPost?.(created.post);
      toast.success("Published to your feed!");
    } catch (err: any) {
      console.error("Failed to post:", err);
      toast.error("Failed to post: " + (err.message || "Please try again"));
    } finally {
      setPosting(false);
    }
  }

  function handleInsertEmoji(emoji: string) {
    setDraft((prev) => prev + emoji);
  }

  function handleAiSelect(content: string) {
    setDraft(content);
    setFocused(true);
    toast.success("AI draft inserted!");
  }

  return (
    <>
      <form
        id="feed-composer"
        onSubmit={submit}
        className={cn(
          "glass-panel rounded-3xl p-3.5 sm:p-5 transition-all duration-500 relative",
          focused ? "shadow-lift ring-1 ring-brand/25" : "shadow-soft",
          compact && "p-3 sm:p-4"
        )}
      >
        <div className="flex gap-2.5 sm:gap-3">
          <Avatar name={activeUser.display_name} src={activeUser.avatar_url} className="h-9 w-9 sm:h-11 sm:w-11 text-xs shrink-0" />
          <div className="min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setFocused(true)}
              rows={focused || draft || attachedImage || selectedGradient ? 3 : 1}
              placeholder={placeholder}
              className="w-full resize-none bg-transparent text-sm sm:text-[1.05rem] leading-relaxed placeholder:text-muted-foreground focus:outline-none min-h-[60px]"
            />

            {/* Attached Hashtag Chips */}
            {customTags.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 animate-in fade-in">
                {customTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-foreground ml-0.5 text-primary/70 hover:text-primary transition-colors cursor-pointer"
                      title={`Remove #${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Attached Media Preview (Image or Video) */}
            {attachedImage && (
              <div className="relative mt-3 h-52 sm:h-60 w-full overflow-hidden rounded-2xl border border-border/75 bg-neutral-950 shadow-inner group flex items-center justify-center p-2 backdrop-blur-xs">
                {attachedImage.includes(".mp4") || attachedImage.includes(".webm") || attachedImage.includes(".mov") || attachedImage.startsWith("data:video") ? (
                  <video
                    src={attachedImage}
                    controls
                    playsInline
                    className="relative z-10 h-full w-full max-w-full rounded-xl object-cover shadow-md"
                  />
                ) : (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-15 blur-xl pointer-events-none scale-110"
                      style={{ backgroundImage: `url(${attachedImage})` }}
                    />
                    <img
                      src={attachedImage}
                      alt="Post attachment"
                      className="relative z-10 h-full w-auto max-w-full rounded-xl object-contain shadow-md transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                  </>
                )}
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white/90 shadow-xs">
                  {attachedImage.includes(".mp4") || attachedImage.includes(".webm") || attachedImage.includes(".mov") || attachedImage.startsWith("data:video") ? (
                    <>
                      <Video className="h-3 w-3 text-brand" /> Attached Video
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-3 w-3 text-brand" /> Attached Media
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="absolute top-2.5 right-2.5 z-20 rounded-full bg-black/60 backdrop-blur-md p-1.5 text-white/90 hover:bg-black/85 hover:text-white transition-all shadow-xs cursor-pointer active:scale-90"
                  title="Remove media"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {selectedGradient && !attachedImage && (
              <div className="relative mt-2 h-24 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center p-3 text-white text-xs font-bold">
                <div className={cn("absolute inset-0 bg-gradient-to-r", selectedGradient)} />
                <span className="relative z-10 drop-shadow-md">Gradient visual theme active</span>
                <button
                  type="button"
                  onClick={() => setSelectedGradient(null)}
                  className="absolute top-2 right-2 z-20 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Location Pill */}
            {selectedLocation && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                <MapPin className="h-3 w-3" />
                <span>{selectedLocation}</span>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(null)}
                  className="hover:text-foreground ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Hashtag Picker Panel */}
            {showHashtagPicker && (
              <div className="mt-2 p-3.5 rounded-2xl bg-foreground/[0.04] border border-border/80 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-brand" /> Add Hashtags
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHashtagPicker(false)}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">#</span>
                    <input
                      type="text"
                      placeholder="Type custom hashtag..."
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag(customTagInput);
                        }
                      }}
                      className="w-full rounded-xl bg-card border border-border pl-7 pr-3 py-1.5 text-xs outline-none focus:border-brand"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTag(customTagInput)}
                    disabled={!customTagInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Add
                  </button>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Popular topics</p>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {popularHashtags.map((tag) => {
                      const isSelected = customTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                            isSelected
                              ? "bg-brand text-white shadow-xs font-semibold"
                              : "bg-card border border-border/80 text-foreground/80 hover:border-brand/40 hover:text-brand"
                          )}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Popover Panels */}
            {showEmojiPicker && (
              <div className="mt-2 p-3 rounded-2xl bg-foreground/5 border border-border/80 flex flex-wrap gap-2 animate-in fade-in">
                {popularEmojis.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleInsertEmoji(em)}
                    className="h-8 w-8 rounded-xl hover:bg-foreground/10 text-lg grid place-items-center transition-transform hover:scale-110 active:scale-95"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {showLocationPicker && (
              <div className="mt-2 p-3 rounded-2xl bg-foreground/5 border border-border/80 flex flex-wrap gap-1.5 animate-in fade-in">
                {sampleLocations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setSelectedLocation(loc);
                      setShowLocationPicker(false);
                    }}
                    className="rounded-full bg-card px-3 py-1 text-xs font-semibold hover:border-brand/40 border border-border transition-all active:scale-95"
                  >
                    📍 {loc}
                  </button>
                ))}
              </div>
            )}

            {showGradientPicker && (
              <div className="mt-2 p-3 rounded-2xl bg-foreground/5 border border-border/80 grid grid-cols-2 gap-2 animate-in fade-in">
                {gradientThemes.map((theme) => (
                  <button
                    key={theme.name}
                    type="button"
                    onClick={() => {
                      setSelectedGradient(theme.value);
                      setAttachedImage(null);
                      setShowGradientPicker(false);
                    }}
                    className={cn(
                      "h-10 rounded-xl bg-gradient-to-r p-2 text-left text-xs font-bold text-white shadow-xs transition-transform hover:scale-[1.02] active:scale-95",
                      theme.value
                    )}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            )}

            {/* Poll Builder Panel */}
            {showPollBuilder && (
              <div className="mt-3 p-4 rounded-2xl bg-foreground/[0.04] border border-border/80 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <BarChart2 className="h-4 w-4 text-brand" /> Create a Poll
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPollBuilder(false)}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPollOptions((prev) => {
                            const copy = [...prev];
                            copy[idx] = val;
                            return copy;
                          });
                        }}
                        className="flex-1 rounded-xl bg-card border border-border px-3 py-2 text-xs outline-none focus:border-brand"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-muted-foreground hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => [...prev, ""])}
                    className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline pt-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another option
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center gap-0.5 sm:gap-1 text-brand overflow-x-auto [scrollbar-width:none] touch-pan-x py-0.5">
                {/* Media upload button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleMediaFile}
                />
                <button
                  type="button"
                  title="Attach photo or video"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full p-2 transition-all duration-200 hover:bg-brand/10 active:scale-90 min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-[1.1rem] w-[1.1rem] animate-spin" />
                  ) : (
                    <ImageIcon className="h-[1.1rem] w-[1.1rem]" />
                  )}
                </button>

                {/* Hashtag adder button */}
                <button
                  type="button"
                  title="Add hashtags"
                  onClick={() => {
                    setShowHashtagPicker(!showHashtagPicker);
                    setShowEmojiPicker(false);
                    setShowLocationPicker(false);
                    setShowGradientPicker(false);
                    setShowPollBuilder(false);
                  }}
                  className={cn(
                    "rounded-full p-2 transition-all duration-200 hover:bg-brand/10 active:scale-90 min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0",
                    (showHashtagPicker || customTags.length > 0) && "bg-brand/15 text-brand"
                  )}
                >
                  <Hash className="h-[1.1rem] w-[1.1rem]" />
                </button>

                {/* Poll creator */}
                <button
                  type="button"
                  title="Create a poll"
                  onClick={() => {
                    setShowPollBuilder(!showPollBuilder);
                    setShowHashtagPicker(false);
                    setShowEmojiPicker(false);
                    setShowLocationPicker(false);
                    setShowGradientPicker(false);
                  }}
                  className={cn(
                    "rounded-full p-2 transition-all duration-200 hover:bg-brand/10 active:scale-90 min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0",
                    showPollBuilder && "bg-brand/15 text-brand"
                  )}
                >
                  <BarChart2 className="h-[1.1rem] w-[1.1rem]" />
                </button>

                {/* Gradient themes */}
                <button
                  type="button"
                  title="Gradient visual theme"
                  onClick={() => {
                    setShowGradientPicker(!showGradientPicker);
                    setShowHashtagPicker(false);
                    setShowEmojiPicker(false);
                    setShowLocationPicker(false);
                  }}
                  className="rounded-full p-2 transition-all duration-200 hover:bg-brand/10 active:scale-90 min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                >
                  <Palette className="h-[1.1rem] w-[1.1rem]" />
                </button>

                {/* Emoji picker */}
                <button
                  type="button"
                  title="Add emoji"
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowHashtagPicker(false);
                    setShowLocationPicker(false);
                    setShowGradientPicker(false);
                  }}
                  className="rounded-full p-2 transition-all duration-200 hover:bg-brand/10 active:scale-90 min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                >
                  <Smile className="h-[1.1rem] w-[1.1rem]" />
                </button>

                {/* Location picker */}
                <button
                  type="button"
                  title="Add location tag"
                  onClick={() => {
                    setShowLocationPicker(!showLocationPicker);
                    setShowHashtagPicker(false);
                    setShowEmojiPicker(false);
                    setShowGradientPicker(false);
                  }}
                  className="rounded-full p-2 transition-all duration-200 hover:bg-brand/10 active:scale-90 min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                >
                  <MapPin className="h-[1.1rem] w-[1.1rem]" />
                </button>

                {/* AI draft assistant */}
                <button
                  type="button"
                  title="AI Spark Assistant"
                  onClick={() => setShowAiModal(true)}
                  className="rounded-full p-2 transition-all duration-200 hover:bg-brand/10 active:scale-90 text-brand min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                >
                  <Sparkles className="h-[1.1rem] w-[1.1rem]" />
                </button>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3 ml-auto shrink-0">
                {draft.length > 0 && (
                  <div className="relative h-7 w-7">
                    <svg viewBox="0 0 36 36" className="h-7 w-7 -rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        strokeWidth="3"
                        className="stroke-border"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${pct * 94.2} 94.2`}
                        className={cn(
                          "transition-all duration-300",
                          remaining < 0
                            ? "stroke-destructive"
                            : remaining < 100
                              ? "stroke-amber-500"
                              : "stroke-brand"
                        )}
                      />
                    </svg>
                    {remaining < 100 && (
                      <span
                        className={cn(
                          "absolute inset-0 flex items-center justify-center text-[0.6rem] font-bold tabular-nums",
                          remaining < 0 ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {remaining}
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!canPost}
                  className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-gradient-to-r from-brand to-brand-pink px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white transition-all duration-300 hover:shadow-glow hover:brightness-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none min-h-[38px] sm:min-h-[42px]"
                >
                  {posting && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />}
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* AI Assistant Modal */}
      <AiDraftModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSelectDraft={handleAiSelect}
        currentDraft={draft}
      />
    </>
  );
}

