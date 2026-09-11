REVOKE ALL ON FUNCTION public.sync_post_counter() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.sync_follow_counts() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.sync_story_likes() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.notify_engagement() FROM anon, authenticated, public;

DROP POLICY IF EXISTS "audit_insert_staff" ON public.audit_logs;
CREATE POLICY "audit_insert_staff" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "notifications_insert_any" ON public.notifications;
CREATE POLICY "notifications_insert_actor" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (actor_id = public.current_profile_id());

DROP POLICY IF EXISTS "spaces_update" ON public.spaces;
CREATE POLICY "spaces_update_host_or_participant" ON public.spaces FOR UPDATE TO authenticated
USING (
  host_id = public.current_profile_id()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.space_participants sp
    WHERE sp.space_id = spaces.id AND sp.user_id = public.current_profile_id()
  )
)
WITH CHECK (true);

DROP POLICY IF EXISTS "stories_update_any" ON public.stories;
CREATE POLICY "stories_update_own" ON public.stories FOR UPDATE TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (true);

DROP POLICY IF EXISTS "branding public read" ON public.branding_settings;
CREATE POLICY "branding_read_own" ON public.branding_settings FOR SELECT TO authenticated
USING (user_id = public.current_profile_id());
REVOKE SELECT ON public.branding_settings FROM anon;

DROP POLICY IF EXISTS "media public read" ON storage.objects;
CREATE POLICY "media read authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'media');