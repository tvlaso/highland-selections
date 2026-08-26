CREATE POLICY "Authors can update their selection notes"
ON public.selection_notes
FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete their selection notes"
ON public.selection_notes
FOR DELETE
TO authenticated
USING (author_id = auth.uid());