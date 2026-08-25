CREATE TABLE public.project_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_rooms TO authenticated;
GRANT ALL ON public.project_rooms TO service_role;

ALTER TABLE public.project_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project rooms"
ON public.project_rooms FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers view rooms on their projects"
ON public.project_rooms FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_rooms.project_id AND p.customer_id = auth.uid()
));

CREATE TRIGGER update_project_rooms_updated_at
BEFORE UPDATE ON public.project_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_project_rooms_project ON public.project_rooms(project_id);

ALTER TABLE public.project_selection_options
  ADD COLUMN room_id uuid REFERENCES public.project_rooms(id) ON DELETE SET NULL;

CREATE INDEX idx_pso_room ON public.project_selection_options(room_id);