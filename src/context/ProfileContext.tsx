"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserProfile, UserProfile } from "@/lib/profile";

type ProfileContextType = {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = async () => {
    try {
      setError(null);
      setLoading(true);

      const { profile: userProfile, error: profileError } = await getCurrentUserProfile();

      if (profileError) {
        console.error("[ProfileContext] Error loading profile:", profileError);
        setError(profileError.message || "Erreur lors du chargement du profil.");
        setProfile(null);
      } else {
        setProfile(userProfile);
        setError(null);
      }
    } catch (err) {
      console.error("[ProfileContext] Unexpected error:", err);
      setError("Erreur inattendue lors du chargement du profil.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Charger le profil au montage
    refreshProfile();

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        refreshProfile();
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
        setError(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, loading, error, refreshProfile, setProfile }}>
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

