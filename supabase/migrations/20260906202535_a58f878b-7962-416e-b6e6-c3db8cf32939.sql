CREATE TABLE public.user_preferences (
  user_id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system',
  accent text NOT NULL DEFAULT 'violet',
  reduce_motion boolean NOT NULL DEFAULT false,
  larger_text boolean NOT NULL DEFAULT false,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());
CREATE TRIGGER touch_user_preferences BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'audio',
  status text NOT NULL DEFAULT 'ringing',
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_calls_participants ON public.calls (caller_id, callee_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls participant read" ON public.calls FOR SELECT TO authenticated
  USING (caller_id = public.current_profile_id() OR callee_id = public.current_profile_id());
CREATE POLICY "calls caller insert" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (caller_id = public.current_profile_id());
CREATE POLICY "calls participant update" ON public.calls FOR UPDATE TO authenticated
  USING (caller_id = public.current_profile_id() OR callee_id = public.current_profile_id())
  WITH CHECK (caller_id = public.current_profile_id() OR callee_id = public.current_profile_id());

ALTER TABLE public.api_keys ADD COLUMN call_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.subscriptions
  ADD COLUMN provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN provider_customer_id text,
  ADD COLUMN provider_subscription_id text,
  ADD COLUMN payment_method jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.workspaces
  ADD COLUMN seats_total integer NOT NULL DEFAULT 5,
  ADD COLUMN logo_emoji text NOT NULL DEFAULT '🚀';

ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER TABLE public.calls REPLICA IDENTITY FULL;