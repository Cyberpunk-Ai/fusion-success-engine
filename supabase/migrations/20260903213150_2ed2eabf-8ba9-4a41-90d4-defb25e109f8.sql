-- ============ Spaces social platform: core schema ============

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Profiles: id is a text handle so demo content can exist without auth users.
CREATE TABLE public.profiles (
  id text PRIMARY KEY DEFAULT ('u_' || replace(gen_random_uuid()::text, '-', '')),
  auth_user_id uuid UNIQUE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  location text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  followers integer NOT NULL DEFAULT 0,
  following integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  warning_count integer NOT NULL DEFAULT 0,
  last_active timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
$$;

CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ Posts and interactions ============

CREATE TABLE public.posts (
  id text PRIMARY KEY DEFAULT ('p_' || replace(gen_random_uuid()::text, '-', '')),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_gradient text,
  media_url text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  poll jsonb,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  repost_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 1,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX idx_posts_user_id ON public.posts (user_id);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_public_read" ON public.posts FOR SELECT USING (hidden = false);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (true);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.comments (
  id text PRIMARY KEY DEFAULT ('c_' || replace(gen_random_uuid()::text, '-', '')),
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_post ON public.comments (post_id, created_at);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.likes (
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT ON public.likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_public_read" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_write_own" ON public.likes FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

CREATE TABLE public.reposts (
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT ON public.reposts TO anon;
GRANT SELECT, INSERT, DELETE ON public.reposts TO authenticated;
GRANT ALL ON public.reposts TO service_role;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reposts_public_read" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "reposts_write_own" ON public.reposts FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "reposts_delete_own" ON public.reposts FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

CREATE TABLE public.bookmarks (
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks_own" ON public.bookmarks FOR ALL TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

CREATE TABLE public.poll_votes (
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.poll_votes TO anon;
GRANT SELECT, INSERT ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_votes_public_read" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "poll_votes_insert_own" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());

CREATE TABLE public.follows (
  follower_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, target_id)
);
GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_public_read" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_write_own" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = public.current_profile_id());
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated
  USING (follower_id = public.current_profile_id());

CREATE TABLE public.post_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_impressions_post ON public.post_impressions (post_id);
GRANT INSERT ON public.post_impressions TO anon;
GRANT SELECT, INSERT ON public.post_impressions TO authenticated;
GRANT ALL ON public.post_impressions TO service_role;
ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impressions_insert_any" ON public.post_impressions FOR INSERT WITH CHECK (true);
CREATE POLICY "impressions_read_admin" ON public.post_impressions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));