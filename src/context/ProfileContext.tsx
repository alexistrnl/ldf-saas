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
  const [profileReady, setProfileReady] = useState(false); // Profil chargé depuis Supabase
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  // Wrapper pour setProfile qui met aussi à jour le cache
  // Utilise automatiquement currentUserId pour le cache
  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    saveProfileToCache(newProfile, currentUserId);
  }, [currentUserId]);

  // Fonction pour charger le profil d'un userId spécifique
  const loadProfile = useCallback(async (userId: string | null, skipCache = false) => {
    if (!userId) {
      // Pas d'utilisateur, réinitialiser tout
      setProfileState(null);
      setProfileReady(false);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      
      // Étape 1: Charger le cache immédiatement si disponible
      if (!skipCache) {
        const cachedProfile = loadProfileFromCache(userId);
        if (cachedProfile) {
          setProfileState(cachedProfile);
          setLoading(false); // Ne pas bloquer l'UI avec le cache
        } else {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }

      // Étape 2: Charger depuis Supabase
      const { profile: userProfile, error: profileError } = await getCurrentUserProfile();

      // Vérifier que le profil correspond bien au userId actuel
      if (userProfile && userProfile.id !== userId) {
        console.warn("[ProfileContext] Profile userId mismatch, ignoring");
        setProfileState(null);
        setProfileReady(false);
        setError(null);
        return;
      }

      if (profileError) {
        console.error("[ProfileContext] Error loading profile:", profileError);
        setError(profileError.message || "Erreur lors du chargement du profil.");
        setProfile(null);
        setProfileReady(false);
      } else {
        setProfile(userProfile);
        setError(null);
        setProfileReady(true);
      }
    } catch (err) {
      console.error("[ProfileContext] Unexpected error:", err);
      setError("Erreur inattendue lors du chargement du profil.");
      setProfile(null);
      setProfileReady(false);
    } finally {
      setLoading(false);
    }
  }, [setProfile]);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await loadProfile(user?.id || null, true);
  }, [loadProfile]);

  // Initialiser le userId au mount
  useEffect(() => {
    const initializeUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      previousUserIdRef.current = user?.id || null;
    };
    initializeUserId();
  }, []);

  // Réagir aux changements de userId
  useEffect(() => {
    // Si le userId a changé, charger le profil correspondant
    if (currentUserId !== previousUserIdRef.current) {
      console.log("[ProfileContext] UserId changed:", previousUserIdRef.current, "->", currentUserId);
      
      // Si on passe d'un userId à un autre (ou à null), réinitialiser
      if (previousUserIdRef.current !== null && currentUserId !== previousUserIdRef.current) {
        // Purger le cache de l'ancien userId (optionnel, on peut garder les caches)
        // On ne purge que si on veut vraiment nettoyer, sinon on garde les caches par userId
      }
      
      previousUserIdRef.current = currentUserId;
      
      // Charger le profil du nouveau userId
      loadProfile(currentUserId, false);
    }
  }, [currentUserId, loadProfile]);

  // Écouter les changements d'authentification
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUserId = session?.user?.id || null;
      
      console.log("[ProfileContext] Auth state changed:", event, "userId:", newUserId);
      
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Mettre à jour le userId, ce qui déclenchera le chargement du profil
        setCurrentUserId(newUserId);
      } else if (event === "SIGNED_OUT") {
        // Réinitialiser complètement
        setCurrentUserId(null);
        setProfileState(null);
        setError(null);
        setLoading(false);
        setProfileReady(false);
        // Purger tous les caches (ou seulement celui du userId sortant)
        // Pour la sécurité, on purge tout au logout
        purgeAllProfileCaches();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

