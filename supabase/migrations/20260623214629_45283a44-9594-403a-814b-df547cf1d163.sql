ALTER TABLE public.master_catalog
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

-- Backfill the gallery from the existing single cover photo
UPDATE public.master_catalog
  SET images = ARRAY[image_url]
  WHERE image_url IS NOT NULL
    AND (images IS NULL OR images = '{}');