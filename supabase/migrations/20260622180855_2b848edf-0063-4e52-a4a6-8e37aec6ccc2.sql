ALTER TABLE public.project_selection_options
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS customer_notes text;