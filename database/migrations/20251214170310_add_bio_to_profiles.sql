-- ============================================
-- Migration : Ajout de la colonne bio à profiles
-- ============================================
-- 
-- Ce fichier contient les requêtes SQL à exécuter dans Supabase
-- pour ajouter la colonne bio (biographie) à la table profiles.
--
-- Instructions :
-- 1. Ouvrir Supabase Dashboard > SQL Editor
-- 2. Exécuter ces requêtes dans l'ordre
-- ============================================

-- 1. Ajouter la colonne bio si elle n'existe pas
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Ajouter une contrainte CHECK pour limiter la longueur à 150 caractères
-- La contrainte ne s'applique que si bio n'est pas null
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_bio_length_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_bio_length_check 
CHECK (bio IS NULL OR char_length(bio) <= 150);

-- 3. Ajouter un commentaire sur la colonne pour documentation
COMMENT ON COLUMN public.profiles.bio IS 'Biographie de l''utilisateur (max 150 caractères)';

