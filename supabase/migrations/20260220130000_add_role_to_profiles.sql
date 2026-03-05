-- Add role column to profiles to distinguish drivers from regular customers
alter table public.profiles
  add column if not exists role text default null;

create index if not exists idx_profiles_role on public.profiles(role);

-- Allow drivers to read their own profile
drop policy if exists "Drivers can read own profile" on public.profiles;
create policy "Drivers can read own profile"
  on public.profiles for select
  using (id = auth.uid());
