-- ============ subscriptions ============
CREATE TABLE public.subscriptions (
  user_id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'active',
  renews_at timestamptz,
  ai_drafts_used integer NOT NULL DEFAULT 0,
  ai_usage_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription" ON public.subscriptions FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- ============ monetization ============
CREATE TABLE public.monetization_settings (
  user_id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tips_enabled boolean NOT NULL DEFAULT true,
  subscriptions_enabled boolean NOT NULL DEFAULT false,
  min_tip numeric NOT NULL DEFAULT 1,
  payout_method text NOT NULL DEFAULT 'bank',
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  crypto_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monetization_settings TO authenticated;
GRANT ALL ON public.monetization_settings TO service_role;
ALTER TABLE public.monetization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own monetization" ON public.monetization_settings FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'bank',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payouts read" ON public.payouts FOR SELECT TO authenticated USING (user_id = public.current_profile_id());
CREATE POLICY "own payouts create" ON public.payouts FOR INSERT TO authenticated WITH CHECK (user_id = public.current_profile_id());

-- ============ workspaces ============
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'pro',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = public.current_profile_id()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = _workspace_id AND m.user_id = public.current_profile_id()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon;

CREATE POLICY "workspace read" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id));
CREATE POLICY "workspace create" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = public.current_profile_id());
CREATE POLICY "workspace owner write" ON public.workspaces FOR UPDATE TO authenticated USING (owner_id = public.current_profile_id()) WITH CHECK (owner_id = public.current_profile_id());
CREATE POLICY "workspace owner delete" ON public.workspaces FOR DELETE TO authenticated USING (owner_id = public.current_profile_id());

CREATE POLICY "members read" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "members manage" ON public.workspace_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = public.current_profile_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = public.current_profile_id()));

-- ============ support ============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_support boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket messages read" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "ticket messages write" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = public.current_profile_id() OR public.has_role(auth.uid(), 'admin'))));

-- ============ developer ============
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '["read"]'::jsonb,
  last_used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api keys" ON public.api_keys FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own webhooks" ON public.webhooks FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- ============ branding ============
CREATE TABLE public.branding_settings (
  user_id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'aurora',
  tagline text NOT NULL DEFAULT '',
  post_aura boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.branding_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branding_settings TO authenticated;
GRANT ALL ON public.branding_settings TO service_role;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branding public read" ON public.branding_settings FOR SELECT USING (true);
CREATE POLICY "own branding write" ON public.branding_settings FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_subscriptions BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_monetization BEFORE UPDATE ON public.monetization_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_workspaces BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_tickets BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ counters ============
CREATE OR REPLACE FUNCTION public.sync_post_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid text; col text;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  col := CASE TG_TABLE_NAME
    WHEN 'likes' THEN 'like_count'
    WHEN 'comments' THEN 'comment_count'
    WHEN 'reposts' THEN 'repost_count'
    WHEN 'post_impressions' THEN 'view_count' END;
  EXECUTE format('UPDATE public.posts SET %I = (SELECT count(*) FROM public.%I WHERE post_id = $1) WHERE id = $1', col, TG_TABLE_NAME)
    USING pid;
  RETURN NULL;
END; $$;

CREATE TRIGGER count_likes AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter();
CREATE TRIGGER count_comments AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter();
CREATE TRIGGER count_reposts AFTER INSERT OR DELETE ON public.reposts FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter();
CREATE TRIGGER count_impressions AFTER INSERT OR DELETE ON public.post_impressions FOR EACH ROW EXECUTE FUNCTION public.sync_post_counter();

CREATE OR REPLACE FUNCTION public.sync_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f text; t text;
BEGIN
  f := COALESCE(NEW.follower_id, OLD.follower_id);
  t := COALESCE(NEW.target_id, OLD.target_id);
  UPDATE public.profiles SET following = (SELECT count(*) FROM public.follows WHERE follower_id = f) WHERE id = f;
  UPDATE public.profiles SET followers = (SELECT count(*) FROM public.follows WHERE target_id = t) WHERE id = t;
  RETURN NULL;
END; $$;
CREATE TRIGGER count_follows AFTER INSERT OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();

CREATE OR REPLACE FUNCTION public.sync_story_likes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text;
BEGIN
  s := COALESCE(NEW.story_id, OLD.story_id);
  UPDATE public.stories SET likes_count = (SELECT count(*) FROM public.story_likes WHERE story_id = s) WHERE id = s;
  RETURN NULL;
END; $$;
CREATE TRIGGER count_story_likes AFTER INSERT OR DELETE ON public.story_likes FOR EACH ROW EXECUTE FUNCTION public.sync_story_likes();

-- ============ notifications ============
CREATE OR REPLACE FUNCTION public.notify_engagement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient text; actor text; ntype text; nbody text;
BEGIN
  IF TG_TABLE_NAME = 'follows' THEN
    recipient := NEW.target_id; actor := NEW.follower_id; ntype := 'follow'; nbody := 'started following you';
  ELSIF TG_TABLE_NAME = 'tips' THEN
    recipient := NEW.to_user_id; actor := NEW.from_user_id; ntype := 'tip';
    nbody := 'sent you a tip of ' || NEW.amount::text;
  ELSE
    SELECT user_id INTO recipient FROM public.posts WHERE id = NEW.post_id;
    actor := NEW.user_id;
    ntype := CASE TG_TABLE_NAME WHEN 'likes' THEN 'like' WHEN 'comments' THEN 'comment' ELSE 'repost' END;
    nbody := CASE TG_TABLE_NAME
      WHEN 'likes' THEN 'liked your post'
      WHEN 'comments' THEN 'commented on your post'
      ELSE 'reposted your post' END;
  END IF;
  IF recipient IS NULL OR recipient = actor THEN RETURN NULL; END IF;
  INSERT INTO public.notifications (recipient_id, actor_id, type, body, read)
  VALUES (recipient, actor, ntype, nbody, false);
  RETURN NULL;
END; $$;

CREATE TRIGGER notify_like AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.notify_engagement();
CREATE TRIGGER notify_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_engagement();
CREATE TRIGGER notify_repost AFTER INSERT ON public.reposts FOR EACH ROW EXECUTE FUNCTION public.notify_engagement();
CREATE TRIGGER notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_engagement();
CREATE TRIGGER notify_tip AFTER INSERT ON public.tips FOR EACH ROW EXECUTE FUNCTION public.notify_engagement();

-- ============ realtime ============
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.space_participants REPLICA IDENTITY FULL;