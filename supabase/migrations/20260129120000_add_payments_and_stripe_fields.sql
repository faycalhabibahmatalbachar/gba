-- Payments table + Stripe PaymentIntent fields

-- =========================
-- ORDERS: add payment provider + Stripe IDs
-- =========================
alter table public.orders
  add column if not exists currency text not null default 'XAF',
  add column if not exists payment_provider text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists paid_at timestamptz;

create index if not exists idx_orders_payment_provider on public.orders(payment_provider);
create index if not exists idx_orders_stripe_payment_intent_id on public.orders(stripe_payment_intent_id);

-- =========================
-- PAYMENTS
-- =========================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  status text not null default 'pending',
  amount numeric(12,2) not null default 0,
  currency text not null default 'XAF',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_provider on public.payments(provider);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_stripe_payment_intent_id on public.payments(stripe_payment_intent_id);
create index if not exists idx_payments_stripe_checkout_session_id on public.payments(stripe_checkout_session_id);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all"
on public.payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "payments_owner_select" on public.payments;
create policy "payments_owner_select"
on public.payments
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());
