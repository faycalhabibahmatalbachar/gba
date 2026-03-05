-- ── Admin RLS policies for cart_items and favorites ───────────────────────────

-- cart_items : admin peut tout lire
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cart_items'
    AND policyname = 'admin: read all cart_items'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin: read all cart_items"
      ON public.cart_items FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    $policy$;
  END IF;
END $$;

-- cart_items : admin peut supprimer (clear cart)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cart_items'
    AND policyname = 'admin: delete cart_items'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin: delete cart_items"
      ON public.cart_items FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    $policy$;
  END IF;
END $$;

-- favorites : admin peut tout lire
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favorites'
    AND policyname = 'admin: read all favorites'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin: read all favorites"
      ON public.favorites FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    $policy$;
  END IF;
END $$;

-- favorites : admin peut supprimer
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favorites'
    AND policyname = 'admin: delete favorites'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin: delete favorites"
      ON public.favorites FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    $policy$;
  END IF;
END $$;
