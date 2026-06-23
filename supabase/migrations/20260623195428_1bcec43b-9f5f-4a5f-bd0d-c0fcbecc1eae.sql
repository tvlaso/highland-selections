
CREATE POLICY "Authenticated can view design assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'design-assets');
CREATE POLICY "Admins upload design assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'design-assets' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update design assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'design-assets' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete design assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'design-assets' AND has_role(auth.uid(), 'admin'));
