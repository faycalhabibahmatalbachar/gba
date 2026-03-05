-- ============================================================
-- GBA — Sécurité & Cascade
-- Appliquer dans Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- A. Policy INSERT bannières — admin uniquement
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'banners' AND policyname = 'admin_insert_banners'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_insert_banners" ON public.banners
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    $policy$;
  END IF;
END$$;

-- Policy UPDATE bannières — admin uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'banners' AND policyname = 'admin_update_banners'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_update_banners" ON public.banners
        FOR UPDATE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    $policy$;
  END IF;
END$$;

-- Policy DELETE bannières — admin uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'banners' AND policyname = 'admin_delete_banners'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_delete_banners" ON public.banners
        FOR DELETE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    $policy$;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────
-- B. RPC delete_user_complete — suppression cascade FK-safe
--    Supprime : cart_items, favorites, commandes (nullable FK),
--               user_activities, profiles, puis auth.users
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_complete(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Seul un admin peut appeler cette fonction
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  -- 1. Supprimer les activités utilisateur
  DELETE FROM public.user_activities  WHERE user_id = target_user_id;

  -- 2. Supprimer le panier
  DELETE FROM public.cart_items       WHERE user_id = target_user_id;

  -- 3. Supprimer les favoris
  DELETE FROM public.favorites        WHERE user_id = target_user_id;

  -- 4. Dissocier les commandes (conserver l'historique, nullifier la FK)
  UPDATE public.orders
  SET user_id = NULL
  WHERE user_id = target_user_id;

  -- 5. Supprimer les tokens FCM
  DELETE FROM public.fcm_tokens       WHERE user_id = target_user_id;

  -- 6. Supprimer le profil applicatif
  DELETE FROM public.profiles         WHERE id = target_user_id;

  -- 7. Supprimer le compte auth (nécessite SECURITY DEFINER + service_role)
  DELETE FROM auth.users              WHERE id = target_user_id;

END;
$$;

-- Accorder l'exécution aux utilisateurs authentifiés
-- (la vérification admin est interne à la fonction)
GRANT EXECUTE ON FUNCTION public.delete_user_complete(UUID) TO authenticated;
