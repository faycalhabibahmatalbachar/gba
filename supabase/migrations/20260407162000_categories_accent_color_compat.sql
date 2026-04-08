alter table if exists public.categories
  add column if not exists accent_color text;

