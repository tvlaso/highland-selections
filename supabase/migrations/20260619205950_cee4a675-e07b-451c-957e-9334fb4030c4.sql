
CREATE POLICY "Authenticated can view product photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-photos');
CREATE POLICY "Admins upload product photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update product photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete product photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-photos' AND public.has_role(auth.uid(), 'admin'));
