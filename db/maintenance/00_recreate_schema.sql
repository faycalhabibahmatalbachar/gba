begin;

-- Extensions
create extension if not exists pgcrypto;

-- Grants (after DROP/CREATE schema these may be lost)
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;

-- Utility: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- PROFILES
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone text,
  bio text,
  date_of_birth date,
  gender text,
  address text,
  city text,
  postal_code text,
  country text,
  avatar_url text,
  total_orders integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  loyalty_points integer not null default 0,
  is_premium boolean not null default false,
  language_preference text not null default 'fr',
  notification_preferences jsonb not null default '{"email":true,"push":true,"sms":false}'::jsonb,
  member_since timestamptz,
  last_updated timestamptz,
  is_active boolean not null default true,
  last_sign_in timestamptz,

  -- Admin / moderation
  is_admin boolean not null default false,
  is_blocked boolean not null default false,
  block_reason text,
  blocked_at timestamptz,
  blocked_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Trigger: create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, is_admin, member_since, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    (new.email in ('admin@example.com', 'faycalhabibahmat@gmail.com')),
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      is_admin = public.profiles.is_admin or excluded.is_admin,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, first_name, last_name, member_since, created_at, updated_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'full_name', ''),
  coalesce(u.raw_user_meta_data->>'last_name', ''),
  now(),
  now(),
  now()
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles
set is_admin = true
where email in ('admin@example.com', 'faycalhabibahmat@gmail.com');

-- =========================
-- CATEGORIES
-- =========================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

insert into public.categories (name, slug, description, display_order, is_active)
values
  ('Électronique', 'electronique', 'Téléphones, ordinateurs, accessoires', 1, true),
  ('Mode', 'mode', 'Vêtements, chaussures, accessoires', 2, true)
on conflict (slug) do nothing;

drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public"
on public.categories
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write"
on public.categories
for insert
to authenticated
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "categories_admin_update" on public.categories;
create policy "categories_admin_update"
on public.categories
for update
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "categories_admin_delete" on public.categories;
create policy "categories_admin_delete"
on public.categories
for delete
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_path text,
  image_url text,
  target_route text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_banners_is_active on public.banners(is_active);
create index if not exists idx_banners_display_order on public.banners(display_order);

drop trigger if exists trg_banners_updated_at on public.banners;
create trigger trg_banners_updated_at
before update on public.banners
for each row execute function public.set_updated_at();

alter table public.banners enable row level security;

drop policy if exists "banners_select_public" on public.banners;
create policy "banners_select_public"
on public.banners
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "banners_select_admin_all" on public.banners;
create policy "banners_select_admin_all"
on public.banners
for select
to authenticated
using (public.is_admin());

drop policy if exists "banners_admin_write" on public.banners;
create policy "banners_admin_write"
on public.banners
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "banners_admin_update" on public.banners;
create policy "banners_admin_update"
on public.banners
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "banners_admin_delete" on public.banners;
create policy "banners_admin_delete"
on public.banners
for delete
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

drop policy if exists "banners_objects_select_public" on storage.objects;
create policy "banners_objects_select_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'banners');

drop policy if exists "banners_objects_insert_admin" on storage.objects;
create policy "banners_objects_insert_admin"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'banners' and public.is_admin());

drop policy if exists "banners_objects_update_admin" on storage.objects;
create policy "banners_objects_update_admin"
on storage.objects
for update
to authenticated
using (bucket_id = 'banners' and public.is_admin())
with check (bucket_id = 'banners' and public.is_admin());

drop policy if exists "banners_objects_delete_admin" on storage.objects;
create policy "banners_objects_delete_admin"
on storage.objects
for delete
to authenticated
using (bucket_id = 'banners' and public.is_admin());

-- =========================
-- PRODUCTS
-- =========================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  description text,
  price numeric(12,2) not null,
  compare_at_price numeric(12,2),
  sku text unique,
  quantity integer not null default 0,
  track_quantity boolean not null default true,
  category_id uuid references public.categories(id) on delete set null,
  brand text,
  main_image text,
  images text[] not null default '{}',
  specifications jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  rating double precision not null default 0,
  reviews_count integer not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_is_active on public.products(is_active);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "products_select_public" on public.products;
create policy "products_select_public"
on public.products
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
on public.products
for insert
to authenticated
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
on public.products
for update
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
on public.products
for delete
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- =========================
-- CART ITEMS
-- =========================
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1,
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create index if not exists idx_cart_items_user_id on public.cart_items(user_id);

drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

alter table public.cart_items enable row level security;

drop policy if exists "cart_items_owner_all" on public.cart_items;
create policy "cart_items_owner_all"
on public.cart_items
for all
to authenticated
using (
  user_id = auth.uid()
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
)
with check (
  user_id = auth.uid()
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- =========================
-- FAVORITES
-- =========================
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create index if not exists idx_favorites_user_id on public.favorites(user_id);

drop trigger if exists trg_favorites_updated_at on public.favorites;
create trigger trg_favorites_updated_at
before update on public.favorites
for each row execute function public.set_updated_at();

alter table public.favorites enable row level security;

drop policy if exists "favorites_owner_all" on public.favorites;
create policy "favorites_owner_all"
on public.favorites
for all
to authenticated
using (
  user_id = auth.uid()
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
)
with check (
  user_id = auth.uid()
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- =========================
-- SPECIAL ORDERS
-- =========================
create table if not exists public.special_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  description text not null,
  shipping_method text not null default 'air',
  notes text,
  status text not null default 'pending',
  eta_min_date timestamptz,
  eta_max_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.special_orders add column if not exists eta_min_date timestamptz;
alter table public.special_orders add column if not exists eta_max_date timestamptz;

create index if not exists idx_special_orders_user_id on public.special_orders(user_id);
create index if not exists idx_special_orders_created_at on public.special_orders(created_at);

drop trigger if exists trg_special_orders_updated_at on public.special_orders;
create trigger trg_special_orders_updated_at
before update on public.special_orders
for each row execute function public.set_updated_at();

alter table public.special_orders enable row level security;

drop policy if exists "special_orders_owner_select" on public.special_orders;
create policy "special_orders_owner_select"
on public.special_orders
for select
to authenticated
using (
  user_id = auth.uid()
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

drop policy if exists "special_orders_owner_insert" on public.special_orders;
create policy "special_orders_owner_insert"
on public.special_orders
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "special_orders_admin_update" on public.special_orders;
create policy "special_orders_admin_update"
on public.special_orders
for update
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "special_orders_admin_delete" on public.special_orders;
create policy "special_orders_admin_delete"
on public.special_orders
for delete
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Quotes: admin provides pricing + validity + optional terms
create table if not exists public.special_order_quotes (
  id uuid primary key default gen_random_uuid(),
  special_order_id uuid not null references public.special_orders(id) on delete cascade,
  quoted_by uuid references auth.users(id) on delete set null,
  quote_status text not null default 'quoted',
  currency text not null default 'XOF',
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_terms text,
  quote_valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_special_order_quotes_order_id on public.special_order_quotes(special_order_id);
create index if not exists idx_special_order_quotes_status on public.special_order_quotes(quote_status);

drop trigger if exists trg_special_order_quotes_updated_at on public.special_order_quotes;
create trigger trg_special_order_quotes_updated_at
before update on public.special_order_quotes
for each row execute function public.set_updated_at();

alter table public.special_order_quotes enable row level security;

drop policy if exists "special_order_quotes_owner_select" on public.special_order_quotes;
create policy "special_order_quotes_owner_select"
on public.special_order_quotes
for select
to authenticated
using (
  exists(
    select 1 from public.special_orders so
    where so.id = special_order_quotes.special_order_id
      and (so.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "special_order_quotes_admin_write" on public.special_order_quotes;
create policy "special_order_quotes_admin_write"
on public.special_order_quotes
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "special_order_quotes_admin_update" on public.special_order_quotes;
create policy "special_order_quotes_admin_update"
on public.special_order_quotes
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "special_order_quotes_admin_delete" on public.special_order_quotes;
create policy "special_order_quotes_admin_delete"
on public.special_order_quotes
for delete
to authenticated
using (public.is_admin());

-- Offers: structured thread (quote/counter/message)
create table if not exists public.special_order_offers (
  id uuid primary key default gen_random_uuid(),
  special_order_id uuid not null references public.special_orders(id) on delete cascade,
  type text not null default 'message',
  from_role text not null default 'customer',
  currency text,
  unit_price numeric(12,2),
  shipping_fee numeric(12,2),
  total numeric(12,2),
  message text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_special_order_offers_order_id on public.special_order_offers(special_order_id);
create index if not exists idx_special_order_offers_created_at on public.special_order_offers(created_at);

alter table public.special_order_offers enable row level security;

drop policy if exists "special_order_offers_owner_select" on public.special_order_offers;
create policy "special_order_offers_owner_select"
on public.special_order_offers
for select
to authenticated
using (
  exists(
    select 1 from public.special_orders so
    where so.id = special_order_offers.special_order_id
      and (so.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "special_order_offers_owner_insert" on public.special_order_offers;
create policy "special_order_offers_owner_insert"
on public.special_order_offers
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists(
    select 1 from public.special_orders so
    where so.id = special_order_offers.special_order_id
      and (
        (special_order_offers.from_role = 'customer' and so.user_id = auth.uid())
        or (special_order_offers.from_role = 'admin' and public.is_admin())
      )
  )
);

-- Events: timeline for tracking
create table if not exists public.special_order_events (
  id uuid primary key default gen_random_uuid(),
  special_order_id uuid not null references public.special_orders(id) on delete cascade,
  event_type text not null,
  label text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_special_order_events_order_id on public.special_order_events(special_order_id);
create index if not exists idx_special_order_events_created_at on public.special_order_events(created_at);

alter table public.special_order_events enable row level security;

drop policy if exists "special_order_events_owner_select" on public.special_order_events;
create policy "special_order_events_owner_select"
on public.special_order_events
for select
to authenticated
using (
  exists(
    select 1 from public.special_orders so
    where so.id = special_order_events.special_order_id
      and (so.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "special_order_events_insert_allowed" on public.special_order_events;
create policy "special_order_events_insert_allowed"
on public.special_order_events
for insert
to authenticated
with check (
  exists(
    select 1 from public.special_orders so
    where so.id = special_order_events.special_order_id
      and (so.user_id = auth.uid() or public.is_admin())
  )
);

-- View: special_order_details_view (for Flutter + admin)
create or replace view public.special_order_details_view with (security_invoker=true) as
select
  so.*,
  coalesce(imgs.images, '[]'::jsonb) as images,
  q.id as quote_id,
  q.quote_status,
  q.currency,
  q.unit_price,
  q.subtotal,
  q.shipping_fee as quote_shipping_fee,
  q.tax as quote_tax,
  q.service_fee as quote_service_fee,
  q.total as quote_total,
  q.payment_terms,
  q.quote_valid_until,
  q.quoted_by,
  q.created_at as quote_created_at
from public.special_orders so
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'id', soi.id,
        'image_path', soi.image_path,
        'image_url', soi.image_url,
        'created_at', soi.created_at
      )
      order by soi.created_at asc
    ) as images
  from public.special_order_images soi
  where soi.special_order_id = so.id
) imgs on true
left join lateral (
  select *
  from public.special_order_quotes soq
  where soq.special_order_id = so.id
  order by soq.created_at desc
  limit 1
) q on true;

-- RPC: admin sends a quote (computes totals + eta)
create or replace function public.admin_send_special_order_quote(
  p_special_order_id uuid,
  p_currency text,
  p_unit_price numeric,
  p_shipping_fee numeric,
  p_tax numeric,
  p_service_fee numeric,
  p_payment_terms text,
  p_valid_hours int,
  p_eta_min_days int,
  p_eta_max_days int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty int;
  v_subtotal numeric;
  v_total numeric;
  v_quote_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  select quantity into v_qty
  from public.special_orders
  where id = p_special_order_id;

  if v_qty is null then
    raise exception 'special_order not found';
  end if;

  v_subtotal := coalesce(p_unit_price, 0) * v_qty;
  v_total := v_subtotal + coalesce(p_shipping_fee, 0) + coalesce(p_tax, 0) + coalesce(p_service_fee, 0);

  update public.special_order_quotes
  set is_active = false
  where special_order_id = p_special_order_id and is_active = true;

  insert into public.special_order_quotes(
    special_order_id,
    quoted_by,
    quote_status,
    currency,
    unit_price,
    subtotal,
    shipping_fee,
    tax,
    service_fee,
    total,
    payment_terms,
    quote_valid_until,
    is_active
  ) values (
    p_special_order_id,
    auth.uid(),
    'quoted',
    coalesce(p_currency, 'XOF'),
    coalesce(p_unit_price, 0),
    v_subtotal,
    coalesce(p_shipping_fee, 0),
    coalesce(p_tax, 0),
    coalesce(p_service_fee, 0),
    v_total,
    nullif(p_payment_terms, ''),
    case when p_valid_hours is null then null else now() + make_interval(hours => p_valid_hours) end,
    true
  ) returning id into v_quote_id;

  update public.special_orders
  set
    status = 'quoted',
    eta_min_date = case when p_eta_min_days is null then null else now() + make_interval(days => p_eta_min_days) end,
    eta_max_date = case when p_eta_max_days is null then null else now() + make_interval(days => p_eta_max_days) end
  where id = p_special_order_id;

  insert into public.special_order_offers(
    special_order_id,
    type,
    from_role,
    currency,
    unit_price,
    shipping_fee,
    total,
    message,
    created_by
  ) values (
    p_special_order_id,
    'quote',
    'admin',
    coalesce(p_currency, 'XOF'),
    coalesce(p_unit_price, 0),
    coalesce(p_shipping_fee, 0),
    v_total,
    null,
    auth.uid()
  );

  insert into public.special_order_events(
    special_order_id,
    event_type,
    label,
    payload,
    created_by
  ) values (
    p_special_order_id,
    'quote_sent',
    'Devis envoyé',
    jsonb_build_object('quote_id', v_quote_id, 'total', v_total, 'currency', coalesce(p_currency, 'XOF')),
    auth.uid()
  );

  return v_quote_id;
end;
$$;

-- RPC: customer accepts latest valid quote
create or replace function public.customer_accept_special_order_quote(p_special_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_quote_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists(select 1 from public.special_orders so where so.id = p_special_order_id and so.user_id = v_user) then
    raise exception 'not allowed';
  end if;

  select id into v_quote_id
  from public.special_order_quotes q
  where q.special_order_id = p_special_order_id
    and q.is_active = true
    and q.quote_status in ('quoted','countered')
    and (q.quote_valid_until is null or q.quote_valid_until >= now())
  order by q.created_at desc
  limit 1;

  if v_quote_id is null then
    raise exception 'no active valid quote';
  end if;

  update public.special_order_quotes
  set quote_status = 'accepted', is_active = false
  where id = v_quote_id;

  update public.special_orders
  set status = 'accepted'
  where id = p_special_order_id;

  insert into public.special_order_events(special_order_id, event_type, label, payload, created_by)
  values (p_special_order_id, 'quote_accepted', 'Devis accepté', jsonb_build_object('quote_id', v_quote_id), v_user);

  return true;
end;
$$;

-- RPC: customer rejects quote
create or replace function public.customer_reject_special_order_quote(p_special_order_id uuid, p_message text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_quote_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists(select 1 from public.special_orders so where so.id = p_special_order_id and so.user_id = v_user) then
    raise exception 'not allowed';
  end if;

  select id into v_quote_id
  from public.special_order_quotes q
  where q.special_order_id = p_special_order_id and q.is_active = true
  order by q.created_at desc
  limit 1;

  if v_quote_id is null then
    raise exception 'no active quote';
  end if;

  update public.special_order_quotes
  set quote_status = 'rejected', is_active = false
  where id = v_quote_id;

  update public.special_orders
  set status = 'rejected'
  where id = p_special_order_id;

  insert into public.special_order_offers(special_order_id, type, from_role, message, created_by)
  values (p_special_order_id, 'message', 'customer', nullif(p_message, ''), v_user);

  insert into public.special_order_events(special_order_id, event_type, label, payload, created_by)
  values (p_special_order_id, 'quote_rejected', 'Devis refusé', jsonb_build_object('quote_id', v_quote_id), v_user);

  return true;
end;
$$;

-- RPC: customer submits counter offer
create or replace function public.customer_counter_special_order_quote(
  p_special_order_id uuid,
  p_unit_price numeric,
  p_shipping_fee numeric,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_quote_id uuid;
  v_qty int;
  v_total numeric;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select quantity into v_qty
  from public.special_orders so
  where so.id = p_special_order_id and so.user_id = v_user;

  if v_qty is null then
    raise exception 'not allowed';
  end if;

  select id into v_quote_id
  from public.special_order_quotes q
  where q.special_order_id = p_special_order_id and q.is_active = true
  order by q.created_at desc
  limit 1;

  if v_quote_id is null then
    raise exception 'no active quote';
  end if;

  v_total := coalesce(p_unit_price, 0) * v_qty + coalesce(p_shipping_fee, 0);

  update public.special_order_quotes
  set quote_status = 'countered'
  where id = v_quote_id;

  update public.special_orders
  set status = 'countered'
  where id = p_special_order_id;

  insert into public.special_order_offers(
    special_order_id,
    type,
    from_role,
    unit_price,
    shipping_fee,
    total,
    message,
    created_by
  ) values (
    p_special_order_id,
    'counter',
    'customer',
    p_unit_price,
    p_shipping_fee,
    v_total,
    nullif(p_message, ''),
    v_user
  );

  insert into public.special_order_events(special_order_id, event_type, label, payload, created_by)
  values (p_special_order_id, 'counter_sent', 'Contre-offre envoyée', jsonb_build_object('quote_id', v_quote_id), v_user);

  return true;
end;
$$;

create table if not exists public.special_order_images (
  id uuid primary key default gen_random_uuid(),
  special_order_id uuid not null references public.special_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_special_order_images_order_id on public.special_order_images(special_order_id);

alter table public.special_order_images enable row level security;

drop policy if exists "special_order_images_owner_select" on public.special_order_images;
create policy "special_order_images_owner_select"
on public.special_order_images
for select
to authenticated
using (
  user_id = auth.uid()
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

drop policy if exists "special_order_images_owner_insert" on public.special_order_images;
create policy "special_order_images_owner_insert"
on public.special_order_images
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists(select 1 from public.special_orders so where so.id = special_order_images.special_order_id and so.user_id = auth.uid())
);

insert into storage.buckets (id, name, public)
values ('special_orders', 'special_orders', true)
on conflict (id) do nothing;

drop policy if exists "special_orders_objects_select_public" on storage.objects;
create policy "special_orders_objects_select_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'special_orders');

drop policy if exists "special_orders_objects_insert_owner" on storage.objects;
create policy "special_orders_objects_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'special_orders'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "special_orders_objects_update_owner" on storage.objects;
create policy "special_orders_objects_update_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'special_orders'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'special_orders'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "special_orders_objects_delete_owner" on storage.objects;
create policy "special_orders_objects_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'special_orders'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- =========================
-- ORDERS
-- =========================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  total_amount numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) generated always as (shipping_fee) stored,
  tax_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  payment_method text,
  payment_status text not null default 'pending',
  customer_name text,
  customer_phone text,
  customer_email text,
  shipping_country text,
  shipping_city text,
  shipping_district text,
  shipping_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_created_at on public.orders(created_at);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

drop policy if exists "orders_owner_select" on public.orders;
create policy "orders_owner_select"
on public.orders
for select
to authenticated
using (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "orders_owner_insert" on public.orders;
create policy "orders_owner_insert"
on public.orders
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
on public.orders
for update
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- =========================
-- ORDER ITEMS
-- =========================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  product_image text,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on public.order_items(order_id);

alter table public.order_items enable row level security;

drop policy if exists "order_items_owner_select" on public.order_items;
create policy "order_items_owner_select"
on public.order_items
for select
to authenticated
using (
  exists(
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  )
);

drop policy if exists "order_items_owner_insert" on public.order_items;
create policy "order_items_owner_insert"
on public.order_items
for insert
to authenticated
with check (
  exists(select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);

-- View: order_details_view (used by Flutter + admin)
create or replace view public.order_details_view with (security_invoker=true) as
select
  o.*,
  p.phone as customer_phone_profile,
  coalesce(items.items, '[]'::jsonb) as items,
  coalesce(items.total_items, 0) as total_items
from public.orders o
left join public.profiles p on p.id = o.user_id
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'product_image', oi.product_image,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'created_at', oi.created_at
      )
      order by oi.created_at asc
    ) as items,
    sum(oi.quantity)::int as total_items
  from public.order_items oi
  where oi.order_id = o.id
) items on true;

-- RPC: get_order_statistics (used by admin)
create or replace function public.get_order_statistics(p_period text)
returns table(
  total_orders bigint,
  pending_orders bigint,
  completed_orders bigint,
  total_revenue numeric,
  start_date timestamptz,
  end_date timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz := now();
begin
  if p_period = 'day' then
    v_start := date_trunc('day', now());
  elsif p_period = 'week' then
    v_start := date_trunc('week', now());
  elsif p_period = 'month' then
    v_start := date_trunc('month', now());
  elsif p_period = 'year' then
    v_start := date_trunc('year', now());
  else
    v_start := date_trunc('month', now());
  end if;

  return query
  select
    count(*) as total_orders,
    count(*) filter (where status = 'pending') as pending_orders,
    count(*) filter (where status = 'delivered') as completed_orders,
    coalesce(sum(total_amount), 0) as total_revenue,
    v_start as start_date,
    v_end as end_date
  from public.orders
  where created_at >= v_start and created_at <= v_end;
end;
$$;

-- =========================
-- CHAT (customer support)
-- =========================
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid,
  order_id text,
  status text not null default 'active',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_conversations_user_id on public.chat_conversations(user_id);

drop trigger if exists trg_chat_conversations_updated_at on public.chat_conversations;
create trigger trg_chat_conversations_updated_at
before update on public.chat_conversations
for each row execute function public.set_updated_at();

alter table public.chat_conversations enable row level security;

drop policy if exists "chat_conversations_owner_select" on public.chat_conversations;
create policy "chat_conversations_owner_select"
on public.chat_conversations
for select
to authenticated
using (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "chat_conversations_owner_insert" on public.chat_conversations;
create policy "chat_conversations_owner_insert"
on public.chat_conversations
for insert
to authenticated
with check (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "chat_conversations_admin_update" on public.chat_conversations;
create policy "chat_conversations_admin_update"
on public.chat_conversations
for update
to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null,
  sender_type text not null default 'customer',
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation_id on public.chat_messages(conversation_id);
create index if not exists idx_chat_messages_created_at on public.chat_messages(created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_conv_select" on public.chat_messages;
create policy "chat_messages_conv_select"
on public.chat_messages
for select
to authenticated
using (
  exists(
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and (c.user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  )
);

drop policy if exists "chat_messages_conv_insert" on public.chat_messages;
create policy "chat_messages_conv_insert"
on public.chat_messages
for insert
to authenticated
with check (
  exists(
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and (c.user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  )
  and (
    chat_messages.sender_id = auth.uid()
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
);

drop policy if exists "chat_messages_conv_update" on public.chat_messages;
create policy "chat_messages_conv_update"
on public.chat_messages
for update
to authenticated
using (
  exists(
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and (c.user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  )
)
with check (
  exists(
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and (c.user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  )
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  file_url text not null,
  file_type text,
  file_name text,
  created_at timestamptz not null default now()
);

alter table public.message_attachments enable row level security;

drop policy if exists "message_attachments_select" on public.message_attachments;
create policy "message_attachments_select"
on public.message_attachments
for select
to authenticated
using (
  exists(
    select 1 from public.chat_messages m
    join public.chat_conversations c on c.id = m.conversation_id
    where m.id = message_attachments.message_id
      and (c.user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  )
);

drop policy if exists "message_attachments_insert" on public.message_attachments;
create policy "message_attachments_insert"
on public.message_attachments
for insert
to authenticated
with check (
  exists(
    select 1 from public.chat_messages m
    join public.chat_conversations c on c.id = m.conversation_id
    where m.id = message_attachments.message_id
      and (c.user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  )
);

-- =========================
-- TRACKING (Activity)
-- =========================
create table if not exists public.user_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  action_details jsonb not null default '{}'::jsonb,
  activity_type text,
  activity_details jsonb,
  entity_type text,
  entity_id text,
  entity_name text,
  page_name text,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activities_user_id on public.user_activities(user_id);
create index if not exists idx_user_activities_created_at on public.user_activities(created_at);

alter table public.user_activities enable row level security;

drop policy if exists "user_activities_owner_select" on public.user_activities;
create policy "user_activities_owner_select"
on public.user_activities
for select
to authenticated
using (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "user_activities_owner_insert" on public.user_activities;
create policy "user_activities_owner_insert"
on public.user_activities
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

create or replace function public.normalize_user_activity_columns()
returns trigger
language plpgsql
as $$
begin
  if new.action_type is null then
    new.action_type := new.activity_type;
  end if;
  if new.activity_type is null then
    new.activity_type := new.action_type;
  end if;

  if new.activity_details is not null then
    new.action_details := new.activity_details;
  end if;

  if new.action_details is null then
    new.action_details := '{}'::jsonb;
  end if;

  new.activity_details := new.action_details;

  return new;
end;
$$;

drop trigger if exists trg_user_activities_normalize on public.user_activities;
create trigger trg_user_activities_normalize
before insert or update on public.user_activities
for each row execute function public.normalize_user_activity_columns();

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  session_id text not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_sessions_user_id on public.user_sessions(user_id);

alter table public.user_sessions enable row level security;

drop policy if exists "user_sessions_owner_all" on public.user_sessions;
create policy "user_sessions_owner_all"
on public.user_sessions
for all
to authenticated
using (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function public.log_user_activity(
  p_user_id uuid,
  p_action_type text,
  p_action_details jsonb default '{}'::jsonb,
  p_entity_type text default null,
  p_entity_id text default null,
  p_entity_name text default null,
  p_page_name text default null,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if p_user_id <> auth.uid() then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  insert into public.user_activities(
    user_id,
    action_type,
    action_details,
    entity_type,
    entity_id,
    entity_name,
    page_name,
    session_id
  ) values (
    p_user_id,
    p_action_type,
    coalesce(p_action_details, '{}'::jsonb),
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_page_name,
    p_session_id
  );
end;
$$;

create or replace function public.increment_loyalty_points(
  user_id uuid,
  points integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if user_id <> auth.uid() and not exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Forbidden';
  end if;

  update public.profiles
  set loyalty_points = greatest(0, coalesce(loyalty_points, 0) + coalesce(points, 0)),
      last_updated = now(),
      updated_at = now()
  where id = user_id;
end;
$$;

create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connected_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_connections_user_id on public.user_connections(user_id);
create index if not exists idx_user_connections_connected_at on public.user_connections(connected_at);

alter table public.user_connections enable row level security;

drop policy if exists "user_connections_owner_select" on public.user_connections;
create policy "user_connections_owner_select"
on public.user_connections
for select
to authenticated
using (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "user_connections_owner_insert" on public.user_connections;
create policy "user_connections_owner_insert"
on public.user_connections
for insert
to authenticated
with check (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace view public.user_stats with (security_invoker=true) as
select
  p.id as user_id,
  coalesce(conn.total_connections, 0) as total_connections,
  coalesce(conn.connections_today, 0) as connections_today,
  coalesce(conn.connections_this_month, 0) as connections_this_month,
  conn.last_login_at,
  act.last_activity_at,
  coalesce(ord.total_orders, 0) as total_orders,
  coalesce(ord.total_spent, 0) as total_spent,
  coalesce(fav.total_favorites, 0) as total_favorites,
  p.loyalty_points
from public.profiles p
left join lateral (
  select
    count(*)::int as total_connections,
    count(*) filter (where connected_at >= date_trunc('day', now()))::int as connections_today,
    count(*) filter (where connected_at >= date_trunc('month', now()))::int as connections_this_month,
    max(connected_at) as last_login_at
  from public.user_connections uc
  where uc.user_id = p.id
) conn on true
left join lateral (
  select max(created_at) as last_activity_at
  from public.user_activities ua
  where ua.user_id = p.id
) act on true
left join lateral (
  select
    count(*)::int as total_orders,
    coalesce(sum(total_amount), 0) as total_spent
  from public.orders o
  where o.user_id = p.id
) ord on true
left join lateral (
  select count(*)::int as total_favorites
  from public.favorites f
  where f.user_id = p.id
) fav on true;

create or replace view public.top_viewed_products with (security_invoker=true) as
select
  p.id as product_id,
  p.name as product_name,
  p.main_image as product_image,
  count(*)::bigint as view_count
from public.user_activities ua
join public.products p on p.id::text = ua.entity_id
where ua.action_type = 'product_view'
group by p.id, p.name, p.main_image
order by view_count desc;

create or replace view public.conversion_metrics with (security_invoker=true) as
with daily as (
  select
    date_trunc('day', created_at)::date as date,
    count(*) filter (where action_type = 'app_opened')::bigint as visitors,
    count(*) filter (where action_type = 'cart_add')::bigint as cart_adds,
    count(*) filter (where action_type = 'checkout_started')::bigint as checkouts_started,
    count(*) filter (where action_type = 'order_placed')::bigint as orders_placed
  from public.user_activities
  group by 1
)
select
  date,
  visitors,
  cart_adds,
  checkouts_started,
  orders_placed,
  case when visitors = 0 then 0 else (orders_placed::numeric / visitors::numeric) end as overall_conversion_rate,
  case when cart_adds = 0 then 0 else (checkouts_started::numeric / cart_adds::numeric) end as cart_to_checkout_rate,
  case when checkouts_started = 0 then 0 else (orders_placed::numeric / checkouts_started::numeric) end as checkout_to_order_rate
from daily
order by date desc;

create table if not exists public.user_activity_metrics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_type text not null,
  total_actions bigint not null default 0,
  product_views bigint not null default 0,
  cart_adds bigint not null default 0,
  checkouts_started bigint not null default 0,
  orders_placed bigint not null default 0,
  last_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_type)
);

insert into public.user_activity_metrics (
  user_id,
  period_type,
  total_actions,
  product_views,
  cart_adds,
  checkouts_started,
  orders_placed,
  last_action_at
)
select
  ua.user_id,
  'all_time' as period_type,
  count(*)::bigint as total_actions,
  count(*) filter (where action_type = 'product_view')::bigint as product_views,
  count(*) filter (where action_type = 'cart_add')::bigint as cart_adds,
  count(*) filter (where action_type = 'checkout_started')::bigint as checkouts_started,
  count(*) filter (where action_type = 'order_placed')::bigint as orders_placed,
  max(created_at) as last_action_at
from public.user_activities ua
group by ua.user_id
on conflict (user_id, period_type) do update
set
  total_actions = excluded.total_actions,
  product_views = excluded.product_views,
  cart_adds = excluded.cart_adds,
  checkouts_started = excluded.checkouts_started,
  orders_placed = excluded.orders_placed,
  last_action_at = excluded.last_action_at,
  updated_at = now();

create index if not exists idx_user_activity_metrics_user_id on public.user_activity_metrics(user_id);

drop trigger if exists trg_user_activity_metrics_updated_at on public.user_activity_metrics;
create trigger trg_user_activity_metrics_updated_at
before update on public.user_activity_metrics
for each row execute function public.set_updated_at();

alter table public.user_activity_metrics enable row level security;

drop policy if exists "user_activity_metrics_select" on public.user_activity_metrics;
create policy "user_activity_metrics_select"
on public.user_activity_metrics
for select
to authenticated
using (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function public.bump_user_activity_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_activity_metrics(
    user_id,
    period_type,
    total_actions,
    product_views,
    cart_adds,
    checkouts_started,
    orders_placed,
    last_action_at
  ) values (
    new.user_id,
    'all_time',
    1,
    case when new.action_type = 'product_view' then 1 else 0 end,
    case when new.action_type = 'cart_add' then 1 else 0 end,
    case when new.action_type = 'checkout_started' then 1 else 0 end,
    case when new.action_type = 'order_placed' then 1 else 0 end,
    new.created_at
  )
  on conflict (user_id, period_type) do update
  set
    total_actions = public.user_activity_metrics.total_actions + 1,
    product_views = public.user_activity_metrics.product_views + (case when excluded.product_views = 1 then 1 else 0 end),
    cart_adds = public.user_activity_metrics.cart_adds + (case when excluded.cart_adds = 1 then 1 else 0 end),
    checkouts_started = public.user_activity_metrics.checkouts_started + (case when excluded.checkouts_started = 1 then 1 else 0 end),
    orders_placed = public.user_activity_metrics.orders_placed + (case when excluded.orders_placed = 1 then 1 else 0 end),
    last_action_at = greatest(coalesce(public.user_activity_metrics.last_action_at, excluded.last_action_at), excluded.last_action_at),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_user_activities_bump_metrics on public.user_activities;
create trigger trg_user_activities_bump_metrics
after insert on public.user_activities
for each row execute function public.bump_user_activity_metrics();

create or replace function public.get_realtime_analytics()
returns table(
  active_users_now bigint,
  active_sessions bigint,
  actions_last_hour bigint,
  actions_today bigint,
  top_action_type text,
  top_page text
)
language sql
security definer
set search_path = public
as $$
  with
  last15 as (
    select distinct user_id
    from public.user_activities
    where created_at >= now() - interval '15 minutes'
  ),
  sess as (
    select count(*)::bigint as active_sessions
    from public.user_sessions
    where created_at >= now() - interval '30 minutes'
  ),
  last_hour as (
    select count(*)::bigint as actions_last_hour
    from public.user_activities
    where created_at >= now() - interval '1 hour'
  ),
  today as (
    select count(*)::bigint as actions_today
    from public.user_activities
    where created_at >= date_trunc('day', now())
  ),
  top_action as (
    select action_type
    from public.user_activities
    where created_at >= date_trunc('day', now())
    group by action_type
    order by count(*) desc
    limit 1
  ),
  top_pg as (
    select page_name
    from public.user_activities
    where created_at >= date_trunc('day', now())
      and page_name is not null
      and length(trim(page_name)) > 0
    group by page_name
    order by count(*) desc
    limit 1
  )
  select
    (select count(*) from last15) as active_users_now,
    (select active_sessions from sess) as active_sessions,
    (select actions_last_hour from last_hour) as actions_last_hour,
    (select actions_today from today) as actions_today,
    coalesce((select action_type from top_action), 'N/A') as top_action_type,
    coalesce((select page_name from top_pg), 'N/A') as top_page;
$$;

create or replace function public.get_real_time_metrics()
returns table(
  active_users_count bigint,
  new_users_today bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(distinct user_id)
     from public.user_activities
     where created_at >= now() - interval '30 minutes') as active_users_count,
    (select count(*)
     from public.profiles
     where created_at >= date_trunc('day', now())) as new_users_today;
$$;

-- =========================
-- REALTIME publication (best-effort)
-- =========================
do $$
begin
  begin alter publication supabase_realtime add table public.products; exception when others then null; end;
  begin alter publication supabase_realtime add table public.categories; exception when others then null; end;
  begin alter publication supabase_realtime add table public.banners; exception when others then null; end;
  begin alter publication supabase_realtime add table public.cart_items; exception when others then null; end;
  begin alter publication supabase_realtime add table public.favorites; exception when others then null; end;
  begin alter publication supabase_realtime add table public.special_orders; exception when others then null; end;
  begin alter publication supabase_realtime add table public.special_order_images; exception when others then null; end;
  begin alter publication supabase_realtime add table public.special_order_quotes; exception when others then null; end;
  begin alter publication supabase_realtime add table public.special_order_offers; exception when others then null; end;
  begin alter publication supabase_realtime add table public.special_order_events; exception when others then null; end;
  begin alter publication supabase_realtime add table public.orders; exception when others then null; end;
  begin alter publication supabase_realtime add table public.order_items; exception when others then null; end;
  begin alter publication supabase_realtime add table public.chat_conversations; exception when others then null; end;
  begin alter publication supabase_realtime add table public.chat_messages; exception when others then null; end;
end;
$$;

commit;
