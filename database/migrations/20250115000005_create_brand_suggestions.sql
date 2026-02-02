-- Migration: Créer la table brand_suggestions pour les suggestions d'enseignes
-- Date: 2025-01-15

CREATE TABLE IF NOT EXISTS public.brand_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  suggested_name TEXT NOT NULL,
  search_query TEXT,
  context_page TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_brand_suggestions_user_id ON public.brand_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_suggestions_status ON public.brand_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_brand_suggestions_created_at ON public.brand_suggestions(created_at DESC);

-- RLS: Tous les utilisateurs authentifiés peuvent insérer leurs propres suggestions
ALTER TABLE public.brand_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent insérer leurs propres suggestions
CREATE POLICY "Users can insert their own suggestions"
  ON public.brand_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent lire leurs propres suggestions
CREATE POLICY "Users can read their own suggestions"
  ON public.brand_suggestions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Les admins peuvent tout faire (lecture, modification)
-- Note: Cette policy nécessite que l'utilisateur soit admin (vérifié via admin_users)
-- Pour simplifier, on utilise une fonction qui vérifie admin_users
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy: Les admins peuvent tout lire
CREATE POLICY "Admins can read all suggestions"
  ON public.brand_suggestions
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Policy: Les admins peuvent tout modifier
CREATE POLICY "Admins can update all suggestions"
  ON public.brand_suggestions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_brand_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_brand_suggestions_updated_at
  BEFORE UPDATE ON public.brand_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_suggestions_updated_at();

-- Commentaires
COMMENT ON TABLE public.brand_suggestions IS 'Suggestions d''enseignes proposées par les utilisateurs';
COMMENT ON COLUMN public.brand_suggestions.user_id IS 'ID de l''utilisateur qui a fait la suggestion (peut être NULL si non connecté)';
COMMENT ON COLUMN public.brand_suggestions.suggested_name IS 'Nom de l''enseigne suggérée (2-80 caractères)';
COMMENT ON COLUMN public.brand_suggestions.search_query IS 'Requête de recherche qui a déclenché la suggestion';
COMMENT ON COLUMN public.brand_suggestions.context_page IS 'Page où la suggestion a été faite';
COMMENT ON COLUMN public.brand_suggestions.locale IS 'Locale du navigateur de l''utilisateur';
COMMENT ON COLUMN public.brand_suggestions.status IS 'Statut de la suggestion: new, reviewing, accepted, rejected';
COMMENT ON COLUMN public.brand_suggestions.admin_note IS 'Note administrative optionnelle';
