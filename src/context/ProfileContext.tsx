"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserProfile, UserProfile } from "@/lib/profile";

const PROFILE_CACHE_KEY = "bitebox_profile_cache";

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
function saveProfileToCache(profile: UserProfile | null) {
  if (typeof window === "undefined") return;
  
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch (err) {
    console.warn("[ProfileContext] Failed to save profile to cache:", err);
  }
}

// Fonction helper pour charger le profil depuis le cache
function loadProfileFromCache(): UserProfile | null {
  if (typeof window === "undefined") return null;
  
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as UserProfile;
    }
  } catch (err) {
    console.warn("[ProfileContext] Failed to load profile from cache:", err);
  }
  
  return null;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false); // Profil chargé depuis Supabase
  const [error, setError] = useState<string | null>(null);

  // Wrapper pour setProfile qui met aussi à jour le cache
  const setProfile = useCallback((newProfile: UserProfile | null) => {
    setProfileState(newProfile);
    saveProfileToCache(newProfile);
  }, []);

  const refreshProfile = useCallback(async (skipCache = false) => {
    try {
      setError(null);
      
      // Ne pas mettre loading à true si on charge depuis le cache (pour éviter le flash)
      if (!skipCache) {
        setLoading(true);
      }

      const { profile: userProfile, error: profileError } = await getCurrentUserProfile();

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

  useEffect(() => {
    // Étape 1: Charger le cache immédiatement (synchrone)
    const cachedProfile = loadProfileFromCache();
    if (cachedProfile) {
      setProfileState(cachedProfile);
      setLoading(false); // Ne pas bloquer l'UI avec le cache
    }

    // Étape 2: Vérifier l'authentification et charger depuis Supabase
    const initializeProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Revalider le profil en arrière-plan
        await refreshProfile(true);
      } else {
        // Pas d'utilisateur connecté, nettoyer le cache
        setProfile(null);
        setProfileReady(false);
        setLoading(false);
      }
    };

    initializeProfile();

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Charger le cache immédiatement
        const cachedProfile = loadProfileFromCache();
        if (cachedProfile) {
          setProfileState(cachedProfile);
          setLoading(false);
        }
        // Puis revalider en arrière-plan
        await refreshProfile(true);
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
        setError(null);
        setLoading(false);
        setProfileReady(false);
        // Nettoyer le cache
        if (typeof window !== "undefined") {
          localStorage.removeItem(PROFILE_CACHE_KEY);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

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

