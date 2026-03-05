-- Add driver_id column to orders table so deliveries can be assigned directly
-- The driver app queries: orders WHERE driver_id = auth.uid()

alter table public.orders
  add column if not exists driver_id uuid references auth.users(id) on delete set null;

create index if not exists idx_orders_driver_id on public.orders(driver_id);

-- Allow drivers to see their assigned orders
drop policy if exists "Drivers can view their assigned orders" on public.orders;
create policy "Drivers can view their assigned orders"
  on public.orders for select
  using (driver_id = auth.uid());

-- Allow drivers to update status of their assigned orders
drop policy if exists "Drivers can update their assigned orders" on public.orders;
create policy "Drivers can update their assigned orders"
  on public.orders for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- Allow admins (service role) to assign driver_id
-- (service role bypasses RLS, so no extra policy needed for admin writes)
