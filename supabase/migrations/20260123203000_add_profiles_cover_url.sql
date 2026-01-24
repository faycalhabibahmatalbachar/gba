alter table if exists public.profiles
add column if not exists cover_url text;
