-- Drivers + Delivery assignments + Live GPS tracking

-- =========================
-- DRIVERS
-- =========================
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drivers_is_active on public.drivers(is_active);

drop trigger if exists trg_drivers_updated_at on public.drivers;
create trigger trg_drivers_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

alter table public.drivers enable row level security;

drop policy if exists "drivers_admin_all" on public.drivers;
create policy "drivers_admin_all"
on public.drivers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "drivers_select_self" on public.drivers;
create policy "drivers_select_self"
on public.drivers
for select
to authenticated
using (user_id = auth.uid());

-- =========================
-- DELIVERY ASSIGNMENTS
-- =========================
create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id)
);

create index if not exists idx_delivery_assignments_driver_id on public.delivery_assignments(driver_id);

drop trigger if exists trg_delivery_assignments_updated_at on public.delivery_assignments;
create trigger trg_delivery_assignments_updated_at
before update on public.delivery_assignments
for each row execute function public.set_updated_at();

alter table public.delivery_assignments enable row level security;

drop policy if exists "delivery_assignments_admin_all" on public.delivery_assignments;
create policy "delivery_assignments_admin_all"
on public.delivery_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "delivery_assignments_owner_select" on public.delivery_assignments;
create policy "delivery_assignments_owner_select"
on public.delivery_assignments
for select
to authenticated
using (
  exists(
    select 1 from public.orders o
    where o.id = delivery_assignments.order_id
      and o.user_id = auth.uid()
  )
);

-- =========================
-- DRIVER LOCATIONS (LIVE TRACKING)
-- =========================
create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_locations_driver_id_captured_at
on public.driver_locations(driver_id, captured_at desc);

alter table public.driver_locations enable row level security;

drop policy if exists "driver_locations_admin_all" on public.driver_locations;
create policy "driver_locations_admin_all"
on public.driver_locations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "driver_locations_driver_insert" on public.driver_locations;
create policy "driver_locations_driver_insert"
on public.driver_locations
for insert
to authenticated
with check (
  exists(
    select 1 from public.drivers d
    where d.id = driver_locations.driver_id
      and d.user_id = auth.uid()
      and d.is_active = true
  )
);

drop policy if exists "driver_locations_driver_select" on public.driver_locations;
create policy "driver_locations_driver_select"
on public.driver_locations
for select
to authenticated
using (
  exists(
    select 1 from public.drivers d
    where d.id = driver_locations.driver_id
      and d.user_id = auth.uid()
  )
);
