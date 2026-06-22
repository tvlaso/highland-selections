-- Versioning columns on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS selections_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selections_content_hash text,
  ADD COLUMN IF NOT EXISTS selections_version_updated_at timestamptz;

-- Immutable timeline audit log
CREATE TABLE public.project_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  related_spec_card_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.project_timeline_events TO authenticated;
GRANT ALL ON public.project_timeline_events TO service_role;

ALTER TABLE public.project_timeline_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all events; customers can read events for their own project.
CREATE POLICY "Admins read all timeline events"
  ON public.project_timeline_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers read own project timeline events"
  ON public.project_timeline_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.customer_id = auth.uid()
  ));

-- Any authenticated user with access may append events (immutable: no update/delete policy)
CREATE POLICY "Authenticated can insert timeline events"
  ON public.project_timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_timeline_project ON public.project_timeline_events (project_id, created_at DESC);

-- Trigger functions
CREATE OR REPLACE FUNCTION public.tl_project_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_timeline_events (project_id, category, title, description, created_by)
  VALUES (NEW.id, 'project', 'Project Created', NEW.name, auth.uid());
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.project_timeline_events (project_id, category, title, description, created_by)
    VALUES (NEW.id, 'project', 'Customer Invited', 'A customer was assigned to this project', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tl_project_customer_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    INSERT INTO public.project_timeline_events (project_id, category, title, description, created_by)
    VALUES (NEW.id, 'project', 'Customer Invited', 'A customer was assigned to this project', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tl_spec_card_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_timeline_events (project_id, category, title, description, related_spec_card_id, created_by)
  VALUES (NEW.project_id, 'selections', 'Spec Card Created', 'A selection was added in ' || NEW.category, NEW.id, auth.uid());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tl_spec_card_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.customer_notes IS DISTINCT FROM OLD.customer_notes AND NEW.customer_notes IS NOT NULL THEN
    INSERT INTO public.project_timeline_events (project_id, category, title, description, related_spec_card_id, created_by)
    VALUES (NEW.project_id, 'selections', 'Customer Note Added', NEW.customer_notes, NEW.id, auth.uid());
  ELSIF NEW.category IS DISTINCT FROM OLD.category OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
    INSERT INTO public.project_timeline_events (project_id, category, title, description, related_spec_card_id, created_by)
    VALUES (NEW.project_id, 'selections', 'Spec Card Updated', 'Selection updated in ' || NEW.category, NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tl_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tl_project_created();

CREATE TRIGGER trg_tl_project_customer_assigned
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tl_project_customer_assigned();

CREATE TRIGGER trg_tl_spec_card_created
  AFTER INSERT ON public.project_selection_options
  FOR EACH ROW EXECUTE FUNCTION public.tl_spec_card_created();

CREATE TRIGGER trg_tl_spec_card_updated
  AFTER UPDATE ON public.project_selection_options
  FOR EACH ROW EXECUTE FUNCTION public.tl_spec_card_updated();