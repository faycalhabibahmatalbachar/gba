-- ============================================================
-- Ajouter image_url aux payloads des triggers push notification
-- pour supporter les notifications riches avec images
-- ============================================================

-- ── 1. PRODUCT ADDED : inclure main_image ────────────────────
CREATE OR REPLACE FUNCTION public.on_product_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_active = true THEN
    PERFORM public.invoke_push_notification(
      jsonb_build_object(
        'type', 'product_added',
        'record', jsonb_build_object(
          'id', NEW.id,
          'name', NEW.name,
          'price', NEW.price,
          'image_url', NEW.main_image
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. ORDER CREATED : inclure image du 1er produit ──────────
CREATE OR REPLACE FUNCTION public.on_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  first_product_image TEXT;
BEGIN
  -- Récupérer l'image du premier produit de la commande
  SELECT p.main_image INTO first_product_image
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id
  ORDER BY oi.created_at ASC
  LIMIT 1;

  PERFORM public.invoke_push_notification(
    jsonb_build_object(
      'type', 'order_created',
      'record', jsonb_build_object(
        'id', NEW.id,
        'order_number', NEW.order_number,
        'total_amount', NEW.total_amount,
        'user_id', NEW.user_id,
        'image_url', COALESCE(first_product_image, '')
      )
    )
  );
  RETURN NEW;
END;
$$;

-- ── 3. ORDER STATUS CHANGED : inclure image du 1er produit ───
CREATE OR REPLACE FUNCTION public.on_order_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  first_product_image TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Récupérer l'image du premier produit
    SELECT p.main_image INTO first_product_image
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
    ORDER BY oi.created_at ASC
    LIMIT 1;

    PERFORM public.invoke_push_notification(
      jsonb_build_object(
        'type', 'order_status_changed',
        'record', jsonb_build_object(
          'id', NEW.id,
          'order_number', NEW.order_number,
          'status', NEW.status,
          'total_amount', NEW.total_amount,
          'user_id', NEW.user_id,
          'image_url', COALESCE(first_product_image, '')
        ),
        'old_record', jsonb_build_object(
          'status', OLD.status
        )
      )
    );
  END IF;

  -- Driver assigned
  IF (OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL) THEN
    SELECT p.main_image INTO first_product_image
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
    ORDER BY oi.created_at ASC
    LIMIT 1;

    PERFORM public.invoke_push_notification(
      jsonb_build_object(
        'type', 'driver_assigned',
        'record', jsonb_build_object(
          'id', NEW.id,
          'order_number', NEW.order_number,
          'total_amount', NEW.total_amount,
          'user_id', NEW.user_id,
          'driver_id', NEW.driver_id,
          'image_url', COALESCE(first_product_image, '')
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. BANNER CREATED : inclure image_url ────────────────────
CREATE OR REPLACE FUNCTION public.on_banner_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_active = true THEN
    PERFORM public.invoke_push_notification(
      jsonb_build_object(
        'type', 'banner_created',
        'record', jsonb_build_object(
          'id', NEW.id,
          'title', NEW.title,
          'description', NEW.description,
          'image_url', COALESCE(NEW.image_url, '')
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. SPECIAL ORDER CREATED : inclure image si dispo ────────
CREATE OR REPLACE FUNCTION public.on_special_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  first_image TEXT;
BEGIN
  -- Essayer de récupérer la première image de la commande spéciale
  SELECT soi.image_url INTO first_image
  FROM public.special_order_images soi
  WHERE soi.special_order_id = NEW.id
  ORDER BY soi.created_at ASC
  LIMIT 1;

  PERFORM public.invoke_push_notification(
    jsonb_build_object(
      'type', 'special_order_created',
      'record', jsonb_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'user_id', NEW.user_id,
        'product_name', NEW.product_name,
        'quantity', NEW.quantity,
        'image_url', COALESCE(first_image, '')
      )
    )
  );
  RETURN NEW;
END;
$$;
