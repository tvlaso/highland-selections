ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS project_address text;

UPDATE public.projects SET project_address = address WHERE project_address IS NULL AND address IS NOT NULL;