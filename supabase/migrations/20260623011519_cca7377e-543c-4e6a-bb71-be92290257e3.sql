-- Add project type, description, and intake fields to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS project_description text,
  ADD COLUMN IF NOT EXISTS intake_timeline text,
  ADD COLUMN IF NOT EXISTS intake_budget text,
  ADD COLUMN IF NOT EXISTS intake_contact_method text,
  ADD COLUMN IF NOT EXISTS intake_notes text,
  ADD COLUMN IF NOT EXISTS intake_photos text[] NOT NULL DEFAULT '{}';