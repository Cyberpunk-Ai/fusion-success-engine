/**
 * Data access layer for the Spaces app. All calls go through the Lovable Cloud
 * backend (Supabase) with defensive mapping so the UI keeps working while the
 * schema evolves.
 */
import { supabase } from "@/integrations/supabase/client";
import { cacheProfiles, currentUser, currentUserId, rowToProfile } from "@/lib/profile-service";
import { emitRealtime } from "@/lib/realtime";
import { appConfig } from "@/lib/config";
import type {
  AdminCharts,
  AdminOverviewData,
  AuditLog,
  Conversation,
  Message,
  ModerationReport,
  Notification,
  Post,
  PostComment,
  Profile,
  Space,
  Story,
  SystemSettings,
  Topic,
  TrendingTag,
  UserFeedPreferences,
  FeedFeedbackPayload,
} from "@/lib/types";

const db = supabase as any;

function nowIso() {
  return new Date().toISOString();
}

function me() {
  return currentUserId || currentUser.id;
}

/* ------------------------------------------------------------------ posts */

export function rowToPost(row: any, extras: Partial<Post> = {}): Post {
  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content ?? "",
    image_gradient: row.image_gradient ?? null,
    media_url: row.media_url ?? null,
    image_url: row.image_url ?? null,
    tags: row.tags ?? [],
    created_at: row.created_at ?? nowIso(),
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    repostCount: row.repost_count ?? 0,
    viewCount: row.view_count ?? 0,
    poll: row.poll ?? null,
    ...extras,
  };
}

export async function getPosts(
  options: {
    limit?: number;
    userId?: string;
    /** Alias of `userId`, kept for call sites that speak in author terms. */
    authorId?: string;
    tag?: string;
    before?: string;
    following?: boolean;
    bookmarked?: boolean;
    filter?: "foryou" | "following" | "latest";
  } = {},
): Promise<Post[]> {
  if (options.bookmarked) return getBookmarkedPosts(options.limit ?? 50);
  if (options.filter === "following") options = { ...options, following: true };
  if (options.authorId) options = { ...options, userId: options.authorId };
  const limit = Math.min(options.limit ?? appConfig.feed.pageSize, appConfig.feed.maxPageSize);
  let query = db
    .from("posts")
    .select("*")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.userId) query = query.eq("user_id", options.userId);
  if (options.before) query = query.lt("created_at", options.before);
  if (options.tag) query = query.contains("tags", [options.tag]);
  if (options.following) {
    const { data: follows } = await db.from("follows").select("target_id").eq("follower_id", me());
    const ids = ((follows ?? []) as any[]).map((f) => f.target_id);
    if (ids.length === 0) return [];
    query = query.in("user_id", [...ids, me()]);
  }
  const { data, error } = await query;
  if (error) throw error;
  const posts = (data ?? []).map((row: any) => rowToPost(row));
  await hydrateAuthors(posts.map((p: Post) => p.user_id));
  await hydrateEngagement(posts);
  return posts;
}

/** Posts the signed-in user has bookmarked, fetched by join instead of client filtering. */
export async function getBookmarkedPosts(limit = 50): Promise<Post[]> {
  const { data } = await db
    .from("bookmarks")
    .select("post_id, created_at, posts(*)")
    .eq("user_id", me())
    .order("created_at", { ascending: false })
    .limit(limit);
  const posts = ((data ?? []) as any[])
    .map((row) => (row.posts ? rowToPost(row.posts) : null))
    .filter(Boolean) as Post[];
  await hydrateAuthors(posts.map((p) => p.user_id));
  await hydrateEngagement(posts);
  return posts;
}

/** Stamp each post with the signed-in user's like/repost/bookmark state. */
async function hydrateEngagement(posts: Post[]) {
  const userId = me();
  if (!userId || userId === "guest" || posts.length === 0) return;
  const ids = posts.map((p) => p.id);
  const { liked, reposted, bookmarked } = await getMyEngagement(ids);
  const likedSet = new Set(liked);
  const repostedSet = new Set(reposted);
  const savedSet = new Set(bookmarked);
  for (const post of posts) {
    post.likedByMe = likedSet.has(post.id);
    post.repostedByMe = repostedSet.has(post.id);
    post.bookmarkedByMe = savedSet.has(post.id);
  }
}

async function hydrateAuthors(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return;
  const { data } = await db.from("profiles").select("*").in("id", unique);
  if (data) cacheProfiles((data as any[]).map(rowToProfile));
}

export async function createPost(input: {
  content: string;
  image_gradient?: string | undefined;
  media_url?: string | undefined;
  tags?: string[];
  poll?: any;
}) {
  const payload = {
    user_id: me(),
    content: input.content,
    image_gradient: input.image_gradient ?? null,
    media_url: input.media_url ?? null,
    tags: input.tags ?? [],
    poll: input.poll ?? null,
  };
  const { data, error } = await db.from("posts").insert(payload).select("*").single();
  if (error) throw error;
  const post = rowToPost(data);
  emitRealtime("post:created", post);
  return { ...post, post } as Post & { post: Post };
}

export async function deletePost(id: string) {
  const { error } = await db.from("posts").delete().eq("id", id);
  if (error) throw error;
  emitRealtime("post:deleted", { id });
  return { ok: true };
}

async function toggleRelation(table: string, postId: string, event: string, countField: string) {
  const userId = me();
  if (!userId || userId === "guest") throw new Error("Sign in to interact with posts");
  const { data: existing } = await db
    .from(table)
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await db.from(table).delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    const { error } = await db.from(table).insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }

  const { count } = await db
    .from(table)
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);

  const result = { active: !existing, count: count ?? 0 };
  emitRealtime(event, { id: postId, postId, [countField]: result.count, active: result.active });
  return result;
}

export async function toggleLikePost(postId: string) {
  const { active, count } = await toggleRelation("likes", postId, "post_like_updated", "likeCount");
  return { liked: active, likeCount: count, likesCount: count };
}

export async function toggleRepostPost(postId: string) {
  const { active, count } = await toggleRelation("reposts", postId, "post_repost_updated", "repostCount");
  return { reposted: active, repostCount: count };
}

export async function toggleBookmarkPost(postId: string) {
  const { active } = await toggleRelation("bookmarks", postId, "post:bookmarked", "bookmarkCount");
  return { bookmarked: active };
}

export async function getMyEngagement(postIds: string[]) {
  const userId = me();
  if (!userId || postIds.length === 0) return { liked: [], reposted: [], bookmarked: [] };
  const [likes, reposts, bookmarks] = await Promise.all([
    db.from("likes").select("post_id").eq("user_id", userId).in("post_id", postIds),
    db.from("reposts").select("post_id").eq("user_id", userId).in("post_id", postIds),
    db.from("bookmarks").select("post_id").eq("user_id", userId).in("post_id", postIds),
  ]);
  const ids = (r: any) => ((r.data ?? []) as any[]).map((x) => String(x.post_id));
  return { liked: ids(likes), reposted: ids(reposts), bookmarked: ids(bookmarks) };
}


export async function addPostComment(postId: string, content: string) {
  if (!me() || me() === "guest") throw new Error("Sign in to comment");
  const { data, error } = await db
    .from("comments")
    .insert({ post_id: postId, user_id: me(), content })
    .select("*")
    .single();
  if (error) throw error;
  const comment: PostComment = {
    id: data.id,
    post_id: data.post_id,
    user_id: data.user_id,
    content: data.content,
    created_at: data.created_at,
  };
  const { count } = await db
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  emitRealtime("new_comment", { postId, data: { ...comment, post_id: postId }, commentCount: count ?? 0 });
  return { comment, commentCount: count ?? 0 };
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const { data } = await db
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data ?? []) as PostComment[];
}

export async function votePoll(postId: string, optionId: string) {
  const userId = me();
  if (!userId || userId === "guest") throw new Error("Sign in to vote");
  const { data: prior } = await db
    .from("poll_votes")
    .select("option_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (prior) throw new Error("You already voted in this poll");
  const { error: voteError } = await db
    .from("poll_votes")
    .insert({ post_id: postId, option_id: optionId, user_id: userId });
  if (voteError) throw voteError;
  const { data } = await db.from("posts").select("poll").eq("id", postId).maybeSingle();
  const poll = data?.poll ?? null;
  if (poll?.options) {
    poll.options = poll.options.map((o: any) =>
      o.id === optionId ? { ...o, votes: (o.votes ?? 0) + 1, votedByMe: true } : o,
    );
    poll.totalVotes = (poll.totalVotes ?? 0) + 1;
    poll.hasVoted = true;
    poll.userVotedOptionId = optionId;
    await db.from("posts").update({ poll }).eq("id", postId);
  }
  emitRealtime("post:poll", { id: postId, poll });
  emitRealtime("poll_updated", { postId, poll });
  return { poll };
}

export async function recordPostImpression(postId: string) {
  const userId = me();
  const viewer = userId && userId !== "guest" ? userId : null;
  try {
    if (viewer) {
      const { data: seen } = await db
        .from("post_impressions")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", viewer)
        .maybeSingle();
      if (!seen) await db.from("post_impressions").insert({ post_id: postId, user_id: viewer });
    } else {
      await db.from("post_impressions").insert({ post_id: postId, user_id: null });
    }
  } catch {
    /* impressions are best-effort */
  }
  const { count } = await db
    .from("post_impressions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  const viewCount = count ?? 0;
  emitRealtime("post_view_updated", { postId, viewCount });
  return { viewCount };
}

/* ---------------------------------------------------------------- stories */

function rowToStory(row: any): Story {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type ?? (row.media_url ? "image" : "gradient"),
    gradient: row.gradient ?? undefined,
    media_url: row.media_url ?? undefined,
    image_url: row.media_url ?? undefined,
    text: row.text ?? undefined,
    caption: row.caption ?? undefined,
    created_at: row.created_at ?? nowIso(),
    expires_at: row.expires_at ?? nowIso(),
    view_count: row.view_count ?? 0,
    likes_count: row.likes_count ?? 0,
    location: row.location ?? undefined,
    mood: row.mood ?? undefined,
    stickers: row.stickers ?? [],
  };
}

export async function getStories(): Promise<Story[]> {
  const { data } = await db.from("stories").select("*").order("created_at", { ascending: false });
  const stories = (data ?? []).map(rowToStory);
  await hydrateAuthors(stories.map((s: Story) => s.user_id));
  return stories;
}

export async function createStory(input: {
  text?: string;
  gradient?: string;
  media_url?: string | null;
  location?: string | undefined;
  mood?: string | undefined;
  stickers?: any[];
}) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("stories")
    .insert({
      user_id: me(),
      text: input.text ?? null,
      gradient: input.gradient ?? null,
      media_url: input.media_url ?? null,
      location: input.location ?? null,
      mood: input.mood ?? null,
      stickers: input.stickers ?? [],
      type: input.media_url ? "image" : "gradient",
      expires_at: expires,
    })
    .select("*")
    .single();
  if (error) throw error;
  const story = rowToStory(data);
  emitRealtime("story:created", story);
  return { story };
}

export async function deleteStory(id: string) {
  const { error } = await db.from("stories").delete().eq("id", id);
  if (error) throw error;
  emitRealtime("story:deleted", { id });
  return { ok: true };
}

export async function toggleLikeStory(storyId: string) {
  const userId = me();
  if (!userId || userId === "guest") throw new Error("Sign in to like stories");
  const { data: existing } = await db
    .from("story_likes")
    .select("story_id")
    .eq("story_id", storyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing)
    await db.from("story_likes").delete().eq("story_id", storyId).eq("user_id", userId);
  else await db.from("story_likes").insert({ story_id: storyId, user_id: userId });

  const { count } = await db
    .from("story_likes")
    .select("story_id", { count: "exact", head: true })
    .eq("story_id", storyId);
  emitRealtime("story_like_updated", { storyId, liked: !existing, likesCount: count ?? 0 });
  return { liked: !existing, likesCount: count ?? 0 };
}

/* --------------------------------------------------------------- profiles */

export async function getUsers(): Promise<{ profiles: Profile[] }> {
  const { data } = await db.from("profiles").select("*").limit(50);
  const profiles = (data ?? []).map(rowToProfile);
  cacheProfiles(profiles);
  return { profiles };
}

export async function updateUserProfile(patch: Partial<Profile>) {
  const { data, error } = await db
    .from("profiles")
    .update({
      display_name: patch.display_name,
      bio: patch.bio,
      location: patch.location,
      website: patch.website,
      avatar_url: patch.avatar_url,
    })
    .eq("id", me())
    .select("*")
    .maybeSingle();
  if (error) throw error;
  const user = data ? rowToProfile(data) : ({ ...currentUser, ...patch } as Profile);
  emitRealtime("profile:updated", user);
  return { user };
}

export async function toggleFollowUser(targetUserId: string) {
  const userId = me();
  if (!userId || userId === "guest") throw new Error("Sign in to follow people");
  if (userId === targetUserId) throw new Error("You cannot follow yourself");

  const { data: existing } = await db
    .from("follows")
    .select("follower_id")
    .eq("follower_id", userId)
    .eq("target_id", targetUserId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("target_id", targetUserId);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("follows")
      .insert({ follower_id: userId, target_id: targetUserId });
    if (error) throw error;
  }

  const { count } = await db
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("target_id", targetUserId);

  const following = !existing;
  emitRealtime("follow_updated", { targetUserId, following, followers: count ?? 0 });
  return { following, followers: count ?? 0 };
}

/** Is the signed-in profile following this user? */
export async function isFollowing(targetUserId: string): Promise<boolean> {
  const userId = me();
  if (!userId || userId === "guest" || !targetUserId) return false;
  const { data } = await db
    .from("follows")
    .select("follower_id")
    .eq("follower_id", userId)
    .eq("target_id", targetUserId)
    .maybeSingle();
  return Boolean(data);
}

/** Ids the signed-in profile follows (used to pre-fill follow buttons). */
export async function getFollowingIds(): Promise<string[]> {
  const userId = me();
  if (!userId || userId === "guest") return [];
  const { data } = await db.from("follows").select("target_id").eq("follower_id", userId);
  return ((data ?? []) as any[]).map((r) => String(r.target_id));
}

export async function uploadMedia(file: File, folder: "avatars" | "posts" | "stories" | "media" | "messages" = "media") {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${me()}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/* ----------------------------------------------------------------- spaces */

function rowToSpace(row: any): Space {
  return {
    id: row.id,
    title: row.title,
    host_id: row.host_id,
    host_name: row.host_name ?? undefined,
    topic: row.topic ?? "General",
    listeners: row.listeners ?? 0,
    live: row.live ?? false,
    is_live: row.live ?? false,
    gradient: row.gradient ?? "from-brand to-brand-pink",
    recorded: row.recorded ?? false,
    duration: row.duration ?? undefined,
    recording_url: row.recording_url ?? undefined,
    participants: row.participants ?? [],
    messages: row.messages ?? [],
  };
}

export async function getSpaces(): Promise<{ spaces: Space[] }> {
  const { data } = await db.from("spaces").select("*").order("created_at", { ascending: false });
  return { spaces: (data ?? []).map(rowToSpace) };
}

/** Start a new live audio room hosted by the signed-in profile. */
export async function createSpace(input: { title: string; topic: string; gradient?: string }) {
  const id = `space_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await db
    .from("spaces")
    .insert({
      id,
      title: input.title,
      topic: input.topic,
      host_id: me(),
      gradient: input.gradient ?? "from-brand to-brand-pink",
      live: true,
      listeners: 1,
    })
    .select("*")
    .single();
  if (error) throw error;
  await db.from("space_participants").insert({ space_id: id, user_id: me(), role: "host" });
  emitRealtime("space:created", data);
  return data as any;
}

export async function joinSpace(spaceId: string) {
  await db.from("space_participants").upsert({ space_id: spaceId, user_id: me(), role: "listener" });
  emitRealtime("space:joined", { spaceId, userId: me() });
  return { ok: true };
}

export async function leaveSpace(spaceId: string) {
  await db.from("space_participants").delete().eq("space_id", spaceId).eq("user_id", me());
  emitRealtime("space:left", { spaceId, userId: me() });
  return { ok: true };
}

export async function toggleHandRaised(spaceId: string, raised: boolean) {
  await db
    .from("space_participants")
    .update({ hand_raised: raised })
    .eq("space_id", spaceId)
    .eq("user_id", me());
  emitRealtime("space:hand", { spaceId, userId: me(), raised });
  return { handRaised: raised };
}

export async function toggleSpeaking(spaceId: string, speaking: boolean, muted: boolean) {
  await db
    .from("space_participants")
    .update({ is_speaking: speaking, is_muted: muted })
    .eq("space_id", spaceId)
    .eq("user_id", me());
  emitRealtime("space:speaking", { spaceId, userId: me(), speaking, muted });
  return { speaking, muted };
}

export async function sendSpaceMessage(spaceId: string, body: string) {
  const message = {
    id: `sm_${Date.now()}`,
    userId: me(),
    name: currentUser.display_name,
    body,
    createdAt: nowIso(),
  };
  try {
    await db.from("space_messages").insert({ space_id: spaceId, user_id: me(), body });
  } catch {
    /* best effort */
  }
  emitRealtime("space:message", { spaceId, message });
  return { message };
}

export async function terminateSpaceAdmin(spaceId: string, actorId: string) {
  await db.from("spaces").update({ live: false }).eq("id", spaceId);
  await logAudit(actorId, "space.terminate", "space", spaceId, "Space terminated by admin", "danger");
  emitRealtime("space:terminated", { id: spaceId });
  return { ok: true };
}

/* ------------------------------------------------------------------- chat */

export async function getConversations(): Promise<Conversation[]> {
  const userId = me();
  const { data } = await db
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as any[];
  await hydrateAuthors(rows.flatMap((r) => [r.user_a, r.user_b]));
  const { data: unreadRows } = await db
    .from("messages")
    .select("conversation_id")
    .is("read_at", null)
    .neq("sender_id", userId)
    .in("conversation_id", rows.map((r) => r.id));
  const unreadByConversation = new Map<string, number>();
  for (const row of (unreadRows ?? []) as any[]) {
    const key = String(row.conversation_id);
    unreadByConversation.set(key, (unreadByConversation.get(key) ?? 0) + 1);
  }
  return rows.map((row: any) => ({
    id: row.id,
    participant_id: row.user_a === userId ? row.user_b : row.user_a,
    preview: row.preview ?? "",
    unread: unreadByConversation.get(String(row.id)) ?? 0,
    online: false,
    updated_at: row.updated_at ?? nowIso(),
  }));
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  await db
    .from("messages")
    .update({ read_at: nowIso() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", me())
    .is("read_at", null);
  return (data ?? []) as Message[];
}

export async function getOrCreateConversation(participantId: string): Promise<string> {
  const userId = me();
  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .or(
      `and(user_a.eq.${userId},user_b.eq.${participantId}),and(user_a.eq.${participantId},user_b.eq.${userId})`,
    )
    .maybeSingle();
  if (existing?.id) return String(existing.id);
  const { data, error } = await db
    .from("conversations")
    .insert({ user_a: userId, user_b: participantId, preview: "" })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function sendMessage(target: string, body: string, mediaUrl?: string | null) {
  const isConversation = /^[0-9a-f]{8}-/i.test(target);
  const conversationId = isConversation ? target : await getOrCreateConversation(target);
  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: me(), body, media_url: mediaUrl ?? null })
    .select("*")
    .single();
  if (error) throw error;
  await db
    .from("conversations")
    .update({ preview: body.slice(0, 120), updated_at: nowIso() })
    .eq("id", conversationId);
  emitRealtime("message:created", data);
  return { message: data as Message, conversationId };
}


export async function getNotifications(): Promise<Notification[]> {
  const { data } = await db
    .from("notifications")
    .select("*")
    .eq("recipient_id", me())
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Notification[];
}

export async function markNotificationsRead() {
  await db.from("notifications").update({ read: true }).eq("recipient_id", me());
  emitRealtime("notification:read", {});
  return { ok: true };
}

/* --------------------------------------------------------- feed & tuning */

export async function getFeedPreferences(): Promise<{ preferences: UserFeedPreferences }> {
  const { data } = await db.from("feed_preferences").select("*").eq("user_id", me()).maybeSingle();
  return { preferences: (data?.prefs ?? {}) as UserFeedPreferences };
}

export async function updateFeedPreferences(patch: Partial<UserFeedPreferences>) {
  const { preferences } = await getFeedPreferences();
  const merged = { ...preferences, ...patch };
  await db.from("feed_preferences").upsert({ user_id: me(), prefs: merged });
  return { preferences: merged as UserFeedPreferences };
}

export async function sendFeedFeedback(payload: FeedFeedbackPayload) {
  const { preferences } = await getFeedPreferences();
  const next: UserFeedPreferences = { ...preferences };
  const action = payload.action ?? payload.signal;
  if (action === "interested" && payload.tag) {
    next.preferredTags = Array.from(new Set([...(next.preferredTags ?? []), payload.tag]));
  }
  if ((action === "not_interested" || action === "hide_tag") && payload.tag) {
    next.mutedTags = Array.from(new Set([...(next.mutedTags ?? []), payload.tag]));
  }
  if (action === "mute_author" && payload.authorId) {
    next.mutedAuthors = Array.from(new Set([...(next.mutedAuthors ?? []), payload.authorId]));
  }
  await db.from("feed_preferences").upsert({ user_id: me(), prefs: next });
  return { preferences: next };
}

/* -------------------------------------------------------------- discovery */

export async function getTrendingTags(): Promise<{ trendingTags: TrendingTag[] }> {
  const { data } = await db.from("posts").select("tags").limit(300);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as any[]) {
    for (const tag of row.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const trendingTags = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, category: "Trending", count: `${count} posts` }));
  return { trendingTags };
}

/* --------------------------------------------------------------------- AI */

const AI_TONES = ["insightful", "playful", "bold", "reflective"];

export async function generateAIDraft(prompt: string, currentDraft?: string) {
  const tone = AI_TONES[Math.floor(Math.random() * AI_TONES.length)];
  const seed = (currentDraft || prompt).trim();
  const content = `${seed ? `${seed}\n\n` : ""}Here's a ${tone} take on ${prompt}: the best ideas come from shipping in public, listening closely, and iterating fast. What would you add?`;
  const suggestedTags = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);
  return { content, suggestedTags };
}

export async function generateAIStory(prompt: string) {
  return {
    text: `${prompt} — captured in the moment ✨`,
    mood: "inspired",
    suggestedStickers: ["✨", "🔥", "💫"],
  };
}

export async function summarizeSpaceAI(title: string, topic: string, messages: string[]) {
  const highlights = messages.slice(-3);
  return {
    summary: `"${title}" focused on ${topic}. The room covered ${messages.length} messages of live discussion.`,
    keyTakeaways:
      highlights.length > 0
        ? highlights
        : [`${topic} is trending`, "Community energy is high", "Next session coming soon"],
  };
}

/* ------------------------------------------------------------------- tips */

export async function sendTipApi(input: {
  recipientUsername?: string;
  recipientId?: string;
  amount: number;
  message?: string;
  postId?: string;
  spaceId?: string;
}) {
  let recipientId = input.recipientId;
  if (!recipientId && input.recipientUsername) {
    const { data } = await db
      .from("profiles")
      .select("id")
      .eq("username", input.recipientUsername.replace(/^@/, ""))
      .maybeSingle();
    recipientId = data?.id;
  }
  if (!recipientId) throw new Error("Recipient not found");
  if (!me() || me() === "guest") throw new Error("Sign in to send a tip");
  if (recipientId === me()) throw new Error("You cannot tip yourself");
  const { error } = await db.from("tips").insert({
    from_user_id: me(),
    to_user_id: recipientId,
    amount: input.amount,
    message: input.message ?? "",
    post_id: input.postId ?? null,
  });
  if (error) throw error;
  emitRealtime("tip:sent", input);
  return { ok: true, amount: input.amount };
}

export async function getTipsForMe() {
  const { data } = await db
    .from("tips")
    .select("*")
    .eq("to_user_id", me())
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as any[];
}

/* -------------------------------------------------------- moderation/admin */

export async function submitReport(input: {
  target_type: string;
  target_id: string;
  target_preview?: string;
  author_id?: string;
  author_name?: string;
  reason: string;
  details?: string | undefined;
}) {
  const { data, error } = await db
    .from("reports")
    .insert({
      ...input,
      details: input.details ?? "",
      reporter_id: me(),
      reporter_name: currentUser.display_name,
      status: "pending",
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  emitRealtime("report:created", data);
  return data as ModerationReport;
}

export async function getAdminReports(filters: { status?: string; target_type?: string } = {}) {
  let query = db.from("reports").select("*").order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.target_type) query = query.eq("target_type", filters.target_type);
  const { data } = await query;
  return (data ?? []) as ModerationReport[];
}

export async function updateReportStatus(
  reportId: string,
  status: string,
  actionTaken?: string,
  actorId?: string,
) {
  const { data } = await db
    .from("reports")
    .update({ status, action_taken: actionTaken ?? null })
    .eq("id", reportId)
    .select("*")
    .maybeSingle();
  await logAudit(actorId ?? me(), `report.${status}`, "report", reportId, actionTaken ?? "", "warning");
  emitRealtime("report:updated", data);
  return data as ModerationReport;
}

export async function getAdminUsers(
  filters: { query?: string; role?: string; status?: string; verified?: boolean } = {},
) {
  let q = db.from("profiles").select("*").limit(200);
  if (filters.role) q = q.eq("role", filters.role);
  if (filters.status) q = q.eq("status", filters.status);
  if (typeof filters.verified === "boolean") q = q.eq("verified", filters.verified);
  const { data } = await q;
  let profiles = (data ?? []).map(rowToProfile);
  if (filters.query) {
    const needle = filters.query.toLowerCase();
    profiles = profiles.filter(
      (p: Profile) =>
        p.display_name.toLowerCase().includes(needle) || p.username.toLowerCase().includes(needle),
    );
  }
  return profiles;
}

export async function updateUserAdmin(userId: string, patch: Record<string, any>, actorId?: string) {
  const { data } = await db.from("profiles").update(patch).eq("id", userId).select("*").maybeSingle();
  await logAudit(actorId ?? me(), "user.update", "user", userId, JSON.stringify(patch), "warning");
  const profile = data ? rowToProfile(data) : null;
  if (profile) {
    cacheProfiles([profile]);
    emitRealtime("user:updated", profile);
  }
  return profile as Profile;
}

export async function getAdminPosts(filters: { query?: string } = {}) {
  const { data } = await db.from("posts").select("*").order("created_at", { ascending: false }).limit(200);
  let posts = (data ?? []).map((row: any) => rowToPost(row));
  if (filters.query) {
    const needle = filters.query.toLowerCase();
    posts = posts.filter((p: Post) => p.content.toLowerCase().includes(needle));
  }
  await hydrateAuthors(posts.map((p: Post) => p.user_id));
  return posts;
}

export async function forceDeletePostAdmin(postId: string, actorId?: string) {
  await db.from("posts").delete().eq("id", postId);
  await logAudit(actorId ?? me(), "post.force_delete", "post", postId, "Post removed by moderator", "danger");
  emitRealtime("post:deleted", { id: postId });
  return { ok: true };
}

export async function getAdminAuditLogs(filters: { limit?: number; severity?: string } = {}) {
  let q = db
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.severity) q = q.eq("severity", filters.severity);
  const { data } = await q;
  return (data ?? []) as AuditLog[];
}

async function logAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: string,
  severity: AuditLog["severity"] = "info",
) {
  try {
    const { data } = await db
      .from("audit_logs")
      .insert({
        actor_id: actorId,
        actor_name: currentUser.display_name,
        actor_role: currentUser.role ?? "admin",
        action,
        target_type: targetType,
        target_id: targetId,
        details,
        severity,
      })
      .select("*")
      .maybeSingle();
    if (data) emitRealtime("audit:created", data);
  } catch {
    /* audit logging is best-effort */
  }
}

const DEFAULT_SETTINGS: SystemSettings = {
  maintenance_mode: false,
  registration_enabled: true,
  ai_generation_enabled: true,
  stories_enabled: true,
  spaces_audio_enabled: true,
  max_upload_size_mb: 25,
  rate_limit_requests_per_min: 120,
  auto_mod_strictness: "medium",
  announcement_banner: {
    active: false,
    message: "",
    type: "info",
    dismissible: true,
  },
};

export async function getAdminSettings(): Promise<SystemSettings> {
  const { data } = await db.from("system_settings").select("*").limit(1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  const { id: _id, updated_at: _u, ...rest } = data as Record<string, unknown>;
  return { ...DEFAULT_SETTINGS, ...(rest as Partial<SystemSettings>) };
}

export async function getPublicSettings(): Promise<SystemSettings> {
  return getAdminSettings();
}

export async function updateAdminSettings(settings: SystemSettings, actorId?: string) {
  const { data: existing } = await db.from("system_settings").select("id").limit(1).maybeSingle();
  const payload = { ...settings, updated_at: nowIso() };
  if (existing) await db.from("system_settings").update(payload).eq("id", existing.id);
  else await db.from("system_settings").insert({ id: 1, ...payload });
  await logAudit(actorId ?? me(), "settings.update", "system", "settings", "System settings updated", "warning");
  emitRealtime("settings:updated", settings);
  return settings;
}

export async function syncSupabaseDatabase() {
  const started = Date.now();
  const tables = ["profiles", "posts", "stories", "spaces", "reports", "audit_logs"];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count } = await db.from(table).select("id", { count: "exact", head: true });
    counts[table] = count ?? 0;
  }
  return { counts, durationMs: Date.now() - started };
}

export async function getAdminOverview(): Promise<AdminOverviewData> {
  const started = Date.now();
  const [{ counts }, reports] = await Promise.all([syncSupabaseDatabase(), getAdminReports({ status: "pending" })]);
  const { count: liveSpaces } = await db
    .from("spaces")
    .select("id", { count: "exact", head: true })
    .eq("live", true);
  const { count: impressions } = await db
    .from("post_impressions")
    .select("id", { count: "exact", head: true });
  const { count: likes } = await db.from("likes").select("id", { count: "exact", head: true });
  const { count: comments } = await db.from("comments").select("id", { count: "exact", head: true });
  const { count: reposts } = await db.from("reposts").select("id", { count: "exact", head: true });
  const { count: suspended } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "suspended");
  const { count: verified } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("verified", true);

  return {
    stats: {
      total_users: counts.profiles ?? 0,
      active_24h_users: counts.profiles ?? 0,
      total_posts: counts.posts ?? 0,
      total_stories: counts.stories ?? 0,
      total_spaces: counts.spaces ?? 0,
      live_spaces_count: liveSpaces ?? 0,
      total_impressions: impressions ?? 0,
      total_likes: likes ?? 0,
      total_comments: comments ?? 0,
      total_reposts: reposts ?? 0,
      pending_reports_count: reports.length,
      suspended_users_count: suspended ?? 0,
      verified_creators_count: verified ?? 0,
      system_health: {
        status: "operational",
        uptime_seconds: Math.floor(process_uptime()),
        database_latency_ms: Date.now() - started,
        storage_usage_bytes: 0,
        error_rate_percent: 0,
        db_driver: "postgres",
      },
    },
    storage_usage_breakdown: {
      avatars_mb: 0,
      posts_media_mb: 0,
      stories_mb: 0,
      spaces_audio_mb: 0,
    },
    charts: await buildAdminCharts({
      likes: likes ?? 0,
      comments: comments ?? 0,
      reposts: reposts ?? 0,
      impressions: impressions ?? 0,
    }),
    recent_activity: [],
    recent_reports: reports.slice(0, 5),
  };
}

async function buildAdminCharts(totals: {
  likes: number;
  comments: number;
  reposts: number;
  impressions: number;
}): Promise<AdminCharts> {
  const { data: postRows } = await db
    .from("posts")
    .select("id,user_id,created_at,impressions,tags")
    .order("created_at", { ascending: false })
    .limit(300);
  const posts = (postRows ?? []) as any[];

  const days: AdminCharts["daily_impressions"] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000);
    const key = day.toISOString().slice(0, 10);
    const dayPosts = posts.filter((p) => String(p.created_at ?? "").slice(0, 10) === key);
    days.push({
      date: key.slice(5),
      impressions: dayPosts.reduce((sum, p) => sum + Number(p.impressions ?? 0), 0),
      engagement: dayPosts.length,
    });
  }

  const hourly: AdminCharts["hourly_traffic"] = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    requests: posts.filter((p) => new Date(p.created_at ?? Date.now()).getUTCHours() === hour).length,
  }));

  const timeline: AdminCharts["system_load_timeline"] = Array.from({ length: 12 }, (_, i) => {
    const t = new Date(Date.now() - (11 - i) * 300000);
    return {
      time: t.toISOString().slice(11, 16),
      cpu: 18 + ((i * 7) % 25),
      memory: 240 + ((i * 13) % 90),
    };
  });

  const byUser = new Map<string, number>();
  const postCount = new Map<string, number>();
  for (const p of posts) {
    byUser.set(p.user_id, (byUser.get(p.user_id) ?? 0) + Number(p.impressions ?? 0));
    postCount.set(p.user_id, (postCount.get(p.user_id) ?? 0) + 1);
  }
  const topIds = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  const { data: creatorRows } = topIds.length
    ? await db.from("profiles").select("*").in("id", topIds)
    : { data: [] as any[] };
  const top_creators: AdminCharts["top_creators"] = ((creatorRows ?? []) as any[]).map((row) => ({
    id: String(row.id),
    name: String(row.display_name ?? row.username ?? "Creator"),
    username: String(row.username ?? "unknown"),
    verified: Boolean(row.verified),
    impressions: byUser.get(row.id) ?? 0,
    followers: Number(row.followers ?? 0),
    posts: postCount.get(row.id) ?? 0,
  }));

  const tagCounts = new Map<string, number>();
  for (const p of posts) for (const tag of p.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const category_velocity: AdminCharts["category_velocity"] = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag: `#${tag}`, count, growth: `+${Math.min(99, count * 3)}%` }));

  return {
    daily_impressions: days,
    engagement_distribution: [
      { name: "Likes", value: totals.likes, color: "#8b5cf6" },
      { name: "Comments", value: totals.comments, color: "#ec4899" },
      { name: "Reposts", value: totals.reposts, color: "#10b981" },
      { name: "Impressions", value: totals.impressions, color: "#f59e0b" },
    ],
    hourly_traffic: hourly,
    system_load_timeline: timeline,
    top_creators,
    category_velocity,
  };
}

function process_uptime() {
  if (typeof performance !== "undefined") return performance.now() / 1000;
  return 0;
}

// ---------------------------------------------------------------------------
// Feed preload bundle (used by the client-side feed cache)
// ---------------------------------------------------------------------------

export interface PreloadBundleResponse {
  foryou: Post[];
  following: Post[];
  latest: Post[];
  stories: Story[];
  spaces: Space[];
  trendingTags: TrendingTag[];
}

export async function preloadFeedBundle(): Promise<PreloadBundleResponse> {
  const [foryou, following, stories, spaces, trendingTags] = await Promise.all([
    getPosts({ limit: 30 }).catch(() => [] as Post[]),
    getPosts({ limit: 30 }).catch(() => [] as Post[]),
    getStories().catch(() => [] as Story[]),
    getSpaces()
      .then((r) => r.spaces)
      .catch(() => [] as Space[]),
    getTrendingTags()
      .then((r) => r.trendingTags)
      .catch(() => [] as TrendingTag[]),
  ]);
  return { foryou, following, latest: foryou, stories, spaces, trendingTags };
}


/* ------------------------------------------------- compatibility surface ----
 * Thin adapters so feature pages can speak in domain terms while the data
 * layer stays a single Supabase-backed implementation.
 * -------------------------------------------------------------------------*/

/** Signed-in profile, resolved from the live session. */
export async function getCurrentUser(): Promise<{ user: Profile | null }> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null };
  const { data: row } = await db
    .from("profiles")
    .select("*")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  return { user: row ? rowToProfile(row as any) : null };
}

/** Look a profile up by id or @username. */
export async function getUserProfile(idOrUsername: string): Promise<{ profile: Profile | null }> {
  const handle = idOrUsername.replace(/^@/, "");
  const { data } = await db
    .from("profiles")
    .select("*")
    .or(`id.eq.${handle},username.eq.${handle}`)
    .maybeSingle();
  if (!data) return { profile: null };
  const profile = rowToProfile(data as any);
  cacheProfiles([profile]);
  return { profile };
}

export async function getProfileById(idOrUsername: string): Promise<Profile | null> {
  return (await getUserProfile(idOrUsername)).profile;
}

/** Bookmarked posts for the signed-in user. */
export async function getBookmarks(): Promise<Post[]> {
  return getBookmarkedPosts();
}

/** Trending tags reshaped as browsable topics. */
export async function getTopics(): Promise<{ topics: Topic[] }> {
  const { trendingTags } = await getTrendingTags();
  const topics: Topic[] = trendingTags.slice(0, 12).map((t, i) => ({
    name: `#${t.tag}`,
    posts: String(t.count),
    gradient: TOPIC_GRADIENTS[i % TOPIC_GRADIENTS.length] ?? "from-brand to-brand-pink",
  }));
  return { topics };
}

const TOPIC_GRADIENTS = [
  "from-brand to-brand-pink",
  "from-amber-400 to-rose-500",
  "from-sky-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-fuchsia-500 to-purple-600",
  "from-orange-400 to-red-500",
];

/** Cross-entity search over posts, people and Spaces. */
export async function globalSearch(
  query: string,
): Promise<{ posts: Post[]; profiles: Profile[]; spaces: Space[] }> {
  const q = query.trim();
  if (!q) return { posts: [], profiles: [], spaces: [] };
  const like = `%${q}%`;
  const [postRes, profileRes, spaceRes] = await Promise.all([
    db.from("posts").select("*").eq("hidden", false).ilike("content", like).limit(20),
    db.from("profiles").select("*").or(`username.ilike.${like},display_name.ilike.${like}`).limit(20),
    db.from("spaces").select("*").or(`title.ilike.${like},topic.ilike.${like}`).limit(20),
  ]);
  const posts = ((postRes.data ?? []) as any[]).map((row) => rowToPost(row));
  await hydrateAuthors(posts.map((p) => p.user_id));
  const profiles = ((profileRes.data ?? []) as any[]).map((row) => rowToProfile(row));
  cacheProfiles(profiles);
  return { posts, profiles, spaces: ((spaceRes.data ?? []) as any[]) as Space[] };
}

/** Single Space by id. */
export async function getSpace(id: string): Promise<{ space: Space | null }> {
  const { data } = await db.from("spaces").select("*").eq("id", id).maybeSingle();
  return { space: (data as Space) ?? null };
}

export async function markNotificationRead(id: string) {
  await db.from("notifications").update({ read: true }).eq("id", id);
  return { success: true };
}

export const markNotificationAsRead = markNotificationRead;

export async function markAllNotificationsRead() {
  await markNotificationsRead();
  return { success: true };
}

export const markAllNotificationsAsRead = markAllNotificationsRead;

/** Send to a conversation id or straight to a recipient profile id. */
export async function sendDirectMessage(
  recipientOrConversationId: string,
  body: string,
  mediaUrl?: string | null,
) {
  return sendMessage(recipientOrConversationId, body, mediaUrl ?? null);
}

/** Record impressions for a batch of posts (viewport analytics). */
export async function recordPostImpressions(postIds: string[]) {
  await Promise.all(postIds.map((id) => recordPostImpression(id).catch(() => null)));
  return { ok: true };
}

/** Deterministic quick-reply suggestions for a chat thread. */
export async function generateSmartRepliesAI(messages: string[]): Promise<{ replies: string[] }> {
  const last = (messages[messages.length - 1] ?? "").toLowerCase();
  if (last.includes("?"))
    return { replies: ["Good question — let me check.", "Yes, absolutely.", "Not sure yet, I'll confirm."] };
  if (last.includes("thanks") || last.includes("thank you"))
    return { replies: ["Anytime!", "Happy to help 🙌", "You got it."] };
  return { replies: ["Sounds good!", "On it 👍", "Let's do it."] };
}

/** Runtime configuration exposed to admin/system surfaces. */
export async function getSystemConfig() {
  return {
    driver: "supabase" as const,
    features: appConfig.features,
    brand: appConfig.brand,
  };
}
