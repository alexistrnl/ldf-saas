-- Migration: Ajouter les champs is_verified et is_admin à la table profiles
-- Système de compte certifié simple basé uniquement sur is_verified

-- Ajouter les colonnes
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Commentaires pour documenter les colonnes
COMMENT ON COLUMN profiles.is_verified IS 'Indique si le compte est certifié (badge bleu)';
COMMENT ON COLUMN profiles.is_admin IS 'Indique si l''utilisateur est administrateur';

-- Note: La policy RLS pour permettre aux admins de modifier is_verified
-- est créée dans la migration 20250115000004_add_admin_policy_for_verification.sql
