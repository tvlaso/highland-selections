DROP POLICY IF EXISTS "Authenticated can insert timeline events" ON public.project_timeline_events;

CREATE POLICY "Restricted insert timeline events"
ON public.project_timeline_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.customer_id = auth.uid()
  )
);