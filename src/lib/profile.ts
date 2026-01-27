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
  avatar_variant?: string | null; // "red" | "violet" | "blue" | "green" | "pink"
  display_name?: string | null;
  bio?: string | null;
  is_public?: boolean | null;
  favorite_restaurant_ids?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Récupère le profil de l'utilisateur connecté avec stats, favoris et dernière expérience
 * Pour affichage dans Social
 */
export async function getMyProfileWithData(): Promise<{
  profile: UserProfile | null;
  stats: {
    restaurantsCount: number;
    totalExperiences: number;
    avgRating: number;
  };
  favoriteRestaurants: Array<{
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
  }>;
  lastExperience: {
    id: string;
    restaurant_name: string;
    restaurant_logo_url: string | null;
    rating: number;
    comment: string | null;
    visited_at: string | null;
    created_at: string;
  } | null;
} | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // 1. Récupérer le profil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_variant, avatar_url, favorite_restaurant_ids, is_public, updated_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("[Profile] getMyProfileWithData error:", profileError);
    return null;
  }

  const typedProfile: UserProfile = {
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url,
    avatar_variant: profile.avatar_variant,
    display_name: (profile.display_name && profile.display_name.trim().length > 0) ? profile.display_name.trim() : null,
    bio: (profile.bio && profile.bio.trim().length > 0) ? profile.bio.trim() : null,
    is_public: profile.is_public ?? false,
    favorite_restaurant_ids: profile.favorite_restaurant_ids || null,
    updated_at: profile.updated_at,
  };

  const userId = typedProfile.id;

  // 2. Calculer les stats
  const { data: logs, error: logsError } = await supabase
    .from("fastfood_logs")
    .select("restaurant_id, rating")
    .eq("user_id", userId);

  if (logsError) {
    console.error("[Profile] Error loading logs:", logsError);
  }

  const logsData = logs || [];
  
  const uniqueRestaurantIds = new Set(
    logsData.map((log) => log.restaurant_id).filter((id): id is string => Boolean(id))
  );
  const restaurantsCount = uniqueRestaurantIds.size;
  const totalExperiences = logsData.length;
  const ratings = logsData
    .map((log) => log.rating)
    .filter((rating): rating is number => typeof rating === "number");
  const avgRating = ratings.length > 0
    ? Number((ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1))
    : 0;

  // 3. Récupérer les restaurants favoris
  function normalizeFavoriteIds(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((x): x is string => typeof x === "string");
    }
    if (typeof raw === "string") {
      const cleaned = raw.replace(/^{|}$/g, "");
      return cleaned
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    }
    return [];
  }

  const favoriteIds = normalizeFavoriteIds(typedProfile.favorite_restaurant_ids);
  const favoriteIdsSliced = favoriteIds.slice(0, 3);
  let favoriteRestaurants: Array<{ id: string; name: string; slug: string | null; logo_url: string | null }> = [];

  if (favoriteIdsSliced.length > 0) {
    const { data: restaurantsData } = await supabase
      .from("restaurants")
      .select("id, name, slug, logo_url")
      .in("id", favoriteIdsSliced);

    if (restaurantsData) {
      const typedRestaurantsData = restaurantsData as Array<{ id: string; name: string; slug: string | null; logo_url: string | null }>;
      favoriteRestaurants = favoriteIdsSliced
        .map((id: string) => typedRestaurantsData.find((r) => r.id === id))
        .filter((r): r is { id: string; name: string; slug: string | null; logo_url: string | null } => Boolean(r));
    }
  }

  // 4. Récupérer la dernière expérience
  const { data: lastLog } = await supabase
    .from("fastfood_logs")
    .select("id, restaurant_name, restaurant_id, rating, comment, visited_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lastExperience: {
    id: string;
    restaurant_name: string;
    restaurant_logo_url: string | null;
    rating: number;
    comment: string | null;
    visited_at: string | null;
    created_at: string;
  } | null = null;

  if (lastLog) {
    let restaurantLogoUrl: string | null = null;
    if (lastLog.restaurant_id) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("logo_url")
        .eq("id", lastLog.restaurant_id)
        .maybeSingle();
      restaurantLogoUrl = restaurant?.logo_url || null;
    }

    lastExperience = {
      id: lastLog.id,
      restaurant_name: lastLog.restaurant_name || "Restaurant inconnu",
      restaurant_logo_url: restaurantLogoUrl,
      rating: lastLog.rating || 0,
      comment: lastLog.comment,
      visited_at: lastLog.visited_at,
      created_at: lastLog.created_at,
    };
  }

  return {
    profile: typedProfile,
    stats: {
      restaurantsCount,
      totalExperiences,
      avgRating,
    },
    favoriteRestaurants,
    lastExperience,
  };
}

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
    .select("id, username, display_name, avatar_url, avatar_variant, bio, is_public, favorite_restaurant_ids, created_at, updated_at")
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
  favorite_restaurant_ids?: (string | null)[];
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
    favorite_restaurant_ids?: (string | null)[];
  } = {};

  if (data.username !== undefined) {
    updateData.username = data.username || null;
  }
  if (data.is_public !== undefined) {
    updateData.is_public = data.is_public;
  }
  if (data.favorite_restaurant_ids !== undefined) {
    // S'assurer que c'est un tableau valide (max 3 éléments)
    // Préserver les positions avec null pour les places vides
    const ids = Array.isArray(data.favorite_restaurant_ids) 
      ? data.favorite_restaurant_ids.slice(0, 3) 
      : [null, null, null];
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

/**
 * Upload un avatar vers Supabase Storage
 */
export async function uploadAvatar(file: File): Promise<{ url: string | null; error: any }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { url: null, error: userError || new Error("User not authenticated") };
  }

  try {
    // Vérifier le type de fichier
    if (!file.type.startsWith("image/")) {
      return { url: null, error: new Error("Le fichier doit être une image") };
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: new Error("L'image est trop grande (max 5MB)") };
    }

    const userId = user.id;
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload vers le bucket "avatars" (ou "fastfood-images" si "avatars" n'existe pas)
    const { data, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      // Si le bucket "avatars" n'existe pas, essayer "fastfood-images"
      if (uploadError.message.includes("not found") || uploadError.message.includes("Bucket")) {
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from("fastfood-images")
          .upload(`avatars/${fileName}`, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (fallbackError) {
          console.error("[Profile] upload avatar fallback error", fallbackError);
          return { url: null, error: fallbackError };
        }

        const { data: publicUrlData } = supabase.storage
          .from("fastfood-images")
          .getPublicUrl(`avatars/${fileName}`);

        return { url: publicUrlData.publicUrl, error: null };
      }

      console.error("[Profile] upload avatar error", uploadError);
      return { url: null, error: uploadError };
    }

    // Récupérer l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err) {
    console.error("[Profile] upload avatar unexpected error", err);
    return { url: null, error: err };
  }
}

/**
 * Met à jour les champs du profil (display_name, bio, avatar_variant, is_public)
 * Ne met à jour que les champs définis (ne jamais écraser par null/undefined)
 */
export async function updateProfile(data: {
  display_name?: string | null;
  bio?: string | null;
  avatar_variant?: string | null;
  is_public?: boolean;
}): Promise<{ profile: UserProfile | null; error: any }> {
  console.log("[Profile] updateProfile called with:", data);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[Profile] getUser error:", userError);
    return { profile: null, error: userError };
  }

  // Construire l'objet de mise à jour dynamiquement
  // Ne jamais écraser les champs existants par null/undefined
  // Mettre à jour uniquement les champs modifiés
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  // Ajouter uniquement les champs définis
  if (data.display_name !== undefined) {
    updates.display_name = data.display_name;
  }
  if (data.bio !== undefined) {
    updates.bio = data.bio;
  }
  if (data.avatar_variant !== undefined) {
    updates.avatar_variant = data.avatar_variant;
  }
  if (data.is_public !== undefined) {
    updates.is_public = data.is_public;
  }

  // Log clair avant l'update
  console.log("[Profile] Updating profile - user.id:", user.id, "updates:", JSON.stringify(updates, null, 2));

  // Mettre à jour le profil (pas d'upsert, juste update)
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id, username, display_name, avatar_url, avatar_variant, bio, is_public, favorite_restaurant_ids, created_at, updated_at")
    .single();

  if (error) {
    console.error("[Profile] Update profile error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      updates: updates,
    });
    
    return { profile: null, error };
  }

  console.log("[Profile] Profile updated successfully - saved row:", updatedProfile);
  console.log("[SaveProfile] updated profile with avatar_variant:", updatedProfile?.avatar_variant, "display_name:", updatedProfile?.display_name, "bio:", updatedProfile?.bio);
  console.log("[Profile Save] updatedProfile", updatedProfile?.updated_at, updatedProfile?.avatar_variant);
  return { profile: updatedProfile as UserProfile, error: null };
}

