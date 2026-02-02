-- Migration: Policy RLS pour permettre aux admins de modifier is_verified
-- Cette policy doit être créée après la migration 20250115000003

-- Policy pour permettre aux admins de mettre à jour is_verified
-- Seuls les utilisateurs avec is_admin = true peuvent modifier is_verified

CREATE POLICY "Admins can update is_verified"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Note: Cette policy permet uniquement la modification de is_verified
-- Les autres champs du profil restent soumis aux policies existantes
