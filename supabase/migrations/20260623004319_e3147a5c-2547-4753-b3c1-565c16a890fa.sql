CREATE TABLE public.selection_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES public.project_selection_options(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text NOT NULL DEFAULT 'Unknown',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.selection_notes TO authenticated;
GRANT ALL ON public.selection_notes TO service_role;

ALTER TABLE public.selection_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read selection notes"
ON public.selection_notes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers can read their project selection notes"
ON public.selection_notes
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = selection_notes.project_id AND p.customer_id = auth.uid()
));

CREATE POLICY "Admins can add selection notes"
ON public.selection_notes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) AND author_id = auth.uid()
);

CREATE POLICY "Customers can add their project selection notes"
ON public.selection_notes
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = selection_notes.project_id AND p.customer_id = auth.uid()
  )
);

CREATE INDEX idx_selection_notes_option ON public.selection_notes(option_id, created_at);

CREATE OR REPLACE FUNCTION public.tl_project_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Completed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.project_timeline_events (project_id, category, title, description, created_by)
    VALUES (NEW.id, 'project', 'Project Completed', NEW.name || ' was marked complete', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_completed
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.tl_project_completed();