alter table if exists public.orders
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists delivery_accuracy double precision,
  add column if not exists delivery_captured_at timestamptz;

alter table if exists public.special_orders
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists delivery_accuracy double precision,
  add column if not exists delivery_captured_at timestamptz;
