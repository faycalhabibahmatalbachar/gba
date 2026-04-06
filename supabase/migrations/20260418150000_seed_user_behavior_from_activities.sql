-- Backfill minimal user_behavior depuis user_activities pour débloquer l'aperçu recommandations.
INSERT INTO public.user_behavior (user_id, product_id, action, duration_seconds, source, created_at)
SELECT
  ua.user_id,
  ua.entity_id::uuid AS product_id,
  CASE
    WHEN ua.action_type IN ('product_view', 'view_product', 'view') THEN 'view'
    WHEN ua.action_type IN ('cart_add', 'add_to_cart') THEN 'add_to_cart'
    WHEN ua.action_type IN ('purchase', 'order_paid', 'checkout_success') THEN 'purchase'
    WHEN ua.action_type IN ('wishlist_add', 'favorite_add') THEN 'wishlist'
    WHEN ua.action_type IN ('share', 'product_share') THEN 'share'
    ELSE 'view'
  END AS action,
  NULL::int AS duration_seconds,
  'backfill_user_activities' AS source,
  ua.created_at
FROM public.user_activities ua
WHERE ua.user_id IS NOT NULL
  AND ua.entity_type = 'product'
  AND ua.entity_id ~* '^[0-9a-f-]{36}$'
  AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = ua.entity_id::uuid)
  AND ua.action_type IN (
    'product_view', 'view_product', 'view',
    'cart_add', 'add_to_cart',
    'purchase', 'order_paid', 'checkout_success',
    'wishlist_add', 'favorite_add',
    'share', 'product_share'
  )
ON CONFLICT DO NOTHING;