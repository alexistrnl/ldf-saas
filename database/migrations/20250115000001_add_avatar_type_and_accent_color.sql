-- Migration: Ajouter avatar_type, avatar_preset, accent_color à la table profiles
-- Date: 2025-01-15

-- Ajouter les nouvelles colonnes
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_type TEXT DEFAULT 'preset' CHECK (avatar_type IN ('preset', 'photo')),
ADD COLUMN IF NOT EXISTS avatar_preset TEXT CHECK (avatar_preset IN ('purple', 'blue', 'green', 'red', 'orange')),
ADD COLUMN IF NOT EXISTS accent_color TEXT;

-- Migrer les données existantes depuis avatar_variant vers avatar_preset
UPDATE profiles 
SET avatar_preset = CASE 
  WHEN avatar_variant = 'purple' OR avatar_variant = 'violet' THEN 'purple'
  WHEN avatar_variant = 'blue' OR avatar_variant = 'bleu' THEN 'blue'
  WHEN avatar_variant = 'green' OR avatar_variant = 'vert' THEN 'green'
  WHEN avatar_variant = 'red' OR avatar_variant = 'rouge' THEN 'red'
  WHEN avatar_variant = 'orange' THEN 'orange'
  ELSE 'purple'
END
WHERE avatar_preset IS NULL AND avatar_variant IS NOT NULL;

-- Définir avatar_type = 'preset' pour les profils existants
UPDATE profiles 
SET avatar_type = 'preset'
WHERE avatar_type IS NULL;

-- Définir accent_color par défaut basé sur avatar_preset pour les profils existants
UPDATE profiles 
SET accent_color = CASE 
  WHEN avatar_preset = 'purple' THEN '#7c3aed'
  WHEN avatar_preset = 'blue' THEN '#3b82f6'
  WHEN avatar_preset = 'green' THEN '#10b981'
  WHEN avatar_preset = 'red' THEN '#ef4444'
  WHEN avatar_preset = 'orange' THEN '#f97316'
  ELSE '#7c3aed'
END
WHERE accent_color IS NULL;

-- Si avatar_url existe et avatar_type n'est pas 'photo', définir avatar_type = 'photo'
UPDATE profiles 
SET avatar_type = 'photo'
WHERE avatar_url IS NOT NULL AND avatar_type = 'preset' AND avatar_url NOT LIKE '/avatar/avatar-%';
