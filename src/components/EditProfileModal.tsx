"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { UserProfile, updateProfile, updateSocialSettings, sanitizeUsername, validateUsernameFormat, uploadAvatar } from "@/lib/profile";
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
  const { setProfile: setContextProfile, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États du formulaire
  const [avatarType, setAvatarType] = useState<'preset' | 'photo'>('preset');
  const [avatarPreset, setAvatarPreset] = useState<AvatarVariant>("purple");
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState<string | null>(null);
  const [avatarPhotoFile, setAvatarPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [accentColor, setAccentColor] = useState<string>('#7c3aed');
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [favoriteRestaurantIds, setFavoriteRestaurantIds] = useState<(string | null)[]>([]);

  // Données pour les favoris
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);

  // Pré-remplir les champs avec les valeurs existantes
  useEffect(() => {
    if (profile && isOpen) {
      // Initialiser avatar_type et avatar_preset
      const type = profile.avatar_type || 'preset';
      setAvatarType(type);
      
      if (type === 'photo') {
        setAvatarPhotoUrl(profile.avatar_url || null);
      } else {
        // Preset: utiliser avatar_preset ou avatar_variant (rétrocompatibilité)
        const preset = profile.avatar_preset || profile.avatar_variant || 'purple';
        const validPreset = AVAILABLE_AVATARS.some(av => av.variant === preset)
          ? (preset as AvatarVariant)
          : "purple";
        setAvatarPreset(validPreset);
      }
      
      // Initialiser accent_color
      setAccentColor(profile.accent_color || '#7c3aed');
      
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setIsPublic(profile.is_public ?? false);
      // Convertir le tableau d'IDs en tableau de 3 positions (avec null pour les places vides)
      const existingIds = profile.favorite_restaurant_ids || [];
      const favoritesWithPositions: (string | null)[] = [null, null, null];
      
      // Si c'est un tableau avec des null (nouveau format), l'utiliser directement
      if (Array.isArray(existingIds) && existingIds.length > 0 && (existingIds[0] === null || typeof existingIds[0] === 'string')) {
        existingIds.forEach((id, idx) => {
          if (idx < 3) {
            favoritesWithPositions[idx] = (id && typeof id === 'string') ? id : null;
          }
        });
      } else {
        // Ancien format : tableau simple d'IDs, les mapper dans l'ordre
        existingIds.forEach((id, idx) => {
          if (idx < 3 && id && typeof id === 'string') {
            favoritesWithPositions[idx] = id;
          }
        });
      }
      
      setFavoriteRestaurantIds(favoritesWithPositions);
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

  const handleAvatarPresetSelect = (variant: AvatarVariant) => {
    setAvatarType('preset');
    setAvatarPreset(variant);
    setAvatarPhotoUrl(null);
    setAvatarPhotoFile(null);
    setError(null);
  };

  const handlePhotoSelect = () => {
    setAvatarType('photo');
    setAvatarPreset("purple"); // Reset preset
    setError(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      setError("Le fichier doit être une image");
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image est trop grande (max 5MB)");
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      // Créer une preview locale
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPhotoUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setAvatarPhotoFile(file);
    } catch (err) {
      console.error("[EditProfileModal] Photo preview error", err);
      setError("Erreur lors de la prévisualisation de l'image");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    const cleaned = sanitizeUsername(value);
    setUsername(cleaned);
    setError(null);
  };

  const handleFavoriteRestaurantChange = (index: number, restaurantId: string | null) => {
    // Créer un tableau de 3 éléments pour représenter les 3 places
    const newFavorites: (string | null)[] = [null, null, null];
    
    // Copier les favoris existants dans leurs positions respectives
    favoriteRestaurantIds.forEach((id, idx) => {
      if (idx < 3) {
        newFavorites[idx] = id;
      }
    });

    if (restaurantId) {
      // Retirer le restaurant s'il est déjà sélectionné ailleurs
      const existingIndex = newFavorites.findIndex((id) => id === restaurantId);
      if (existingIndex !== -1 && existingIndex !== index) {
        newFavorites[existingIndex] = null;
      }

      // Mettre à jour la place spécifique (même si les places supérieures sont vides)
      newFavorites[index] = restaurantId;
    } else {
      // Désélectionner cette place
      newFavorites[index] = null;
    }

    // Garder le tableau avec les positions (y compris les null)
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

      // Upload de la photo si nécessaire
      let finalAvatarUrl: string | null = null;
      if (avatarType === 'photo' && avatarPhotoFile) {
        setUploadingPhoto(true);
        const { url, error: uploadError } = await uploadAvatar(avatarPhotoFile);
        setUploadingPhoto(false);
        
        if (uploadError) {
          setError("Erreur lors de l'upload de la photo. Réessaie.");
          setLoading(false);
          return;
        }
        
        if (url) {
          finalAvatarUrl = url;
        }
      } else if (avatarType === 'photo' && avatarPhotoUrl && !avatarPhotoFile) {
        // Photo déjà uploadée, utiliser l'URL existante
        finalAvatarUrl = avatarPhotoUrl;
      }

      // Préparer les données de mise à jour
      const updateData: {
        display_name?: string | null;
        bio?: string | null;
        avatar_type?: 'preset' | 'photo';
        avatar_preset?: string | null;
        avatar_url?: string | null;
        accent_color?: string | null;
        is_public?: boolean;
      } = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_type: avatarType,
        accent_color: accentColor,
        is_public: isPublic,
      };

      if (avatarType === 'preset') {
        updateData.avatar_preset = avatarPreset;
        updateData.avatar_url = null; // Nettoyer avatar_url si on passe en preset
      } else {
        updateData.avatar_preset = null; // Nettoyer avatar_preset si on passe en photo
        updateData.avatar_url = finalAvatarUrl;
      }

      // Mettre à jour le profil
      const { profile: updatedProfile, error: updateError } = await updateProfile(updateData);

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

      // Sauvegarder les favoris séparément
      // Préserver les positions avec null pour les places vides
      const idsToSave = favoriteRestaurantIds.slice(0, 3);
      
      const { profile: profileWithFavorites, error: favoritesError } = await updateSocialSettings({
        favorite_restaurant_ids: idsToSave,
      });

      if (favoritesError) {
        console.error("[EditProfileModal] Favorites save error", favoritesError);
        // Ne pas bloquer si l'erreur vient des favoris, juste logger
      }

      // Utiliser le profil avec favoris si disponible, sinon celui sans favoris
      const finalProfile = profileWithFavorites || updatedProfile;
      
      if (finalProfile) {
        console.log("[EditProfileModal] Profile saved successfully, updating context with:", finalProfile);
        console.log("[EditProfileModal] avatar_variant:", finalProfile.avatar_variant, "display_name:", finalProfile.display_name, "bio:", finalProfile.bio, "favorites:", finalProfile.favorite_restaurant_ids);
        setContextProfile(finalProfile);
      }

      // Appeler le callback onSave
      onSave();
      
      // Fermer le modal
      onClose();
      
      setLoading(false);
    } catch (err) {
      console.error("[EditProfileModal] unexpected error", err);
      setError("Erreur inattendue. Réessaie plus tard.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] flex flex-col overflow-hidden touch-none">
      <div className="w-full h-full bg-[#020617] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Modifier le profil</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Fermer"
          >
            <svg
              className="w-5 h-5 text-slate-400"
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="px-6 py-5 space-y-8 max-w-full">
            {/* Message d'erreur */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
                <p className="text-sm text-red-300 font-medium">{error}</p>
              </div>
            )}

            {/* Section Identité */}
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-white border-b-2 border-bitebox pb-2">Mon identité BiteBox</h3>
              </div>

              {/* Avatar Picker */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-slate-200 block mb-2">
                  Avatar
                </label>
                <div className="grid grid-cols-6 gap-2.5">
                  {/* 5 avatars preset */}
                  {AVAILABLE_AVATARS.map((avatar) => {
                    const isSelected = avatarType === 'preset' && avatarPreset === avatar.variant;
                    return (
                      <button
                        key={avatar.key}
                        type="button"
                        onClick={() => handleAvatarPresetSelect(avatar.variant)}
                        className={`relative w-14 h-14 rounded-full overflow-hidden transition-all ${
                          isSelected
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#020617]"
                            : ""
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
                              className="w-4 h-4 text-white"
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
                  
                  {/* 6e choix : Photo */}
                  <button
                    type="button"
                    onClick={handlePhotoSelect}
                    className={`relative w-14 h-14 rounded-full overflow-hidden transition-all ${
                      avatarType === 'photo'
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#020617]"
                        : ""
                    }`}
                  >
                    {avatarPhotoUrl && avatarType === 'photo' ? (
                      <>
                        <Image
                          src={avatarPhotoUrl}
                          alt="Photo personnalisée"
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-bitebox/20 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
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
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <svg
                          className="w-5 h-5 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
                
                {/* Input file pour photo (masqué) */}
                {avatarType === 'photo' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="avatar-photo-input"
                    />
                    <label
                      htmlFor="avatar-photo-input"
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-2.5 text-sm font-medium text-white cursor-pointer hover:bg-slate-800/60 hover:border-white/20 transition-all"
                    >
                      {uploadingPhoto ? (
                        <>
                          <Spinner size="sm" />
                          <span>Chargement...</span>
                        </>
                      ) : avatarPhotoUrl ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span>Changer la photo</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span>Importer une photo</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>

              {/* Color Picker pour accent_color */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-slate-200 block mb-2">
                  Couleur d'accent
                </label>
                <div className="grid grid-cols-6 gap-2.5">
                  {/* 5 couleurs des avatars */}
                  {[
                    { color: '#6A24A4', label: 'Violet', variant: 'purple' },
                    { color: '#0BB7DD', label: 'Bleu', variant: 'blue' },
                    { color: '#FF8A00', label: 'Orange', variant: 'orange' },
                    { color: '#EB1D36', label: 'Rouge', variant: 'red' },
                    { color: '#19B64A', label: 'Vert', variant: 'green' },
                  ].map(({ color, label }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setAccentColor(color);
                        setShowCustomColorPicker(false);
                      }}
                      className={`w-14 h-14 rounded-full transition-all ${
                        accentColor === color && !showCustomColorPicker
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#020617]"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Couleur ${label}`}
                    />
                  ))}
                  
                  {/* 6ème option : Palette complète */}
                  <button
                    type="button"
                    onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
                    className={`w-14 h-14 rounded-full transition-all flex items-center justify-center ${
                      showCustomColorPicker
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#020617] bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500"
                        : "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500"
                    }`}
                    aria-label="Palette complète"
                  >
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                  </button>
                </div>
                
                {/* Color picker personnalisé (affiché si showCustomColorPicker est true) */}
                {showCustomColorPicker && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-800/40 border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div 
                          className="w-14 h-14 rounded-full border-2 border-white/20 cursor-pointer shadow-lg overflow-hidden"
                          style={{ 
                            backgroundColor: accentColor,
                            boxShadow: `0 0 20px ${accentColor}40`
                          }}
                        >
                          <input
                            type="color"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="custom-color-picker w-full h-full cursor-pointer opacity-0 absolute inset-0"
                          />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">Couleur personnalisée</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono tracking-wider">{accentColor.toUpperCase()}</span>
                          <button
                            type="button"
                            onClick={() => {
                              // Réinitialiser à une couleur par défaut
                              setAccentColor('#7c3aed');
                              setShowCustomColorPicker(false);
                            }}
                            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                          >
                            Réinitialiser
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Nom affiché */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-200 block">
                  Nom affiché
                  <span className="text-slate-500 font-normal ml-1">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-2 focus:ring-bitebox/20 transition"
                  placeholder="Ton nom"
                  maxLength={50}
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-200 block">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-2 focus:ring-bitebox/20 transition"
                  placeholder="@tonpseudo"
                  maxLength={30}
                />
                <p className="text-xs text-slate-500">
                  3 à 30 caractères (lettres, chiffres, _ et .)
                </p>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-200 block">
                  Bio
                  <span className="text-slate-500 font-normal ml-1">(optionnel)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-bitebox focus:outline-none focus:ring-2 focus:ring-bitebox/20 transition resize-none"
                  placeholder="Une courte description..."
                  rows={4}
                  maxLength={150}
                />
                <p className="text-xs text-slate-500 text-right">
                  {bio.length}/150
                </p>
              </div>
            </div>

            {/* Section Mise en avant */}
            <div className="space-y-4 pt-4">
              <div>
                <h3 className="text-lg font-bold text-white border-b-2 border-bitebox pb-2">Mes restaurants préférés</h3>
              </div>

              {/* 3 enseignes favorites */}
              <div className="space-y-3">
                {[0, 1, 2].map((index) => {
                  const selectedId = (favoriteRestaurantIds[index] && typeof favoriteRestaurantIds[index] === 'string') 
                    ? favoriteRestaurantIds[index] as string 
                    : null;
                  const selectedRestaurant = selectedId
                    ? restaurants.find((r) => r.id === selectedId)
                    : null;
                  
                  const placeLabels = ["#1", "#2", "#3"];
                  const placeColors = [
                    "text-yellow-500/80",
                    "text-slate-400",
                    "text-amber-600/70"
                  ];
                  const placeBgColors = [
                    "rgba(234, 179, 8, 0.1)", // yellow pour #1
                    "rgba(148, 163, 184, 0.1)", // slate pour #2
                    "rgba(217, 119, 6, 0.1)" // amber pour #3
                  ];

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-white/5">
                      <span 
                        className={`text-sm font-bold w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${placeColors[index]}`} 
                        style={{ backgroundColor: placeBgColors[index] }}
                      >
                        {placeLabels[index]}
                      </span>
                      <select
                        value={selectedId || ""}
                        onChange={(e) =>
                          handleFavoriteRestaurantChange(index, e.target.value || null)
                        }
                        disabled={restaurantsLoading}
                        className="flex-1 rounded-xl border border-white/10 bg-slate-800/40 px-4 py-2.5 text-sm text-white focus:border-bitebox focus:outline-none focus:ring-2 focus:ring-bitebox/20 transition disabled:opacity-60"
                      >
                        <option value="">
                          {selectedId ? "Aucun" : "Sélectionner un restaurant"}
                        </option>
                        {restaurants.map((restaurant) => {
                          const isSelectedElsewhere =
                            favoriteRestaurantIds.some((id) => id === restaurant.id) &&
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
            <div className="space-y-4 pt-6">
              <div>
                <h3 className="text-lg font-bold text-white border-b-2 border-bitebox pb-2">Visibilité</h3>
              </div>

              {/* Toggle Profil public */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-white/5">
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
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    isPublic ? "bg-bitebox" : "bg-slate-600"
                  }`}
                  role="switch"
                  aria-checked={isPublic}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                      isPublic ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer avec bouton Enregistrer (sticky) */}
        <div className="px-6 py-5 border-t border-white/10 bg-[#020617] flex-shrink-0">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-bitebox px-6 py-4 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:bg-bitebox-dark hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-bitebox/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Enregistrer les modifications</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

