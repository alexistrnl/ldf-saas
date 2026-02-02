-- Migration: Sécuriser l'admin avec RLS basé sur profiles.is_admin
-- 
-- OBJECTIF:
-- 1. Créer une fonction helper pour vérifier si un utilisateur est admin
-- 2. Appliquer RLS sur toutes les tables utilisées par l'admin
-- 3. Empêcher la modification de is_admin sauf par les admins
-- 4. Seuls les utilisateurs avec profiles.is_admin=true peuvent accéder aux données admin
--
-- NOTE: Cette migration remplace l'ancien système basé sur admin_users.
-- Les policies existantes seront remplacées par les nouvelles basées sur profiles.is_admin.

-- ============================================================
-- ÉTAPE 1: Fonction helper pour vérifier si un utilisateur est admin
-- ============================================================

-- Fonction qui vérifie si l'utilisateur connecté a is_admin=true dans profiles
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_user() IS 'Vérifie si l''utilisateur connecté est admin (profiles.is_admin=true)';

-- ============================================================
-- ÉTAPE 2: RLS sur la table profiles
-- ============================================================

-- Activer RLS sur profiles si ce n'est pas déjà fait
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Tous les utilisateurs authentifiés peuvent lire leur propre profil
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Tous les utilisateurs authentifiés peuvent lire les profils publics
DROP POLICY IF EXISTS "Users can read public profiles" ON public.profiles;
CREATE POLICY "Users can read public profiles"
  ON public.profiles
  FOR SELECT
  USING (is_public = true OR auth.uid() = id);

-- Policy: Les admins peuvent lire tous les profils
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin_user());

-- Policy: Les utilisateurs peuvent mettre à jour leur propre profil (sauf is_admin et is_verified)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Empêcher la modification de is_admin et is_verified par l'utilisateur lui-même
    AND (OLD.is_admin = NEW.is_admin OR OLD.is_admin IS NULL AND NEW.is_admin IS NULL)
    AND (OLD.is_verified = NEW.is_verified OR OLD.is_verified IS NULL AND NEW.is_verified IS NULL)
  );

-- Policy: Les admins peuvent mettre à jour tous les profils (y compris is_verified)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Policy: Empêcher la modification de is_admin sauf par les admins
-- Cette policy est déjà couverte par "Admins can update all profiles" mais on la rend explicite
-- On utilise un trigger pour bloquer les tentatives de modification de is_admin par les non-admins

-- Trigger pour empêcher la modification de is_admin par les non-admins
CREATE OR REPLACE FUNCTION public.prevent_non_admin_is_admin_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si l'utilisateur essaie de modifier is_admin et qu'il n'est pas admin, bloquer
  IF (OLD.is_admin IS DISTINCT FROM NEW.is_admin) AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent modifier le statut is_admin';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS prevent_is_admin_update ON public.profiles;

-- Créer le trigger
CREATE TRIGGER prevent_is_admin_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_admin_is_admin_update();

COMMENT ON FUNCTION public.prevent_non_admin_is_admin_update() IS 'Empêche la modification de is_admin par les non-admins';

-- ============================================================
-- ÉTAPE 3: RLS sur la table restaurants
-- ============================================================

-- Activer RLS sur restaurants si ce n'est pas déjà fait
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Policy: Tous les utilisateurs authentifiés peuvent lire les restaurants (pour l'app)
DROP POLICY IF EXISTS "Authenticated users can read restaurants" ON public.restaurants;
CREATE POLICY "Authenticated users can read restaurants"
  ON public.restaurants
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Seuls les admins peuvent INSERT/UPDATE/DELETE sur restaurants
DROP POLICY IF EXISTS "Admins can manage restaurants" ON public.restaurants;
CREATE POLICY "Admins can manage restaurants"
  ON public.restaurants
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ============================================================
-- ÉTAPE 4: RLS sur la table dishes
-- ============================================================

-- Activer RLS sur dishes si ce n'est pas déjà fait
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;

-- Policy: Tous les utilisateurs authentifiés peuvent lire les plats (pour l'app)
DROP POLICY IF EXISTS "Authenticated users can read dishes" ON public.dishes;
CREATE POLICY "Authenticated users can read dishes"
  ON public.dishes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Seuls les admins peuvent INSERT/UPDATE/DELETE sur dishes
DROP POLICY IF EXISTS "Admins can manage dishes" ON public.dishes;
CREATE POLICY "Admins can manage dishes"
  ON public.dishes
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ============================================================
-- ÉTAPE 5: RLS sur la table brand_suggestions
-- ============================================================

-- Activer RLS sur brand_suggestions si ce n'est pas déjà fait
ALTER TABLE public.brand_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs authentifiés peuvent insérer leurs propres suggestions
DROP POLICY IF EXISTS "Users can insert own suggestions" ON public.brand_suggestions;
CREATE POLICY "Users can insert own suggestions"
  ON public.brand_suggestions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Policy: Les utilisateurs peuvent lire leurs propres suggestions
DROP POLICY IF EXISTS "Users can read own suggestions" ON public.brand_suggestions;
CREATE POLICY "Users can read own suggestions"
  ON public.brand_suggestions
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- Policy: Seuls les admins peuvent lire toutes les suggestions
DROP POLICY IF EXISTS "Admins can read all suggestions" ON public.brand_suggestions;
CREATE POLICY "Admins can read all suggestions"
  ON public.brand_suggestions
  FOR SELECT
  USING (public.is_admin_user());

-- Policy: Seuls les admins peuvent UPDATE/DELETE sur brand_suggestions
DROP POLICY IF EXISTS "Admins can manage suggestions" ON public.brand_suggestions;
CREATE POLICY "Admins can manage suggestions"
  ON public.brand_suggestions
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can delete suggestions" ON public.brand_suggestions;
CREATE POLICY "Admins can delete suggestions"
  ON public.brand_suggestions
  FOR DELETE
  USING (public.is_admin_user());

-- ============================================================
-- ÉTAPE 6: RLS sur la table fastfood_logs (si utilisée par l'admin)
-- ============================================================

-- Activer RLS sur fastfood_logs si ce n'est pas déjà fait
ALTER TABLE public.fastfood_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent lire leurs propres logs
DROP POLICY IF EXISTS "Users can read own logs" ON public.fastfood_logs;
CREATE POLICY "Users can read own logs"
  ON public.fastfood_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent créer leurs propres logs
DROP POLICY IF EXISTS "Users can insert own logs" ON public.fastfood_logs;
CREATE POLICY "Users can insert own logs"
  ON public.fastfood_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent modifier leurs propres logs
DROP POLICY IF EXISTS "Users can update own logs" ON public.fastfood_logs;
CREATE POLICY "Users can update own logs"
  ON public.fastfood_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent supprimer leurs propres logs
DROP POLICY IF EXISTS "Users can delete own logs" ON public.fastfood_logs;
CREATE POLICY "Users can delete own logs"
  ON public.fastfood_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Les admins peuvent lire tous les logs
DROP POLICY IF EXISTS "Admins can read all logs" ON public.fastfood_logs;
CREATE POLICY "Admins can read all logs"
  ON public.fastfood_logs
  FOR SELECT
  USING (public.is_admin_user());

-- Policy: Les admins peuvent modifier/supprimer tous les logs
DROP POLICY IF EXISTS "Admins can manage all logs" ON public.fastfood_logs;
CREATE POLICY "Admins can manage all logs"
  ON public.fastfood_logs
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ============================================================
-- NOTES IMPORTANTES
-- ============================================================
-- 
-- Pour définir un utilisateur comme admin, exécuter dans Supabase SQL Editor:
-- 
-- UPDATE public.profiles 
-- SET is_admin = true 
-- WHERE id = '<user_id>';
-- 
-- Pour vérifier qu'un utilisateur est admin:
-- SELECT id, email, is_admin FROM public.profiles WHERE id = '<user_id>';
-- 
-- Pour obtenir votre user_id:
-- 1. Connectez-vous à l'application
-- 2. Ouvrez la console du navigateur
-- 3. Exécutez: (await supabase.auth.getUser()).data.user.id
-- 
-- OU dans Supabase Dashboard > Authentication > Users, trouvez votre utilisateur et copiez l'ID
