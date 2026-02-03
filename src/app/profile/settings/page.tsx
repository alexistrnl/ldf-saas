"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  UserProfile,
  updateProfile,
  sanitizeUsername,
  validateUsernameFormat,
  updateSocialSettings,
} from "@/lib/profile";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/context/ProfileContext";
import Spinner from "@/components/Spinner";
import { AvatarVariant, getAvatarThemeFromVariant } from "@/lib/avatarTheme";

type Restaurant = {
  id: string;
  name: string;
  logo_url: string | null;
};

// Mapping avatar_variant → URL de l'avatar
const AVATAR_OPTIONS: Array<{ variant: AvatarVariant; url: string; label: string }> = [
  { variant: "blue", url: "/avatar/avatar-bleu.png", label: "Bleu" },
  { variant: "orange", url: "/avatar/avatar-orange.png", label: "Orange" },
  { variant: "red", url: "/avatar/avatar-rouge.png", label: "Rouge" },
  { variant: "green", url: "/avatar/avatar-vert.png", label: "Vert" },
  { variant: "purple", url: "/avatar/avatar-violet.png", label: "Violet" },
];

const AVAILABLE_AVATARS = AVATAR_OPTIONS.map(opt => opt.url);

// Fonction helper pour convertir avatar URL en avatar_variant
function getAvatarVariantFromUrl(avatarUrl: string): AvatarVariant | null {
  const option = AVATAR_OPTIONS.find(opt => opt.url === avatarUrl);
  return option ? option.variant : null;
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { profile, setProfile, profileReady, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  
  // Social settings
  const [username, setUsername] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<string[]>([]);
  const [initialSocialData, setInitialSocialData] = useState<{
    username: string | null;
    is_public: boolean;
    favorite_restaurant_ids: string[];
  } | null>(null);
  const [isSavingSocial, setIsSavingSocial] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialSuccess, setSocialSuccess] = useState<string | null>(null);
  
  // Restaurants list
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  
  // Avatar
  const [avatarVariant, setAvatarVariant] = useState<AvatarVariant>("purple");
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Charger les restaurants et initialiser les données depuis le profil du contexte
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setRestaurantsLoading(true);
        
        // Le profil est maintenant chargé depuis le ProfileContext
        // Attendre que le profil soit prêt
        if (!profileReady || !profile) {
          setLoading(false);
          setRestaurantsLoading(false);
          return;
        }
        
        // Initialiser avatar_variant depuis le profil
        if (profile.avatar_variant && AVATAR_OPTIONS.some(opt => opt.variant === profile.avatar_variant)) {
          setAvatarVariant(profile.avatar_variant as AvatarVariant);
        }
        
        // Charger les données sociales
        const currentUsername = profile.username || "";
        const currentIsPublic = profile.is_public ?? false;
        const currentFavorites = profile.favorite_restaurant_ids || [];
        
        setUsername(currentUsername);
        setIsPublic(currentIsPublic);
        setFavoriteRestaurantIds(Array.isArray(currentFavorites) ? currentFavorites : []);
        setInitialSocialData({
          username: currentUsername || null,
          is_public: currentIsPublic,
          favorite_restaurant_ids: Array.isArray(currentFavorites) ? currentFavorites : [],
        });
        
        // Charger les restaurants
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("restaurants")
          .select("id, name, logo_url")
          .order("name", { ascending: true });
        
        if (restaurantsError) {
          console.error("[Settings] load restaurants error", restaurantsError);
        } else {
          setRestaurants(restaurantsData || []);
        }
      } catch (err) {
        console.error("[Settings] unexpected error", err);
      } finally {
        setLoading(false);
        setRestaurantsLoading(false);
      }
    };

    loadData();
  }, [profile, profileReady]);

  // Synchroniser avatarVariant avec profile.avatar_variant quand le profil change
  useEffect(() => {
    if (profile?.avatar_variant && AVATAR_OPTIONS.some(opt => opt.variant === profile.avatar_variant)) {
      console.log("[Settings] profile.avatar_variant =", profile.avatar_variant, "local =", avatarVariant);
      setAvatarVariant(profile.avatar_variant as AvatarVariant);
    }
  }, [profile?.avatar_variant]);

  // Gestion du changement d'username (nettoyage automatique)
  const handleUsernameChange = (value: string) => {
    const cleaned = sanitizeUsername(value);
    setUsername(cleaned);
    setSocialError(null);
    setSocialSuccess(null);
  };

  // Gestion de la sélection d'un restaurant favori
  const handleFavoriteRestaurantChange = (index: number, restaurantId: string | null) => {
    const newFavorites = [...favoriteRestaurantIds];
    
    if (restaurantId) {
      // Retirer le restaurant s'il est déjà sélectionné ailleurs
      const existingIndex = newFavorites.findIndex(id => id === restaurantId);
      if (existingIndex !== -1 && existingIndex !== index) {
        newFavorites.splice(existingIndex, 1);
      }
      
      // Remplacer ou ajouter à l'index
      if (index < newFavorites.length) {
        newFavorites[index] = restaurantId;
      } else {
        // Ajouter seulement si on n'a pas encore 3 favoris
        if (newFavorites.length < 3) {
          newFavorites.push(restaurantId);
        }
      }
    } else {
      // Retirer le favori à cet index
      newFavorites.splice(index, 1);
    }
    
    setFavoriteRestaurantIds(newFavorites);
    setSocialError(null);
    setSocialSuccess(null);
  };

  // Vérifier si des changements ont été faits
  const hasSocialChanges = () => {
    if (!initialSocialData) return false;
    
    const currentUsername = username.trim() || null;
    const currentFavorites = favoriteRestaurantIds;
    
    return (
      currentUsername !== initialSocialData.username ||
      isPublic !== initialSocialData.is_public ||
      JSON.stringify(currentFavorites.sort()) !== JSON.stringify(initialSocialData.favorite_restaurant_ids.sort())
    );
  };

  // Sauvegarder les paramètres sociaux
  const handleSocialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSocialError(null);
    setSocialSuccess(null);

    // Valider le username
    const cleanedUsername = username.trim();
    if (cleanedUsername) {
      const validation = validateUsernameFormat(cleanedUsername);
      if (!validation.valid) {
        setSocialError(validation.error || "Nom d'utilisateur invalide.");
        return;
      }
    }

    if (!hasSocialChanges()) {
      setSocialSuccess("Aucune modification.");
      return;
    }

    setIsSavingSocial(true);

    try {
      const { profile: updatedProfile, error } = await updateSocialSettings({
        username: cleanedUsername || null,
        is_public: isPublic,
        favorite_restaurant_ids: favoriteRestaurantIds,
      });

      if (error) {
        console.error("[Settings] update social settings error:", error);
        let message = "Erreur lors de la sauvegarde.";
        
        // Gérer les erreurs de contrainte unique
        if (error.code === "23505" || error.message?.toLowerCase().includes("unique")) {
          message = "Nom d'utilisateur déjà pris.";
        } else if (
          error.message?.toLowerCase().includes("row-level security") ||
          error.message?.toLowerCase().includes("policy") ||
          error.code === "42501"
        ) {
          message = "Tu n'as pas les droits pour modifier ce profil. Vérifie que tu es bien connecté.";
        }
        
        setSocialError(message);
        setIsSavingSocial(false);
        return;
      }

      if (updatedProfile) {
        // Mettre à jour le profil dans le contexte
        setProfile(updatedProfile);
        // Rafraîchir le profil depuis le contexte
        await refreshProfile();
        setInitialSocialData({
          username: cleanedUsername || null,
          is_public: isPublic,
          favorite_restaurant_ids: favoriteRestaurantIds,
        });
        setSocialSuccess("Paramètres sociaux mis à jour ✅");
      }
    } catch (err) {
      console.error("[Settings] unexpected social error:", err);
      setSocialError("Erreur inattendue. Réessaie plus tard.");
    } finally {
      setIsSavingSocial(false);
    }
  };

  const handleAvatarSelect = async (avatarUrl: string) => {
    if (isUpdatingAvatar) return;

    // Convertir avatarUrl en avatar_variant
    const newVariant = getAvatarVariantFromUrl(avatarUrl);
    if (!newVariant) {
      setAvatarError("Avatar invalide.");
      return;
    }

    // Mettre à jour l'état local immédiatement (UI)
    setAvatarVariant(newVariant);
    setAvatarError(null);

    setIsUpdatingAvatar(true);

    try {
      // Sauvegarder avec updateProfile en utilisant avatar_variant
      const { profile: updatedProfile, error } = await updateProfile({
        avatar_variant: newVariant,
      });

      if (error) {
        console.error("[Settings] update avatar error:", error);
        setAvatarError("Impossible de mettre à jour l'avatar. Réessaie plus tard.");
        // Revenir à l'ancien variant en cas d'erreur
        if (profile?.avatar_variant) {
          setAvatarVariant(profile.avatar_variant as AvatarVariant);
        }
        setIsUpdatingAvatar(false);
        return;
      }

      if (updatedProfile) {
        console.log("[Settings] Avatar saved successfully, updated profile:", updatedProfile);
        // Mettre à jour le profil dans le contexte
        setProfile(updatedProfile);
        // Rafraîchir le profil depuis le contexte
        await refreshProfile();
      }
    } catch (err) {
      console.error("[Settings] unexpected avatar error:", err);
      setAvatarError("Erreur inattendue lors de la mise à jour de l'avatar.");
      // Revenir à l'ancien variant en cas d'erreur
      if (profile?.avatar_variant) {
        setAvatarVariant(profile.avatar_variant as AvatarVariant);
      }
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        {/* Header */}
        <section className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              Paramètres du compte
            </h1>
            <p className="text-xs text-slate-400">
              Personnalise ton profil et tes préférences.
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 transition"
          >
            Retour
          </button>
        </section>

        {/* Section Social */}
        <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4 w-full overflow-x-hidden">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-white mb-1">
              Social
            </h2>
            <p className="text-xs text-slate-400">
              Configure ton profil social et tes enseignes favorites.
            </p>
          </div>

          <form onSubmit={handleSocialSubmit} className="space-y-6">
            {/* Nom d'utilisateur */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition"
                placeholder="@tonpseudo"
                maxLength={30}
              />
              <p className="text-xs text-slate-500">
                3 à 30 caractères (lettres, chiffres, _ et .)
              </p>
            </div>

            {/* Toggle Profil public */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Profil public
                </label>
                <p className="text-xs text-slate-500">
                  {isPublic 
                    ? "Ton profil est visible dans la recherche Social" 
                    : "Ton profil n'est pas visible dans la recherche Social"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPublic(!isPublic);
                  setSocialError(null);
                  setSocialSuccess(null);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPublic ? 'bg-bitebox' : 'bg-slate-600'
                }`}
                role="switch"
                aria-checked={isPublic}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 3 enseignes favorites */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-300 block">
                3 enseignes favorites
              </label>
              {[0, 1, 2].map((index) => {
                const selectedId = favoriteRestaurantIds[index] || null;
                const selectedRestaurant = selectedId 
                  ? restaurants.find(r => r.id === selectedId)
                  : null;

                return (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1">
                      <select
                        value={selectedId || ""}
                        onChange={(e) => handleFavoriteRestaurantChange(index, e.target.value || null)}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition"
                      >
                        <option value="">
                          {selectedId ? "Aucun" : "Sélectionner un restaurant"}
                        </option>
                        {restaurants.map((restaurant) => {
                          // Permettre la sélection du restaurant actuel ou ceux non encore sélectionnés
                          const isSelectedElsewhere = favoriteRestaurantIds.includes(restaurant.id) && favoriteRestaurantIds[index] !== restaurant.id;
                          if (isSelectedElsewhere) return null;
                          
                          return (
                            <option key={restaurant.id} value={restaurant.id}>
                              {restaurant.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {selectedRestaurant && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {selectedRestaurant.logo_url && (
                          <div className="relative h-8 w-8 rounded overflow-hidden">
                            <Image
                              src={selectedRestaurant.logo_url}
                              alt={selectedRestaurant.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleFavoriteRestaurantChange(index, null)}
                          className="text-red-400 hover:text-red-300 transition"
                          aria-label="Retirer"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {favoriteRestaurantIds.length >= 3 && (
                <p className="text-xs text-slate-500">
                  Maximum 3 restaurants favoris sélectionnés
                </p>
              )}
            </div>

            {/* Messages d'erreur/succès */}
            {socialError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2">
                <p className="text-xs text-red-400">{socialError}</p>
              </div>
            )}
            {socialSuccess && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-2">
                <p className="text-xs text-emerald-400">{socialSuccess}</p>
              </div>
            )}

            {/* Bouton de sauvegarde */}
            <button
              type="submit"
              disabled={isSavingSocial || !hasSocialChanges()}
              className="w-full rounded-xl bg-bitebox px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {isSavingSocial ? (
                <>
                  <Spinner size="sm" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                "Enregistrer les paramètres sociaux"
              )}
            </button>
          </form>
        </section>

        {/* Sélection de l'avatar */}
        <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4 w-full overflow-x-hidden">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-white mb-1">Avatar</h2>
            <p className="text-xs text-slate-400">
              Choisis ta couleur de profil.
            </p>
          </div>

          {avatarError && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2">
              <p className="text-xs text-red-400">{avatarError}</p>
            </div>
          )}

          <div className="flex justify-center gap-3">
            {AVATAR_OPTIONS.map((option) => {
              const isSelected = avatarVariant === option.variant;
              return (
                <button
                  key={option.url}
                  onClick={() => handleAvatarSelect(option.url)}
                  disabled={isUpdatingAvatar}
                  className={`
                    relative h-14 w-14 flex-shrink-0 rounded-full overflow-hidden border-2 transition-all
                    ${
                      isSelected
                        ? "ring-2 ring-bitebox shadow-lg shadow-bitebox/50 border-bitebox"
                        : "border-white/10 hover:border-white/30"
                    }
                    ${isUpdatingAvatar ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  aria-label={`Sélectionner l'avatar ${option.label}`}
                >
                  <Image
                    src={option.url}
                    alt={`Avatar ${option.label}`}
                    fill
                    className="object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="h-5 w-5 rounded-full bg-bitebox flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {isUpdatingAvatar && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Spinner size="sm" />
              <span className="text-xs text-slate-400">
                Mise à jour de l'avatar...
              </span>
            </div>
          )}
        </section>

        {/* Instructions pour ajouter à l'écran d'accueil */}
        <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4 w-full overflow-x-hidden">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-white mb-1">
              Ajouter BiteBox à l'écran d'accueil
            </h2>
            <p className="text-xs text-slate-400">
              Accède rapidement à BiteBox depuis ton téléphone.
            </p>
          </div>

          <div className="space-y-6">
            {/* iPhone */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white">
                iPhone (Safari)
              </h3>
              <ol className="space-y-1.5 text-xs text-slate-300 list-decimal list-inside">
                <li>Ouvre BiteBox dans Safari.</li>
                <li>Appuie sur le bouton Partager (carré avec flèche).</li>
                <li>Sélectionne &apos;Ajouter à l&apos;écran d&apos;accueil&apos;.</li>
                <li>Valide.</li>
              </ol>
            </div>

            {/* Séparateur */}
            <div className="border-t border-white/5"></div>

            {/* Android */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white">
                Android (Chrome)
              </h3>
              <ol className="space-y-1.5 text-xs text-slate-300 list-decimal list-inside">
                <li>Ouvre BiteBox dans Chrome.</li>
                <li>Appuie sur le menu ⋮ (trois points).</li>
                <li>Choisis &apos;Ajouter à l&apos;écran d&apos;accueil&apos;.</li>
                <li>Valide.</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
