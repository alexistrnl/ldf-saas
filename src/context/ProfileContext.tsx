"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserProfile, UserProfile } from "@/lib/profile";

// Clé de cache dépendante du userId
function getProfileCacheKey(userId: string | null): string {
  if (!userId) return "bitebox_profile_cache_guest";
  return `bitebox_profile_cache_${userId}`;
}

type ProfileContextType = {
  profile: UserProfile | null;
  loading: boolean;
  profileReady: boolean; // Indique si le profil est chargé depuis Supabase (pas seulement le cache)
  error: string | null;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Fonction helper pour sauvegarder le profil dans le cache
function saveProfileToCache(profile: UserProfile | null, userId: string | null) {
  if (typeof window === "undefined") return;
  
  try {
    if (profile && userId) {
      const cacheKey = getProfileCacheKey(userId);
      localStorage.setItem(cacheKey, JSON.stringify(profile));
    } else if (userId) {
      // Supprimer le cache pour ce userId
      const cacheKey = getProfileCacheKey(userId);
      localStorage.removeItem(cacheKey);
    }
  } catch (err) {
    console.warn("[ProfileContext] Failed to save profile to cache:", err);
  }
}

// Fonction helper pour charger le profil depuis le cache
function loadProfileFromCache(userId: string | null): UserProfile | null {
  if (typeof window === "undefined" || !userId) return null;
  
  try {
    const cacheKey = getProfileCacheKey(userId);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as UserProfile;
      // Vérifier que le profil correspond bien au userId
      if (parsed.id === userId) {
        return parsed;
      } else {
        // Le cache est invalide, le supprimer
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (err) {
    console.warn("[ProfileContext] Failed to load profile from cache:", err);
  }
  
  return null;
}

// Fonction helper pour purger tous les caches de profil
function purgeAllProfileCaches() {
  if (typeof window === "undefined") return;
  
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("bitebox_profile_cache_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (err) {
    console.warn("[ProfileContext] Failed to purge profile caches:", err);
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Ref pour éviter les boucles infinies
  const isFetchingProfileRef = useRef(false);
  const currentFetchingUserIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Synchroniser userIdRef avec userId
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Fonction pour réinitialiser l'état du profil
  const resetProfileState = useCallback(() => {
    setProfileState(null);
    setProfileReady(false);
    setLoading(false);
    setError(null);
    isFetchingProfileRef.current = false;
    currentFetchingUserIdRef.current = null;
  }, []);

  // Fonction pour charger le profil d'un userId spécifique
  // NE PAS utiliser useCallback avec des dépendances qui changent
  const loadProfile = useCallback(async (targetUserId: string) => {
    // Sécurité anti-boucle : ne pas charger si déjà en cours pour ce userId
    if (isFetchingProfileRef.current && currentFetchingUserIdRef.current === targetUserId) {
      console.log("[ProfileContext] Already fetching profile for userId:", targetUserId);
      return;
    }

    isFetchingProfileRef.current = true;
    currentFetchingUserIdRef.current = targetUserId;

    try {
      setError(null);
      setLoading(true);
      
      // Étape 1: Charger le cache immédiatement si disponible
      const cachedProfile = loadProfileFromCache(targetUserId);
      if (cachedProfile && cachedProfile.id === targetUserId) {
        setProfileState(cachedProfile);
        setLoading(false); // Ne pas bloquer l'UI avec le cache
      }

      // Étape 2: Charger depuis Supabase avec le userId spécifique
      const { data: { user } } = await supabase.auth.getUser();
      
      // Vérifier que le userId n'a pas changé
      if (!user || user.id !== targetUserId) {
        console.warn("[ProfileContext] UserId mismatch or no user, ignoring");
        resetProfileState();
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_variant, avatar_type, avatar_preset, accent_color, bio, is_public, favorite_restaurant_ids, is_verified, created_at, updated_at")
        .eq("id", targetUserId)
        .maybeSingle();

      // Vérifier que le profil correspond bien au userId
      if (profileData && profileData.id !== targetUserId) {
        console.warn("[ProfileContext] Profile userId mismatch, ignoring");
        resetProfileState();
        return;
      }

      if (profileError) {
        console.error("[ProfileContext] Error loading profile:", profileError);
        setError(profileError.message || "Erreur lors du chargement du profil.");
        setProfileState(null);
        setProfileReady(false);
      } else if (profileData) {
        const typedProfile: UserProfile = {
          id: profileData.id,
          username: profileData.username,
          avatar_url: profileData.avatar_url,
          avatar_variant: profileData.avatar_variant,
          avatar_type: profileData.avatar_type || 'preset',
          avatar_preset: profileData.avatar_preset || null,
          accent_color: profileData.accent_color || null,
          display_name: profileData.display_name || null,
          bio: profileData.bio || null,
          is_public: profileData.is_public ?? false,
          favorite_restaurant_ids: profileData.favorite_restaurant_ids || null,
          is_verified: profileData.is_verified ?? false,
          updated_at: profileData.updated_at,
        };
        setProfileState(typedProfile);
        saveProfileToCache(typedProfile, targetUserId);
        setError(null);
        setProfileReady(true);
      } else {
        // Pas de profil trouvé
        setProfileState(null);
        setProfileReady(false);
        setError(null);
      }
    } catch (err) {
      console.error("[ProfileContext] Unexpected error:", err);
      setError("Erreur inattendue lors du chargement du profil.");
      setProfileState(null);
      setProfileReady(false);
    } finally {
      setLoading(false);
      isFetchingProfileRef.current = false;
      currentFetchingUserIdRef.current = null;
    }
  }, [resetProfileState]); // ✅ Seule dépendance stable

  // Wrapper pour setProfile qui met aussi à jour le cache
  // Utiliser userIdRef pour éviter les dépendances
  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    if (newProfile && userIdRef.current) {
      saveProfileToCache(newProfile, userIdRef.current);
    }
  }, []); // ✅ Pas de dépendance à userId pour éviter les boucles

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    await loadProfile(user.id);
  }, [loadProfile]); // ✅ Pas de dépendance à userId

  // Écouter l'auth UNE SEULE FOIS au mount
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      console.log("[ProfileContext] Auth state changed, userId:", newUserId);
      setUserId(newUserId);
    });

    // Initialiser le userId au mount
    const initializeUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    initializeUserId();

    return () => {
      subscription.unsubscribe();
    };
  }, []); // ✅ AUCUNE DÉPENDANCE

  // Charger le profil UNIQUEMENT quand userId change
  useEffect(() => {
    if (!userId) {
      resetProfileState();
      // Purger tous les caches au logout
      purgeAllProfileCaches();
      return;
    }
    
    loadProfile(userId);
  }, [userId, loadProfile, resetProfileState]); // ✅ Dépendances stables uniquement

  return (
    <ProfileContext.Provider value={{ 
      profile, 
      loading, 
      profileReady,
      error, 
      refreshProfile, 
      setProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}

