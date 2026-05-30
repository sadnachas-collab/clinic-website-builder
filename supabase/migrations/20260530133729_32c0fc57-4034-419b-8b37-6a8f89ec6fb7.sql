-- Добавляем поля, которые нужны UI админки для разделов «Категории направлений» и «Каталог процедур»
ALTER TABLE public.procedure_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb;