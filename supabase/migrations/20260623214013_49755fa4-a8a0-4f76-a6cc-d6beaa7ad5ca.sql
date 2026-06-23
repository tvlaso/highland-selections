-- Restrict design-assets bucket reads to admins or owning customers
DROP POLICY IF EXISTS "Authenticated can view design assets" ON storage.objects;
CREATE POLICY "View design assets for owners or admins"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'design-assets'
  AND (
    has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.design_photos dp
      JOIN public.designs d ON d.id = dp.design_id
      JOIN public.projects p ON p.id = d.project_id
      WHERE dp.path = storage.objects.name
        AND p.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.design_files df
      JOIN public.designs d ON d.id = df.design_id
      JOIN public.projects p ON p.id = d.project_id
      WHERE df.path = storage.objects.name
        AND p.customer_id = auth.uid()
    )
  )
);

-- Restrict product-photos bucket reads to align with catalog/project visibility
DROP POLICY IF EXISTS "Authenticated can view product photos" ON storage.objects;
CREATE POLICY "View product photos for catalog or owners"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-photos'
  AND (
    has_role(auth.uid(), 'admin')
    -- Catalog photos of active catalog items are readable by all authenticated users
    OR EXISTS (
      SELECT 1 FROM public.master_catalog mc
      WHERE mc.image_url = storage.objects.name
        AND mc.active = true
    )
    -- Project-scoped photos are readable only by the owning customer
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = split_part(storage.objects.name, '/', 1)
        AND p.customer_id = auth.uid()
    )
  )
);

-- Explicitly restrict writes to user_roles to admins only (defense in depth)
CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));