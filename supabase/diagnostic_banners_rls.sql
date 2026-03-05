-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC BANNERS RLS — à coller dans Supabase SQL Editor
-- Identifie exactement pourquoi l'INSERT bannière est refusé
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. VOIR LES POLICIES ACTIVES SUR LA TABLE BANNERS
SELECT policyname, cmd, qual, with_check, roles
FROM pg_policies
WHERE tablename = 'banners' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 2. VOIR SI is_admin() EXISTE ET SA DÉFINITION
SELECT prosrc
FROM pg_proc
WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;

-- 3. VOIR LE RÔLE DE TOUS LES UTILISATEURS ADMIN EN BASE
SELECT id, email, role, is_blocked, created_at
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- 4. VOIR LE METADATA JWT DE L'UTILISATEUR ADMIN DANS AUTH.USERS
SELECT id, email,
  raw_user_meta_data ->> 'role'  AS jwt_user_meta_role,
  raw_app_meta_data  ->> 'role'  AS jwt_app_meta_role,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users
WHERE email = 'faycalhabibahmat@gmail.com';  -- ← remplacer si email différent

-- 5. FIXER IMMÉDIATEMENT : forcer role=admin pour cet utilisateur
-- (décommenter et exécuter si le profil n'a pas role='admin')
/*
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE id = (SELECT id FROM auth.users WHERE email = 'faycalhabibahmat@gmail.com');

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'::jsonb,
    raw_app_meta_data  = raw_app_meta_data  || '{"role":"admin"}'::jsonb
WHERE email = 'faycalhabibahmat@gmail.com';
*/

-- 6. VOIR LES POLICIES PROFILES (pour s'assurer que SELECT fonctionne)
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 7. VÉRIFIER QUE RLS EST ACTIVÉ
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('banners', 'profiles') AND relnamespace = 'public'::regnamespace;
