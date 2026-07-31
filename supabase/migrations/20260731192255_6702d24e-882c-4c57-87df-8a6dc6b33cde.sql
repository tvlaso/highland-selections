CREATE TABLE public.selection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.selection_templates TO authenticated;
GRANT ALL ON public.selection_templates TO service_role;
ALTER TABLE public.selection_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage selection templates" ON public.selection_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.selection_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.selection_templates(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.master_catalog(id) ON DELETE CASCADE,
  category text NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.selection_template_items TO authenticated;
GRANT ALL ON public.selection_template_items TO service_role;
ALTER TABLE public.selection_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage selection template items" ON public.selection_template_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_selection_templates_updated_at BEFORE UPDATE ON public.selection_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();