DROP POLICY IF EXISTS "View product photos for catalog or owners" ON storage.objects;

CREATE POLICY "View product photos for catalog or owners"
ON storage.objects
FOR SELECT
USING (
  (bucket_id = 'product-photos'::text) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (EXISTS (
      SELECT 1 FROM master_catalog mc
      WHERE mc.active = true
        AND (mc.image_url = objects.name OR objects.name = ANY (mc.images))
    ))
    OR (EXISTS (
      SELECT 1 FROM projects p
      WHERE ((p.id)::text = split_part(objects.name, '/'::text, 1))
        AND p.customer_id = auth.uid()
    ))
  )
);