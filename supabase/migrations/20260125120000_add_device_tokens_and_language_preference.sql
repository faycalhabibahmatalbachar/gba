create extension if not exists pgcrypto;

alter table if exists public.profiles
add column if not exists language_preference text not null default 'fr';

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'unknown',
  locale text not null default 'fr',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx
on public.device_tokens(user_id);

create index if not exists device_tokens_last_seen_at_idx
on public.device_tokens(last_seen_at desc);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own"
on public.device_tokens
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own"
on public.device_tokens
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own"
on public.device_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own"
on public.device_tokens
for delete
to authenticated
using (user_id = auth.uid());
