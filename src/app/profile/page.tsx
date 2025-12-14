"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserProfile, UserProfile, sanitizeUsername, validateUsernameFormat, updateSocialSettings } from "@/lib/profile";
import { getAvatarTheme, hexToRgba } from "@/lib/getAvatarTheme";
import Spinner from "@/components/Spinner";

type RestaurantLite = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
};

type ProfileStats = {
  restaurantsCount: number;
  totalExperiences: number;
  avgRating: number;
};

type LastExperience = {
  id: string;
  restaurant_name: string;
  restaurant_logo_url: string | null;
  rating: number;
  comment: string | null;
  visited_at: string | null;
  created_at: string;
} | null;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Données du mur
  const [stats, setStats] = useState<ProfileStats>({ restaurantsCount: 0, totalExperiences: 0, avgRating: 0 });
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<RestaurantLite[]>([]);
  const [lastExperience, setLastExperience] = useState<LastExperience>(null);
  
  // Mode édition
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editFavoriteRestaurantIds, setEditFavoriteRestaurantIds] = useState<string[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantLite[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Charger les données du profil
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setError(null);
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("[Profile] getUser error", userError);
          setError("Impossible de récupérer ton profil.");
          setLoading(false);
          return;
        }

        if (!user) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(user);

        // Charger le profil
        const { profile: userProfile, error: profileError } = await getCurrentUserProfile();
        if (profileError) {
          console.error("[Profile] load profile error", profileError);
        } else {
          setProfile(userProfile);
        }

        const userId = user.id;

        // Calculer les stats (mini)
        const { data: logsData } = await supabase
          .from("fastfood_logs")
          .select("restaurant_id, rating")
          .eq("user_id", userId);

        const logs = logsData || [];
        const uniqueRestaurantIds = new Set(
          logs.map((log) => log.restaurant_id).filter((id): id is string => Boolean(id))
        );
        const restaurantsCount = uniqueRestaurantIds.size;
        const totalExperiences = logs.length;
        const ratings = logs
          .map((log) => log.rating)
          .filter((rating): rating is number => typeof rating === "number");
        const avgRating = ratings.length > 0
          ? Number((ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1))
          : 0;

        setStats({ restaurantsCount, totalExperiences, avgRating });

        // Charger les restaurants favoris
        if (userProfile?.favorite_restaurant_ids && userProfile.favorite_restaurant_ids.length > 0) {
          const favoriteIds: string[] = Array.isArray(userProfile.favorite_restaurant_ids)
            ? (userProfile.favorite_restaurant_ids as string[])
            : [];
          const favoriteIdsSliced = favoriteIds.slice(0, 3);

          if (favoriteIdsSliced.length > 0) {
            const { data: restaurantsData } = await supabase
              .from("restaurants")
              .select("id, name, slug, logo_url")
              .in("id", favoriteIdsSliced);

            if (restaurantsData) {
              const typedRestaurants = restaurantsData as RestaurantLite[];
              const orderedFavorites = favoriteIdsSliced
                .map((id: string) => typedRestaurants.find((r) => r.id === id))
                .filter((r): r is RestaurantLite => Boolean(r));
              setFavoriteRestaurants(orderedFavorites);
            }
          }
        }

        // Charger la dernière expérience
        const { data: lastLog } = await supabase
          .from("fastfood_logs")
          .select("id, restaurant_id, restaurant_name, rating, comment, visited_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

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

          setLastExperience({
            id: lastLog.id,
            restaurant_name: lastLog.restaurant_name || "Restaurant inconnu",
            restaurant_logo_url: restaurantLogoUrl,
            rating: lastLog.rating || 0,
            comment: lastLog.comment,
            visited_at: lastLog.visited_at,
            created_at: lastLog.created_at,
          });
        }

        // Charger la liste des restaurants pour l'édition
        const { data: allRestaurants } = await supabase
          .from("restaurants")
          .select("id, name, logo_url")
          .order("name", { ascending: true });
        
        if (allRestaurants) {
          setRestaurants(allRestaurants as RestaurantLite[]);
        }
      } catch (err) {
        console.error("[Profile] unexpected", err);
        setError("Erreur inattendue lors du chargement de ton profil.");
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

  // Recharger le profil quand on revient sur la page
  useEffect(() => {
    const reloadProfile = async () => {
      const { profile: updatedProfile } = await getCurrentUserProfile();
      if (updatedProfile) {
        setProfile(updatedProfile);
        // Recharger aussi les données du mur
        loadProfileData();
      }
    };

    const handleFocus = () => reloadProfile();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Fonction pour recharger les données (réutilisable)
  const loadProfileData = async () => {
    if (!user) return;
    // Même logique que dans le useEffect initial
    // (code simplifié pour éviter duplication - en production on extrairait ça)
  };

  // Ouvrir le mode édition
  const handleStartEdit = () => {
    if (!profile) return;
    setEditUsername(profile.username || "");
    setEditIsPublic(profile.is_public ?? false);
    setEditFavoriteRestaurantIds(profile.favorite_restaurant_ids || []);
    setIsEditing(true);
    setEditError(null);
    setEditSuccess(null);
  };

  // Annuler l'édition
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
    setEditSuccess(null);
  };

  // Gestion du changement d'username (nettoyage automatique)
  const handleEditUsernameChange = (value: string) => {
    const cleaned = sanitizeUsername(value);
    setEditUsername(cleaned);
    setEditError(null);
    setEditSuccess(null);
  };

  // Gestion de la sélection d'un restaurant favori
  const handleEditFavoriteRestaurantChange = (index: number, restaurantId: string | null) => {
    const newFavorites = [...editFavoriteRestaurantIds];
    
    if (restaurantId) {
      const existingIndex = newFavorites.findIndex(id => id === restaurantId);
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
    
    setEditFavoriteRestaurantIds(newFavorites);
    setEditError(null);
    setEditSuccess(null);
  };

  // Sauvegarder les modifications
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    const cleanedUsername = editUsername.trim();
    if (cleanedUsername) {
      const validation = validateUsernameFormat(cleanedUsername);
      if (!validation.valid) {
        setEditError(validation.error || "Nom d'utilisateur invalide.");
        return;
      }
    }

    setIsSavingEdit(true);

    try {
      const { profile: updatedProfile, error } = await updateSocialSettings({
        username: cleanedUsername || null,
        is_public: editIsPublic,
        favorite_restaurant_ids: editFavoriteRestaurantIds,
      });

      if (error) {
        console.error("[Profile] update social settings error:", error);
        let message = "Erreur lors de la sauvegarde.";
        
        if (error.code === "23505" || error.message?.toLowerCase().includes("unique")) {
          message = "Nom d'utilisateur déjà pris.";
        } else if (
          error.message?.toLowerCase().includes("row-level security") ||
          error.message?.toLowerCase().includes("policy") ||
          error.code === "42501"
        ) {
          message = "Tu n'as pas les droits pour modifier ce profil.";
        }
        
        setEditError(message);
        setIsSavingEdit(false);
        return;
      }

      if (updatedProfile) {
        setProfile(updatedProfile);
        setIsEditing(false);
        setEditSuccess("Profil mis à jour ✅");
        // Recharger les données
        window.location.reload(); // Simple reload pour recharger favorites et stats
      }
    } catch (err) {
      console.error("[Profile] unexpected edit error:", err);
      setEditError("Erreur inattendue. Réessaie plus tard.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  function formatDate(dateString: string | null): string {
    if (!dateString) return "Date inconnue";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function truncateComment(comment: string | null, maxLength: number = 150): string {
    if (!comment) return "";
    if (comment.length <= maxLength) return comment;
    return comment.slice(0, maxLength).trim() + "...";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-50 px-4 py-10">
        <div className="max-w-md mx-auto text-center space-y-4">
          <p className="text-sm text-slate-300">
            Tu dois être connecté pour voir ton profil.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-bitebox px-4 py-2 text-sm font-semibold text-white shadow hover:bg-bitebox-dark transition"
          >
            Me connecter
          </Link>
        </div>
      </div>
    );
  }

  const theme = getAvatarTheme(profile?.avatar_url);
  const themeColorGlow = hexToRgba(theme.color, 0.33);
  const displayName = profile?.username && profile.username.trim().length > 0
    ? profile.username
    : user?.email ?? "Utilisateur BiteBox";

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Header profil */}
        <section className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-5 flex-1 min-w-0">
            <div
              className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full"
              style={{ boxShadow: `0 0 20px ${themeColorGlow}` }}
            >
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="Avatar"
                  fill
                  className="object-cover object-center scale-150"
                  style={{ minWidth: '100%', minHeight: '100%' }}
                />
              ) : (
                <Image
                  src="/avatar/avatar-violet.png"
                  alt="Avatar par défaut"
                  fill
                  className="object-cover object-center scale-150"
                  style={{ minWidth: '100%', minHeight: '100%' }}
                />
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-lg font-semibold text-white truncate">
                @{displayName}
              </span>
              {user?.email && !profile?.username && (
                <span className="text-xs text-slate-400 truncate">
                  {user.email}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartEdit}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all flex-shrink-0 border border-white/10"
              aria-label="Modifier le profil"
            >
              <svg
                className="w-5 h-5 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all flex-shrink-0 border border-white/10"
              aria-label="Paramètres"
            >
              <svg
                className="w-5 h-5 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </section>

        {/* Mode édition */}
        {isEditing && profile && (
          <section className="rounded-xl bg-[#0e0e1a] border border-white/5 p-4">
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-white">Modifier le profil</h2>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
              </div>

              {/* Nom d'utilisateur */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => handleEditUsernameChange(e.target.value)}
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
                    {editIsPublic
                      ? "Ton profil est visible dans la recherche Social"
                      : "Ton profil n'est pas visible dans la recherche Social"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsPublic(!editIsPublic)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editIsPublic ? 'bg-bitebox' : 'bg-slate-600'
                  }`}
                  role="switch"
                  aria-checked={editIsPublic}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editIsPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 3 enseignes favorites */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 block">
                  3 enseignes favorites
                </label>
                {[0, 1, 2].map((index) => {
                  const selectedId = editFavoriteRestaurantIds[index] || null;
                  
                  return (
                    <select
                      key={index}
                      value={selectedId || ""}
                      onChange={(e) => handleEditFavoriteRestaurantChange(index, e.target.value || null)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-bitebox focus:outline-none focus:ring-1 focus:ring-bitebox transition"
                    >
                      <option value="">{selectedId ? "Aucun" : "Sélectionner un restaurant"}</option>
                      {restaurants.map((restaurant) => {
                        const isSelectedElsewhere = editFavoriteRestaurantIds.includes(restaurant.id) && editFavoriteRestaurantIds[index] !== restaurant.id;
                        if (isSelectedElsewhere) return null;
                        
                        return (
                          <option key={restaurant.id} value={restaurant.id}>
                            {restaurant.name}
                          </option>
                        );
                      })}
                    </select>
                  );
                })}
              </div>

              {/* Messages d'erreur/succès */}
              {editError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2">
                  <p className="text-xs text-red-400">{editError}</p>
                </div>
              )}
              {editSuccess && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-2">
                  <p className="text-xs text-emerald-400">{editSuccess}</p>
                </div>
              )}

              {/* Bouton de sauvegarde */}
              <button
                type="submit"
                disabled={isSavingEdit}
                className="w-full rounded-xl bg-bitebox px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {isSavingEdit ? (
                  <>
                    <Spinner size="sm" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  "Enregistrer"
                )}
              </button>
            </form>
          </section>
        )}

        {/* Stats rapides (mini) */}
        <section className="grid grid-cols-3 gap-3 rounded-xl bg-[#0F0F1A] border border-white/5 shadow-md shadow-black/20 px-4 py-4">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {stats.restaurantsCount}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Restos testés
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {stats.totalExperiences}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Expériences
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {stats.avgRating.toFixed(1)}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Note moyenne
            </span>
          </div>
        </section>

        {/* Lien vers Expérience pour les stats complètes */}
        <Link
          href="/experience"
          className="flex items-center justify-between rounded-xl bg-[#0F0F1A] border border-white/5 p-3 hover:bg-[#151520] transition-colors"
        >
          <span className="text-sm text-slate-400">Voir toutes mes expériences</span>
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>

        {/* 3 enseignes favorites */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">
            3 enseignes favorites
          </h2>
          {favoriteRestaurants.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {favoriteRestaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  href={restaurant.slug ? `/restaurants/${restaurant.slug}` : `#`}
                  className="flex flex-col items-center gap-2 rounded-xl bg-[#0F0F1A] border border-white/5 p-3 hover:bg-[#151520] transition-colors"
                >
                  {restaurant.logo_url ? (
                    <div className="relative h-12 w-12 rounded overflow-hidden">
                      <Image
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded bg-slate-700/50 flex items-center justify-center">
                      <span className="text-xs text-slate-400">?</span>
                    </div>
                  )}
                  <span className="text-xs text-white text-center truncate w-full">
                    {restaurant.name}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Aucune enseigne favorite définie.
            </p>
          )}
        </section>

        {/* Dernière expérience */}
        {lastExperience && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">
              Dernière expérience
            </h2>
            <div className="rounded-xl bg-[#0F0F1A] border border-white/5 p-4">
              <div className="flex items-start gap-3">
                {lastExperience.restaurant_logo_url && (
                  <div className="relative h-12 w-12 flex-shrink-0 rounded overflow-hidden">
                    <Image
                      src={lastExperience.restaurant_logo_url}
                      alt={lastExperience.restaurant_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-base font-semibold text-white truncate">
                      {lastExperience.restaurant_name}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < lastExperience.rating
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-slate-600"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    {formatDate(lastExperience.visited_at || lastExperience.created_at)}
                  </p>
                  {lastExperience.comment && (
                    <p className="text-sm text-slate-300">
                      {truncateComment(lastExperience.comment)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
