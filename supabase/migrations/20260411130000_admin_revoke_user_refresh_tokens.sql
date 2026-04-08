-- Révoquer toutes les sessions d'un utilisateur (refresh tokens) — appelée depuis l'admin BFF.
-- Nécessite des droits sur le schéma auth (exécution typique : migration Supabase).
CREATE OR REPLACE FUNCTION public.admin_revoke_user_refresh_tokens(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_user_refresh_tokens(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_refresh_tokens(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
