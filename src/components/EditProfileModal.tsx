"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { UserProfile, updateProfile, sanitizeUsername, validateUsernameFormat } from "@/lib/profile";
import { useProfile } from "@/context/ProfileContext";
import { AvatarVariant } from "@/lib/avatarTheme";
import Spinner from "@/components/Spinner";

const AVAILABLE_AVATARS = [
  { key: "violet", label: "Violet", url: "/avatar/avatar-violet.png", variant: "purple" as const },
  { key: "bleu", label: "Bleu", url: "/avatar/avatar-bleu.png", variant: "blue" as const },
  { key: "orange", label: "Orange", url: "/avatar/avatar-orange.png", variant: "orange" as const },
  { key: "rouge", label: "Rouge", url: "/avatar/avatar-rouge.png", variant: "red" as const },
  { key: "vert", label: "Vert", url: "/avatar/avatar-vert.png", variant: "green" as const },
];

// Fonction helper pour obtenir l'URL d'un avatar depuis son variant
function getAvatarUrlFromVariant(variant: AvatarVariant): string {
  const avatar = AVAILABLE_AVATARS.find(av => av.variant === variant);
  return avatar ? avatar.url : AVAILABLE_AVATARS[0].url; // fallback sur violet
}

type EditProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: () => void;
};

type Restaurant = {
  id: string;
  name: string;
  logo_url: string | null;
};

export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSave,
}: EditProfileModalProps) {
  const router = useRouter();
  const { setProfile: setContextProfile, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États du formulaire
  const [avatarVariant, setAvatarVariant] = useState<AvatarVariant>("purple");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<string[]>([]);

  // Données pour les favoris
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);

  // Pré-remplir les champs avec les valeurs existantes
  useEffect(() => {
    if (profile && isOpen) {
      // Initialiser avatarVariant depuis profile.avatar_variant
      const newVariant = (profile.avatar_variant && AVAILABLE_AVATARS.some(av => av.variant === profile.avatar_variant))
        ? (profile.avatar_variant as AvatarVariant)
        : "purple"; // Fallback sur purple si avatar_variant manquant ou invalide
      
      setAvatarVariant(newVariant);
      console.log("[AvatarPicker] db=", profile.avatar_variant, "local=", newVariant);
      
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setIsPublic(profile.is_public ?? false);
      setFavoriteRestaurantIds(profile.favorite_restaurant_ids || []);
      setError(null);
    }
  }, [profile, isOpen]);

  // Charger les restaurants pour les favoris
  useEffect(() => {
    const loadRestaurants = async () => {
      if (!isOpen) return;
      setRestaurantsLoading(true);
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name, logo_url")
          .order("name", { ascending: true });

        if (error) {
          console.error("[EditProfileModal] load restaurants error", error);
        } else {
          setRestaurants(data || []);
        }
      } catch (err) {
        console.error("[EditProfileModal] unexpected load restaurants error", err);
      } finally {
        setRestaurantsLoading(false);
      }
    };

    loadRestaurants();
  }, [isOpen]);

  // Empêcher le scroll du body quand la modal est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleAvatarSelect = (variant: AvatarVariant) => {
    setAvatarVariant(variant);
    setError(null);
  };

  const handleUsernameChange = (value: string) => {
    const cleaned = sanitizeUsername(value);
    setUsername(cleaned);
    setError(null);
  };

  const handleFavoriteRestaurantChange = (index: number, restaurantId: string | null) => {
    const newFavorites = [...favoriteRestaurantIds];

    if (restaurantId) {
      // Retirer le restaurant s'il est déjà sélectionné ailleurs
      const existingIndex = newFavorites.findIndex((id) => id === restaurantId);
      if (existingIndex !== -1 && existingIndex !== index) {
        newFavorites.splice(existingIndex, 1);
      }

      if (index < newFavorites.length) {
        newFavorites[index] = restaurantId;
      } else {
        if (newFavorites.length < 3) {
          newFavorites.push(restaurantId);
        }
      }
    } else {
      newFavorites.splice(index, 1);
    }

    setFavoriteRestaurantIds(newFavorites);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Valider le username
      const cleanedUsername = username.trim();
      if (cleanedUsername) {
        const validation = validateUsernameFormat(cleanedUsername);
        if (!validation.valid) {
          setError(validation.error || "Nom d'utilisateur invalide.");
          setLoading(false);
          return;
        }
      }

      // Utiliser avatarVariant directement (déjà en état local)
      // Mettre à jour le profil (seulement les champs modifiés)
      const { profile: updatedProfile, error: updateError } = await updateProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_variant: avatarVariant,
        is_public: isPublic,
      });

      if (updateError) {
        console.error("[EditProfileModal] Profile save error", updateError);
        console.error("[EditProfileModal] Error code:", updateError.code);
        console.error("[EditProfileModal] Error message:", updateError.message);
        console.error("[EditProfileModal] Error details:", updateError.details);
        console.error("[EditProfileModal] Error hint:", updateError.hint);
        
        // Afficher le message d'erreur de Supabase
        let message = updateError.message || "Erreur lors de la sauvegarde.";

        if (updateError.code === "23505" || updateError.message?.toLowerCase().includes("unique")) {
          message = "Nom d'utilisateur déjà pris.";
        } else if (
          updateError.message?.toLowerCase().includes("row-level security") ||
          updateError.message?.toLowerCase().includes("policy") ||
          updateError.code === "42501"
        ) {
          message = "Permissions insuffisantes (RLS). Tu n'as pas les droits pour modifier ce profil.";
        } else if (updateError.message?.toLowerCase().includes("column") && updateError.message?.toLowerCase().includes("does not exist")) {
          message = `Erreur: ${updateError.message}. Certaines colonnes (bio, display_name) n'existent peut-être pas dans la base de données.`;
        }

        setError(message);
        setLoading(false);
        return;
      }

      // Succès : utiliser directement le profil retourné par updateProfile (source de vérité)
      if (updatedProfile) {
        console.log("[EditProfileModal] Profile saved successfully, updating context with:", updatedProfile);
        console.log("[EditProfileModal] avatar_variant:", updatedProfile.avatar_variant, "display_name:", updatedProfile.display_name, "bio:", updatedProfile.bio);
        setContextProfile(updatedProfile);
      }

      // Rafraîchir la page pour s'assurer que tout est à jour
      router.refresh();

      // Appeler le callback onSave
      onSave();
      
      // Fermer le modal
      onClose();
    } catch (err) {
      console.error("[EditProfileModal] unexpected error", err);
      setError("Erreur inattendue. Réessaie plus tard.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] flex flex-col">
      <div className="w-full h-full bg-[#020617] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">Modifier le profil</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Fermer"
          >
            <svg
              className="w-6 h-6 text-slate-300"
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

        {/* Contenu scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Message d'erreur */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Section Identité */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Identité</h3>

              {/* Avatar Picker */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-slate-300">
                  Avatar
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {AVAILABLE_AVATARS.map((avatar) => {
                    const isSelected = avatarVariant === avatar.variant;
                    return (
                      <button
                        key={avatar.key}
                        type="button"
                        onClick={() => handleAvatarSelect(avatar.variant)}
                        className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all ${
                          isSelected
                            ? "border-bitebox ring-2 ring-bitebox ring-offset-2 ring-offset-[#020617]"
                            : "border-white/20 hover:border-white/40"
                        }`}
                      >
                        <Image
                          src={avatar.url}
                          alt={avatar.label}
                          fill
                          className="object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-bitebox/20 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-white"
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
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  Choisis un avatar parmi les 5 couleurs disponibles
                </p>
              </div>

              {/* Nom affiché */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Nom affiché (optionnel)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition"
                  placeholder="Ton nom"
                  maxLength={50}
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition"
                  placeholder="@tonpseudo"
                  maxLength={30}
                />
                <p className="text-xs text-slate-500">
                  3 à 30 caractères (lettres, chiffres, _ et .)
                </p>
              </div>
            </div>

            {/* Section Présentation */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-sm font-semibold text-white">Présentation</h3>

              {/* Bio */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Bio (optionnel)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition resize-none"
                  placeholder="Une courte description..."
                  rows={4}
                  maxLength={150}
                />
                <p className="text-xs text-slate-500">
                  {bio.length}/150 caractères
                </p>
              </div>
            </div>

            {/* Section Mise en avant */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-sm font-semibold text-white">Mise en avant</h3>

              {/* 3 enseignes favorites */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  3 enseignes favorites
                </label>
                {[0, 1, 2].map((index) => {
                  const selectedId = favoriteRestaurantIds[index] || null;
                  const selectedRestaurant = selectedId
                    ? restaurants.find((r) => r.id === selectedId)
                    : null;

                  return (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={selectedId || ""}
                        onChange={(e) =>
                          handleFavoriteRestaurantChange(index, e.target.value || null)
                        }
                        disabled={restaurantsLoading}
                        className="flex-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition disabled:opacity-60"
                      >
                        <option value="">
                          {selectedId ? "Aucun" : "Sélectionner un restaurant"}
                        </option>
                        {restaurants.map((restaurant) => {
                          const isSelectedElsewhere =
                            favoriteRestaurantIds.includes(restaurant.id) &&
                            favoriteRestaurantIds[index] !== restaurant.id;
                          if (isSelectedElsewhere) return null;

                          return (
                            <option key={restaurant.id} value={restaurant.id}>
                              {restaurant.name}
                            </option>
                          );
                        })}
                      </select>
                      {selectedRestaurant?.logo_url && (
                        <div className="relative h-8 w-8 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={selectedRestaurant.logo_url}
                            alt={selectedRestaurant.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section Visibilité */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-sm font-semibold text-white">Visibilité</h3>

              {/* Toggle Profil public */}
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <label className="text-sm font-medium text-white block mb-1">
                    Profil public
                  </label>
                  <p className="text-xs text-slate-400">
                    {isPublic
                      ? "Ton profil est visible dans la recherche Social"
                      : "Ton profil n'est pas visible dans la recherche Social"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPublic ? "bg-bitebox" : "bg-slate-600"
                  }`}
                  role="switch"
                  aria-checked={isPublic}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublic ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer avec bouton Enregistrer (sticky) */}
        <div className="p-4 border-t border-white/10 bg-[#020617] flex-shrink-0">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-bitebox px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>Enregistrement...</span>
              </>
            ) : (
              "Enregistrer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

