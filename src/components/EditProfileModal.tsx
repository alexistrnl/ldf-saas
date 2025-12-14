"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { UserProfile, uploadAvatar, updateProfile, sanitizeUsername, validateUsernameFormat } from "@/lib/profile";
import Spinner from "@/components/Spinner";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États du formulaire
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<string[]>([]);

  // Données pour les favoris
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pré-remplir les champs avec les valeurs existantes
  useEffect(() => {
    if (profile && isOpen) {
      setAvatarUrl(profile.avatar_url);
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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image");
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image est trop grande (max 5MB)");
      return;
    }

    setAvatarFile(file);
    setError(null);

    // Prévisualisation
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
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

      // Upload l'avatar si un nouveau fichier a été sélectionné
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        const { url, error: uploadError } = await uploadAvatar(avatarFile);
        if (uploadError) {
          setError("Erreur lors de l'upload de l'avatar. Réessaie.");
          setLoading(false);
          return;
        }
        finalAvatarUrl = url;
      }

      // Mettre à jour le profil
      const { profile: updatedProfile, error: updateError } = await updateProfile({
        avatar_url: finalAvatarUrl,
        display_name: displayName.trim() || null,
        username: cleanedUsername || null,
        bio: bio.trim() || null,
        is_public: isPublic,
        favorite_restaurant_ids: favoriteRestaurantIds,
      });

      if (updateError) {
        console.error("[EditProfileModal] update error", updateError);
        let message = "Erreur lors de la sauvegarde.";

        if (updateError.code === "23505" || updateError.message?.toLowerCase().includes("unique")) {
          message = "Nom d'utilisateur déjà pris.";
        } else if (
          updateError.message?.toLowerCase().includes("row-level security") ||
          updateError.message?.toLowerCase().includes("policy") ||
          updateError.code === "42501"
        ) {
          message = "Tu n'as pas les droits pour modifier ce profil.";
        }

        setError(message);
        setLoading(false);
        return;
      }

      // Succès
      onSave();
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

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-white/20 hover:border-bitebox transition-colors"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Avatar"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-slate-800 flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <p className="text-xs text-slate-400 text-center">
                  Clique pour changer la photo
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

