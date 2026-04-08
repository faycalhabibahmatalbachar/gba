-- Aligne push_templates avec le hub notifications (colonnes optionnelles si table créée par une migration antérieure).
ALTER TABLE public.push_templates
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.push_templates
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

NOTIFY pgrst, 'reload schema';
