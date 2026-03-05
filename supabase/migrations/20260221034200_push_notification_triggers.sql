-- ============================================================
-- Push Notification Triggers via pg_net → Edge Function
-- Uses FCM HTTP v1 API via send-push-notification Edge Function
-- ============================================================

-- Enable pg_net extension (async HTTP requests from Postgres)
create extension if not exists pg_net with schema extensions;

-- ── Helper: call send-push-notification Edge Function ────────
create or replace function public.invoke_push_notification(payload jsonb)
returns void
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://uvlrgwdbjegoavjfdrzb.supabase.co/functions/v1/send-push-notification',
    body := payload,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzI3ODYsImV4cCI6MjA3MTgwODc4Nn0.ZuMcEKbCKo5CtQGdn2KAHqHfBdROpvtLp7nJpJSHOUQ"}'::jsonb
  );
end;
$$;

-- ============================================================
-- 1. ORDER CREATED → notify admin
-- ============================================================
create or replace function public.on_order_created()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.invoke_push_notification(
    jsonb_build_object(
      'type', 'order_created',
      'record', jsonb_build_object(
        'id', NEW.id,
        'order_number', NEW.order_number,
        'total_amount', NEW.total_amount,
        'user_id', NEW.user_id
      )
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_order_created on public.orders;
create trigger trg_order_created
  after insert on public.orders
  for each row
  execute function public.on_order_created();

-- ============================================================
-- 2. ORDER STATUS CHANGED → notify customer
-- ============================================================
create or replace function public.on_order_status_changed()
returns trigger
language plpgsql
security definer
as $$
begin
  if OLD.status is distinct from NEW.status then
    perform public.invoke_push_notification(
      jsonb_build_object(
        'type', 'order_status_changed',
        'record', jsonb_build_object(
          'id', NEW.id,
          'order_number', NEW.order_number,
          'status', NEW.status,
          'total_amount', NEW.total_amount,
          'user_id', NEW.user_id
        ),
        'old_record', jsonb_build_object(
          'status', OLD.status
        )
      )
    );
  end if;

  -- Driver assigned
  if (OLD.driver_id is null and NEW.driver_id is not null) then
    perform public.invoke_push_notification(
      jsonb_build_object(
        'type', 'driver_assigned',
        'record', jsonb_build_object(
          'id', NEW.id,
          'order_number', NEW.order_number,
          'total_amount', NEW.total_amount,
          'user_id', NEW.user_id,
          'driver_id', NEW.driver_id
        )
      )
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_order_status_changed on public.orders;
create trigger trg_order_status_changed
  after update on public.orders
  for each row
  execute function public.on_order_status_changed();

-- ============================================================
-- 3. CHAT MESSAGE → notify recipient
-- ============================================================
create or replace function public.on_chat_message_created()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.invoke_push_notification(
    jsonb_build_object(
      'type', 'chat_message',
      'record', jsonb_build_object(
        'id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'message', left(NEW.message, 200)
      )
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_chat_message_created on public.chat_messages;
create trigger trg_chat_message_created
  after insert on public.chat_messages
  for each row
  execute function public.on_chat_message_created();

-- ============================================================
-- 4. PRODUCT ADDED → notify all users
-- ============================================================
create or replace function public.on_product_created()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.is_active = true then
    perform public.invoke_push_notification(
      jsonb_build_object(
        'type', 'product_added',
        'record', jsonb_build_object(
          'id', NEW.id,
          'name', NEW.name,
          'price', NEW.price
        )
      )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_product_created on public.products;
create trigger trg_product_created
  after insert on public.products
  for each row
  execute function public.on_product_created();

-- ============================================================
-- 5. BANNER CREATED → notify all users (promotions)
-- ============================================================
create or replace function public.on_banner_created()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.is_active = true then
    perform public.invoke_push_notification(
      jsonb_build_object(
        'type', 'banner_created',
        'record', jsonb_build_object(
          'id', NEW.id,
          'title', NEW.title,
          'description', NEW.description
        )
      )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_banner_created on public.banners;
create trigger trg_banner_created
  after insert on public.banners
  for each row
  execute function public.on_banner_created();
