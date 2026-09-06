-- ============ Stories ============
CREATE TABLE public.stories (
  id text PRIMARY KEY DEFAULT ('s_' || replace(gen_random_uuid()::text, '-', '')),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'gradient',
  gradient text,
  media_url text,
  text text,
  caption text,
  location text,
  mood text,
  stickers jsonb NOT NULL DEFAULT '[]'::jsonb,
  view_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX idx_stories_created ON public.stories (created_at DESC);
GRANT SELECT ON public.stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_public_read" ON public.stories FOR SELECT USING (expires_at > now());
CREATE POLICY "stories_insert_own" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "stories_update_any" ON public.stories FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "stories_delete_own" ON public.stories FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.story_likes (
  story_id text NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
GRANT SELECT ON public.story_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.story_likes TO authenticated;
GRANT ALL ON public.story_likes TO service_role;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_likes_read" ON public.story_likes FOR SELECT USING (true);
CREATE POLICY "story_likes_insert_own" ON public.story_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "story_likes_delete_own" ON public.story_likes FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ============ Spaces ============
CREATE TABLE public.spaces (
  id text PRIMARY KEY DEFAULT ('sp_' || replace(gen_random_uuid()::text, '-', '')),
  title text NOT NULL,
  host_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL DEFAULT '',
  listeners integer NOT NULL DEFAULT 0,
  live boolean NOT NULL DEFAULT true,
  gradient text NOT NULL DEFAULT 'from-violet-500 to-fuchsia-500',
  recorded boolean NOT NULL DEFAULT false,
  recording_url text,
  duration text,
  starts_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spaces TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spaces_public_read" ON public.spaces FOR SELECT USING (true);
CREATE POLICY "spaces_insert_own" ON public.spaces FOR INSERT TO authenticated
  WITH CHECK (host_id = public.current_profile_id());
CREATE POLICY "spaces_update" ON public.spaces FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "spaces_delete_own" ON public.spaces FOR DELETE TO authenticated
  USING (host_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.space_participants (
  space_id text NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'listener',
  hand_raised boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT true,
  is_speaking boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);
GRANT SELECT ON public.space_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_participants TO authenticated;
GRANT ALL ON public.space_participants TO service_role;
ALTER TABLE public.space_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "space_participants_read" ON public.space_participants FOR SELECT USING (true);
CREATE POLICY "space_participants_write_own" ON public.space_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "space_participants_update_own" ON public.space_participants FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "space_participants_delete_own" ON public.space_participants FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.space_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id text NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_space_messages_space ON public.space_messages (space_id, created_at);
GRANT SELECT ON public.space_messages TO anon;
GRANT SELECT, INSERT ON public.space_messages TO authenticated;
GRANT ALL ON public.space_messages TO service_role;
ALTER TABLE public.space_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "space_messages_read" ON public.space_messages FOR SELECT USING (true);
CREATE POLICY "space_messages_insert_own" ON public.space_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());

-- ============ Messaging ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preview text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_participant_read" ON public.conversations FOR SELECT TO authenticated
  USING (user_a = public.current_profile_id() OR user_b = public.current_profile_id());
CREATE POLICY "conversations_participant_insert" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (user_a = public.current_profile_id() OR user_b = public.current_profile_id());
CREATE POLICY "conversations_participant_update" ON public.conversations FOR UPDATE TO authenticated
  USING (user_a = public.current_profile_id() OR user_b = public.current_profile_id())
  WITH CHECK (user_a = public.current_profile_id() OR user_b = public.current_profile_id());

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  media_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_participant_read" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
    AND (c.user_a = public.current_profile_id() OR c.user_b = public.current_profile_id())));
CREATE POLICY "messages_participant_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = public.current_profile_id() AND EXISTS (SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (c.user_a = public.current_profile_id() OR c.user_b = public.current_profile_id())));
CREATE POLICY "messages_participant_update" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
    AND (c.user_a = public.current_profile_id() OR c.user_b = public.current_profile_id())))
  WITH CHECK (true);

-- ============ Notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON public.notifications (recipient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own_read" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = public.current_profile_id());
CREATE POLICY "notifications_insert_any" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "notifications_own_update" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = public.current_profile_id()) WITH CHECK (recipient_id = public.current_profile_id());
CREATE POLICY "notifications_own_delete" ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = public.current_profile_id());

-- ============ Moderation ============
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id text NOT NULL,
  target_preview text,
  author_id text,
  author_name text,
  reporter_id text NOT NULL,
  reporter_name text NOT NULL DEFAULT '',
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_staff_read" ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin')
    OR reporter_id = public.current_profile_id());
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = public.current_profile_id());
CREATE POLICY "reports_staff_update" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (true);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL DEFAULT '',
  actor_name text NOT NULL DEFAULT '',
  actor_role text NOT NULL DEFAULT '',
  action text NOT NULL,
  target_type text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  ip_address text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs (created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "audit_insert_staff" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============ Settings and preferences ============
CREATE TABLE public.system_settings (
  id integer PRIMARY KEY DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  registration_enabled boolean NOT NULL DEFAULT true,
  ai_generation_enabled boolean NOT NULL DEFAULT true,
  stories_enabled boolean NOT NULL DEFAULT true,
  spaces_audio_enabled boolean NOT NULL DEFAULT true,
  max_upload_size_mb integer NOT NULL DEFAULT 25,
  rate_limit_requests_per_min integer NOT NULL DEFAULT 120,
  auto_mod_strictness text NOT NULL DEFAULT 'medium',
  announcement_banner jsonb NOT NULL DEFAULT '{"active":false,"message":"","type":"info","dismissible":true}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.system_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.system_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "settings_admin_insert" ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.system_settings (id) VALUES (1);

CREATE TABLE public.feed_preferences (
  user_id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.feed_preferences TO authenticated;
GRANT ALL ON public.feed_preferences TO service_role;
ALTER TABLE public.feed_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_prefs_own" ON public.feed_preferences FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

CREATE TABLE public.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id text REFERENCES public.posts(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tips TO authenticated;
GRANT ALL ON public.tips TO service_role;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tips_participant_read" ON public.tips FOR SELECT TO authenticated
  USING (from_user_id = public.current_profile_id() OR to_user_id = public.current_profile_id());
CREATE POLICY "tips_insert_own" ON public.tips FOR INSERT TO authenticated
  WITH CHECK (from_user_id = public.current_profile_id());

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.space_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.space_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;