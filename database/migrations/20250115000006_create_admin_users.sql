-- Migration: Créer la table admin_users si elle n'existe pas
-- Date: 2025-01-15
-- Cette table est utilisée par le middleware pour vérifier les droits admin

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);

-- RLS: Seuls les admins peuvent lire cette table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Les admins peuvent lire la table (via la fonction is_admin_user)
CREATE POLICY "Admins can read admin_users"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Commentaire
COMMENT ON TABLE public.admin_users IS 'Table des utilisateurs administrateurs';
COMMENT ON COLUMN public.admin_users.user_id IS 'ID de l''utilisateur admin (référence auth.users)';

-- Note: Pour ajouter un admin, exécuter:
-- INSERT INTO public.admin_users (user_id) VALUES ('<user_id>');
