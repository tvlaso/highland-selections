-- Master Catalog: reusable product library
CREATE TABLE public.master_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name text NOT NULL,
  category text NOT NULL,
  vendor text,
  price numeric,
  image_url text,
  product_url text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_catalog TO authenticated;
GRANT ALL ON public.master_catalog TO service_role;

ALTER TABLE public.master_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage catalog"
  ON public.master_catalog FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view active catalog"
  ON public.master_catalog FOR SELECT TO authenticated
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_master_catalog_updated_at
  BEFORE UPDATE ON public.master_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project selection options: links projects to catalog items
CREATE TABLE public.project_selection_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.master_catalog(id) ON DELETE CASCADE,
  category text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_selection_options TO authenticated;
GRANT ALL ON public.project_selection_options TO service_role;

ALTER TABLE public.project_selection_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project options"
  ON public.project_selection_options FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own project options"
  ON public.project_selection_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_selection_options.project_id AND p.customer_id = auth.uid()));

CREATE POLICY "Customers update own project options"
  ON public.project_selection_options FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_selection_options.project_id AND p.customer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_selection_options.project_id AND p.customer_id = auth.uid()));

CREATE TRIGGER update_project_selection_options_updated_at
  BEFORE UPDATE ON public.project_selection_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Remove the old allowance-based selections table
DROP TABLE IF EXISTS public.selections;