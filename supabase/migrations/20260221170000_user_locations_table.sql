-- user_locations: real-time GPS positions published by client app
create table if not exists public.user_locations (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  lat       double precision not null,
  lng       double precision not null,
  speed     double precision default 0,
  heading   double precision default 0,
  accuracy  double precision default 0,
  captured_at timestamptz default now()
);

alter table public.user_locations enable row level security;

create policy "users_own_location"
  on public.user_locations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "drivers_read_user_locations"
  on public.user_locations for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'driver'
    )
  );

alter publication supabase_realtime add table public.user_locations;
