import { supabase } from "@/lib/supabaseClient";

/**
 * Type pour le profil utilisateur
 * 
 * ⚠️ Migration Supabase nécessaire :
 * Créer une table "profiles" si elle n'existe pas avec :
 *   - id (uuid, primary key, references auth.users(id))
 *   - username (text, nullable, unique)
 *   - created_at (timestamp)
 *   - updated_at (timestamp)
 * 
 * Ou ajouter la colonne "username" à la table existante :
 *   ALTER TABLE profiles ADD COLUMN username TEXT UNIQUE;
 */
export type UserProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  is_public?: boolean | null;
  favorite_restaurant_ids?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

export async function getCurrentUserProfile(): Promise<{
  user: { id: string; email: string | undefined } | null;
  profile: UserProfile | null;
  error: any;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null, error: userError };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Si le profil n'existe pas encore, on le crée automatiquement
  if (!profile && !profileError) {
    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id })
      .select()
      .single();

    if (insertError) {
      // Si la table n'existe pas encore, on retourne null pour le profil
      // L'utilisateur devra créer la table via migration Supabase
      console.warn("[Profile] create profile error - table may not exist", insertError);
      return {
        user: { id: user.id, email: user.email },
        profile: null,
        error: null,
      };
    }

    return {
      user: { id: user.id, email: user.email },
      profile: newProfile as UserProfile,
      error: null,
    };
  }

  // Si erreur mais pas une erreur de "pas trouvé", on la retourne
  if (profileError && profileError.code !== "PGRST116") {
    return {
      user: { id: user.id, email: user.email },
      profile: null,
      error: profileError,
    };
  }

  return {
    user: { id: user.id, email: user.email },
    profile: (profile as UserProfile) || null,
    error: null,
  };
}

export async function checkUsernameAvailability(
  username: string,
  currentUserId: string
): Promise<{ available: boolean; error: any }> {
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", currentUserId)
    .maybeSingle();

  if (error) {
    return { available: false, error };
  }

  return { available: !existing, error: null };
}

export async function updateUsername(
  newUsername: string
): Promise<{ profile: UserProfile | null; error: any }> {
  console.log("[Profile] updateUsername called with:", newUsername);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[Profile] getUser error:", userError);
    return { profile: null, error: userError };
  }

  console.log("[Profile] Current user ID:", user.id);

  // Vérifier d'abord si le profil existe, sinon le créer
  const { data: existingProfile, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    console.error("[Profile] Check profile error:", checkError);
    return { profile: null, error: checkError };
  }

  if (!existingProfile) {
    // Créer le profil s'il n'existe pas
    console.log("[Profile] Profile doesn't exist, creating new one...");
    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: newUsername })
      .select("*")
      .single();

    if (createError) {
      console.error("[Profile] Create profile error:", {
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
      });
      return { profile: null, error: createError };
    }

    console.log("[Profile] Profile created successfully:", newProfile);
    return { profile: newProfile as UserProfile, error: null };
  }

  // Mettre à jour le profil existant
  console.log("[Profile] Updating existing profile...");
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({ username: newUsername })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[Profile] Update username error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      fullError: error,
    });
    return { profile: null, error };
  }

  console.log("[Profile] Username updated successfully:", updatedProfile);
  return { profile: updatedProfile as UserProfile, error: null };
}

export async function updateAvatar(
  avatarUrl: string
): Promise<{ profile: UserProfile | null; error: any }> {
  console.log("[Profile] updateAvatar called with:", avatarUrl);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[Profile] getUser error:", userError);
    return { profile: null, error: userError };
  }

  // Vérifier d'abord si le profil existe, sinon le créer
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    // Créer le profil s'il n'existe pas
    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert({ id: user.id, avatar_url: avatarUrl })
      .select("*")
      .single();

    if (createError) {
      console.error("[Profile] Create profile error:", createError);
      return { profile: null, error: createError };
    }

    return { profile: newProfile as UserProfile, error: null };
  }

  // Mettre à jour l'avatar
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[Profile] Update avatar error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { profile: null, error };
  }

  console.log("[Profile] Avatar updated successfully:", updatedProfile);
  return { profile: updatedProfile as UserProfile, error: null };
}

/**
 * Nettoie et valide un nom d'utilisateur
 */
export function sanitizeUsername(username: string): string {
  // Enlever le @ si présent
  let cleaned = username.replace(/^@+/, '');
  // Transformer en lowercase
  cleaned = cleaned.toLowerCase();
  // Filtrer caractères : autoriser [a-z0-9._]
  cleaned = cleaned.replace(/[^a-z0-9._]/g, '');
  // Trim
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Valide un nom d'utilisateur
 * Retourne valid: true si le username est vide (null autorisé)
 * Valide le format seulement si le username n'est pas vide
 */
export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();
  // Username vide est autorisé (null)
  if (!trimmed) {
    return { valid: true };
  }
  if (trimmed.length < 3 || trimmed.length > 30) {
    return { valid: false, error: "Le nom d'utilisateur doit contenir entre 3 et 30 caractères." };
  }
  if (!/^[a-z0-9._]+$/.test(trimmed)) {
    return { valid: false, error: "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, underscores et points." };
  }
  return { valid: true };
}

/**
 * Met à jour les informations sociales du profil (username, is_public, favorite_restaurant_ids)
 */
export async function updateSocialSettings(data: {
  username?: string | null;
  is_public?: boolean;
  favorite_restaurant_ids?: string[];
}): Promise<{ profile: UserProfile | null; error: any }> {
  console.log("[Profile] updateSocialSettings called with:", data);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[Profile] getUser error:", userError);
    return { profile: null, error: userError };
  }

  // Construire l'objet de mise à jour
  const updateData: {
    username?: string | null;
    is_public?: boolean;
    favorite_restaurant_ids?: string[];
  } = {};

  if (data.username !== undefined) {
    updateData.username = data.username || null;
  }
  if (data.is_public !== undefined) {
    updateData.is_public = data.is_public;
  }
  if (data.favorite_restaurant_ids !== undefined) {
    // S'assurer que c'est un tableau valide (max 3 éléments)
    const ids = Array.isArray(data.favorite_restaurant_ids) 
      ? data.favorite_restaurant_ids.slice(0, 3) 
      : [];
    updateData.favorite_restaurant_ids = ids;
  }

  // Vérifier d'abord si le profil existe, sinon le créer
  const { data: existingProfile, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    console.error("[Profile] Check profile error:", checkError);
    return { profile: null, error: checkError };
  }

  if (!existingProfile) {
    // Créer le profil s'il n'existe pas
    console.log("[Profile] Profile doesn't exist, creating new one...");
    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert({ id: user.id, ...updateData })
      .select("*")
      .single();

    if (createError) {
      console.error("[Profile] Create profile error:", createError);
      return { profile: null, error: createError };
    }

    return { profile: newProfile as UserProfile, error: null };
  }

  // Mettre à jour le profil existant
  console.log("[Profile] Updating social settings...");
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("[Profile] Update social settings error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { profile: null, error };
  }

  console.log("[Profile] Social settings updated successfully:", updatedProfile);
  return { profile: updatedProfile as UserProfile, error: null };
}

