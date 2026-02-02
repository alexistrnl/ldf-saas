-- Migration: Ajouter la colonne email à la table profiles et synchroniser avec auth.users
-- Date: 2025-01-15

-- 1. Ajouter la colonne email si elle n'existe pas
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Créer une fonction pour synchroniser l'email depuis auth.users
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour l'email dans profiles quand l'email change dans auth.users
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Créer un trigger pour synchroniser automatiquement l'email lors de la création d'un utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = NEW.email,
      updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Créer le trigger sur auth.users pour synchroniser l'email lors de la création
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Créer le trigger sur auth.users pour synchroniser l'email lors de la mise à jour
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_email();

-- 6. Synchroniser les emails existants pour les profils qui n'ont pas encore d'email
-- Note: Cette requête nécessite des permissions élevées et peut être exécutée manuellement
-- ou via une fonction Supabase Edge Function
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Pour chaque utilisateur dans auth.users, mettre à jour profiles.email si NULL
  FOR user_record IN 
    SELECT id, email FROM auth.users
  LOOP
    UPDATE public.profiles
    SET email = user_record.email
    WHERE id = user_record.id AND (email IS NULL OR email != user_record.email);
  END LOOP;
END $$;

-- 7. Index pour améliorer les performances de recherche par email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN public.profiles.email IS 'Email de l''utilisateur, synchronisé depuis auth.users';
COMMENT ON FUNCTION public.sync_user_email() IS 'Synchronise l''email depuis auth.users vers profiles';
COMMENT ON FUNCTION public.handle_new_user() IS 'Crée un profil avec l''email lors de la création d''un utilisateur';
