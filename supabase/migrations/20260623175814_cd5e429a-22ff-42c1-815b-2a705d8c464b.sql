CREATE TABLE public.material_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  option_id uuid REFERENCES public.project_selection_options(id) ON DELETE CASCADE,
  is_manual boolean NOT NULL DEFAULT false,
  material_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  ordered boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_checklist_unique_option UNIQUE (project_id, option_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_checklist_items TO authenticated;
GRANT ALL ON public.material_checklist_items TO service_role;

ALTER TABLE public.material_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage material checklist"
  ON public.material_checklist_items
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_material_checklist_updated_at
  BEFORE UPDATE ON public.material_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();