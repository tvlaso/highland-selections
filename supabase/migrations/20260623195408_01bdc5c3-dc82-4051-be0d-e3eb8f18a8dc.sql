
-- ============ designs ============
CREATE TABLE public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Design',
  category text NOT NULL DEFAULT 'General',
  notes text,
  cover_path text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designs TO authenticated;
GRANT ALL ON public.designs TO service_role;
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage designs" ON public.designs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers view own project designs" ON public.designs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = designs.project_id AND p.customer_id = auth.uid()));

-- ============ design_photos ============
CREATE TABLE public.design_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_photos TO authenticated;
GRANT ALL ON public.design_photos TO service_role;
ALTER TABLE public.design_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage design photos" ON public.design_photos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers view own design photos" ON public.design_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = design_photos.design_id AND p.customer_id = auth.uid()));

-- ============ design_files ============
CREATE TABLE public.design_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL DEFAULT 'Attachment',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_files TO authenticated;
GRANT ALL ON public.design_files TO service_role;
ALTER TABLE public.design_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage design files" ON public.design_files FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers view own design files" ON public.design_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = design_files.design_id AND p.customer_id = auth.uid()));

-- ============ design_products ============
CREATE TABLE public.design_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.master_catalog(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_id, catalog_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_products TO authenticated;
GRANT ALL ON public.design_products TO service_role;
ALTER TABLE public.design_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage design products" ON public.design_products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers view own design products" ON public.design_products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = design_products.design_id AND p.customer_id = auth.uid()));

-- ============ design_comments ============
CREATE TABLE public.design_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text NOT NULL DEFAULT 'User',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_comments TO authenticated;
GRANT ALL ON public.design_comments TO service_role;
ALTER TABLE public.design_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read design comments" ON public.design_comments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add design comments" ON public.design_comments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND author_id = auth.uid());
CREATE POLICY "Customers read own design comments" ON public.design_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = design_comments.project_id AND p.customer_id = auth.uid()));
CREATE POLICY "Customers add own design comments" ON public.design_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = design_comments.project_id AND p.customer_id = auth.uid()));

-- ============ design_versions ============
CREATE TABLE public.design_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_versions TO authenticated;
GRANT ALL ON public.design_versions TO service_role;
ALTER TABLE public.design_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage design versions" ON public.design_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers view own design versions" ON public.design_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = design_versions.design_id AND p.customer_id = auth.uid()));

-- ============ updated_at triggers ============
CREATE TRIGGER update_designs_updated_at BEFORE UPDATE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
