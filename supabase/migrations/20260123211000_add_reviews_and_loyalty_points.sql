create extension if not exists pgcrypto;

alter table if exists public.products
add column if not exists rating double precision not null default 0,
add column if not exists reviews_count integer not null default 0;

alter table if exists public.profiles
add column if not exists loyalty_points integer not null default 0;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating >= 1 and rating <= 5)
);

create unique index if not exists reviews_unique_product_user
on public.reviews(product_id, user_id);

create index if not exists reviews_product_id_idx
on public.reviews(product_id);

create index if not exists reviews_user_id_idx
on public.reviews(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
before update on public.reviews
for each row
execute function public.set_updated_at();

create or replace function public.recalculate_product_reviews(p_product_id uuid)
returns void
language plpgsql
as $$
declare
  v_count integer;
  v_avg double precision;
begin
  select count(*), coalesce(avg(rating)::double precision, 0)
  into v_count, v_avg
  from public.reviews
  where product_id = p_product_id;

  update public.products
  set reviews_count = v_count,
      rating = v_avg
  where id = p_product_id;
end;
$$;

create or replace function public.on_reviews_changed()
returns trigger
language plpgsql
as $$
declare
  v_product_id uuid;
begin
  v_product_id := coalesce(new.product_id, old.product_id);
  perform public.recalculate_product_reviews(v_product_id);
  return null;
end;
$$;

drop trigger if exists reviews_after_insert on public.reviews;
drop trigger if exists reviews_after_update on public.reviews;
drop trigger if exists reviews_after_delete on public.reviews;

create trigger reviews_after_insert
after insert on public.reviews
for each row execute function public.on_reviews_changed();

create trigger reviews_after_update
after update on public.reviews
for each row execute function public.on_reviews_changed();

create trigger reviews_after_delete
after delete on public.reviews
for each row execute function public.on_reviews_changed();

create or replace function public.increment_loyalty_points(user_id uuid, points integer)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set loyalty_points = coalesce(loyalty_points, 0) + coalesce(points, 0)
  where id = user_id;
end;
$$;

create or replace function public.reward_points_on_review_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.increment_loyalty_points(new.user_id, 5);
  return new;
end;
$$;

drop trigger if exists reviews_reward_points on public.reviews;
create trigger reviews_reward_points
after insert on public.reviews
for each row execute function public.reward_points_on_review_insert();

alter table public.reviews enable row level security;

drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all"
  on public.reviews
  for select
  using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
  on public.reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
  on public.reviews
  for delete
  to authenticated
  using (auth.uid() = user_id);
