-- Fix user_activity_metrics: add missing columns (product_views, cart_adds, checkouts_started, last_action_at)
-- The migration 20260226220000 created 'products_viewed' but canonical schema uses 'product_views'

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_activity_metrics' AND column_name='product_views') THEN
        ALTER TABLE public.user_activity_metrics ADD COLUMN product_views BIGINT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_activity_metrics' AND column_name='cart_adds') THEN
        ALTER TABLE public.user_activity_metrics ADD COLUMN cart_adds BIGINT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_activity_metrics' AND column_name='checkouts_started') THEN
        ALTER TABLE public.user_activity_metrics ADD COLUMN checkouts_started BIGINT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_activity_metrics' AND column_name='last_action_at') THEN
        ALTER TABLE public.user_activity_metrics ADD COLUMN last_action_at TIMESTAMPTZ;
    END IF;
END $$;

-- Copy data from old column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_activity_metrics' AND column_name='products_viewed') THEN
        UPDATE public.user_activity_metrics SET product_views = COALESCE(products_viewed, 0) WHERE product_views = 0;
    END IF;
END $$;

-- Recreate bump trigger function to match canonical schema
CREATE OR REPLACE FUNCTION public.bump_user_activity_metrics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_activity_metrics(user_id, period_type, total_actions, product_views, cart_adds, checkouts_started, orders_placed, last_action_at)
  VALUES (
    NEW.user_id, 'all_time', 1,
    CASE WHEN NEW.action_type = 'product_view' THEN 1 ELSE 0 END,
    CASE WHEN NEW.action_type = 'cart_add' THEN 1 ELSE 0 END,
    CASE WHEN NEW.action_type = 'checkout_started' THEN 1 ELSE 0 END,
    CASE WHEN NEW.action_type = 'order_placed' THEN 1 ELSE 0 END,
    NEW.created_at
  )
  ON CONFLICT (user_id, period_type) WHERE period_start IS NULL
  DO UPDATE SET
    total_actions = user_activity_metrics.total_actions + 1,
    product_views = user_activity_metrics.product_views + (CASE WHEN EXCLUDED.product_views = 1 THEN 1 ELSE 0 END),
    cart_adds = user_activity_metrics.cart_adds + (CASE WHEN EXCLUDED.cart_adds = 1 THEN 1 ELSE 0 END),
    checkouts_started = user_activity_metrics.checkouts_started + (CASE WHEN EXCLUDED.checkouts_started = 1 THEN 1 ELSE 0 END),
    orders_placed = user_activity_metrics.orders_placed + (CASE WHEN EXCLUDED.orders_placed = 1 THEN 1 ELSE 0 END),
    last_action_at = GREATEST(COALESCE(user_activity_metrics.last_action_at, EXCLUDED.last_action_at), EXCLUDED.last_action_at),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_activities_bump_metrics ON public.user_activities;
CREATE TRIGGER trg_user_activities_bump_metrics
AFTER INSERT ON public.user_activities
FOR EACH ROW EXECUTE FUNCTION public.bump_user_activity_metrics();

SELECT 'Migration completed: Fixed user_activity_metrics columns' AS result;
