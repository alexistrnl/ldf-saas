-- ============================================
-- Migration : Ajout des sections de menu
-- ============================================
-- 
-- Ce fichier contient les requêtes SQL à exécuter dans Supabase
-- pour ajouter le système de sections de carte par restaurant.
--
-- Instructions :
-- 1. Ouvrir Supabase Dashboard > SQL Editor
-- 2. Exécuter ces requêtes dans l'ordre
-- ============================================

-- 1. Créer la table dish_categories si elle n'existe pas
CREATE TABLE IF NOT EXISTS dish_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Contrainte : un restaurant ne peut pas avoir deux sections avec le même nom
  UNIQUE(restaurant_id, name)
);

-- 2. Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_dish_categories_restaurant_id ON dish_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dish_categories_sort_order ON dish_categories(restaurant_id, sort_order);

-- 3. Ajouter la colonne category_id à la table dishes (si elle n'existe pas déjà)
-- Cette colonne sera nullable pour permettre aux plats existants de ne pas avoir de section
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dishes' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE dishes ADD COLUMN category_id UUID REFERENCES dish_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Créer un index sur category_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON dishes(category_id);

-- 5. Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS update_dish_categories_updated_at ON dish_categories;
CREATE TRIGGER update_dish_categories_updated_at
  BEFORE UPDATE ON dish_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Vérification (optionnel - à exécuter après)
-- ============================================
-- SELECT 
--   dc.id,
--   dc.restaurant_id,
--   r.name as restaurant_name,
--   dc.name as category_name,
--   dc.sort_order,
--   COUNT(d.id) as dishes_count
-- FROM dish_categories dc
-- LEFT JOIN restaurants r ON dc.restaurant_id = r.id
-- LEFT JOIN dishes d ON d.category_id = dc.id
-- GROUP BY dc.id, dc.restaurant_id, r.name, dc.name, dc.sort_order
-- ORDER BY dc.restaurant_id, dc.sort_order;

