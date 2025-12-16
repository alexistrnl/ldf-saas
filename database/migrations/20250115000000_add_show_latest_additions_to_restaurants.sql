-- ============================================
-- Migration : Ajout de la colonne show_latest_additions à restaurants
-- ============================================
-- 
-- Ce fichier contient les requêtes SQL à exécuter dans Supabase
-- pour ajouter la colonne show_latest_additions (boolean) à la table restaurants.
--
-- Instructions :
-- 1. Ouvrir Supabase Dashboard > SQL Editor
-- 2. Exécuter ces requêtes dans l'ordre
-- ============================================

-- 1. Ajouter la colonne show_latest_additions si elle n'existe pas
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS show_latest_additions BOOLEAN DEFAULT true;

-- 2. Mettre à jour les valeurs existantes à true (par défaut)
UPDATE public.restaurants 
SET show_latest_additions = true 
WHERE show_latest_additions IS NULL;

-- 3. Ajouter une contrainte NOT NULL pour garantir une valeur par défaut
ALTER TABLE public.restaurants
ALTER COLUMN show_latest_additions SET NOT NULL;

-- 4. Ajouter un commentaire sur la colonne pour documentation
COMMENT ON COLUMN public.restaurants.show_latest_additions IS 'Active/désactive l''affichage du bloc "Derniers ajouts" sur la page publique du restaurant';

