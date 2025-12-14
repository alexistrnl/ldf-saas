"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { UserProfile } from "@/lib/profile";
import { getAvatarTheme, hexToRgba } from "@/lib/getAvatarTheme";
import { getAvatarAccentTheme } from "@/lib/avatarTheme";
import { useProfile } from "@/context/ProfileContext";
import Spinner from "@/components/Spinner";
import EditProfileModal from "@/components/EditProfileModal";

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
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Données du mur
  const [stats, setStats] = useState<ProfileStats>({ restaurantsCount: 0, totalExperiences: 0, avgRating: 0 });
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<RestaurantLite[]>([]);
  const [lastExperience, setLastExperience] = useState<LastExperience>(null);
  
  // Modal édition
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Charger l'utilisateur et les données complémentaires
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
        if (profile?.favorite_restaurant_ids && profile.favorite_restaurant_ids.length > 0) {
          const favoriteIds: string[] = Array.isArray(profile.favorite_restaurant_ids)
            ? (profile.favorite_restaurant_ids as string[])
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

      } catch (err) {
        console.error("[Profile] unexpected", err);
        setError("Erreur inattendue lors du chargement de ton profil.");
      } finally {
        setLoading(false);
      }
    };

    // Attendre que le profil soit chargé depuis le contexte avant de charger les stats
    // Ne charger que si on n'est plus en train de charger le profil
    if (!profileLoading) {
      loadProfileData();
    }
  }, [profile, profileLoading]);

  // Recharger le profil quand on revient sur la page
  useEffect(() => {
    // Les données du profil viennent maintenant du ProfileContext
    // On recharge seulement les stats/activité quand l'utilisateur revient sur la page
    const handleFocus = async () => {
      if (user) {
        // Recharger les stats et l'expérience dernière sans recharger le profil (vient du contexte)
        const userId = user.id;
        
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
        const avgRating =
          logs.length > 0
            ? logs.reduce((sum, log) => sum + (log.rating || 0), 0) / logs.length
            : 0;
        
        setStats({
          restaurantsCount,
          totalExperiences,
          avgRating: Math.round(avgRating * 10) / 10,
        });
      }
    };
    
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  // Ouvrir la modal d'édition
  const handleStartEdit = () => {
    setIsEditModalOpen(true);
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

  if (loading || profileLoading) {
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
  const accentTheme = getAvatarAccentTheme(profile?.avatar_url);
  
  // Debug: afficher la variante détectée en dev (temporaire pour vérifier)
  if (process.env.NODE_ENV === "development") {
    const detectedVariant = accentTheme.borderSoft.includes("violet") ? "violet" :
                            accentTheme.borderSoft.includes("blue") ? "bleu" :
                            accentTheme.borderSoft.includes("orange") ? "orange" :
                            accentTheme.borderSoft.includes("red") ? "rouge" :
                            accentTheme.borderSoft.includes("emerald") ? "vert" : "unknown";
    console.log("[Profile] DEBUG - avatar_url:", profile?.avatar_url, "→ detected variant:", detectedVariant, "→ borderSoft:", accentTheme.borderSoft);
  }
  const displayName = profile?.display_name && profile.display_name.trim().length > 0
    ? profile.display_name
    : profile?.username && profile.username.trim().length > 0
    ? profile.username
    : user?.email ?? "Utilisateur BiteBox";
  const usernameDisplay = profile?.username || null;

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Header profil */}
        <section className={`flex items-start justify-between gap-3 rounded-xl p-4 border ${accentTheme.border} ${accentTheme.bgSoft}`}>
          <div className="flex items-start gap-4 flex-1 min-w-0">
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
            <div className="flex flex-col min-w-0 flex-1 gap-1">
              <span className={`text-lg font-semibold ${accentTheme.text} break-words`}>
                {displayName}
              </span>
              {usernameDisplay && (
                <span className="text-xs text-slate-400 break-words">
                  @{usernameDisplay}
                </span>
              )}
              {!usernameDisplay && user?.email && (
                <span className="text-xs text-slate-400 break-words">
                  {user.email}
                </span>
              )}
              {profile?.bio && profile.bio.trim().length > 0 && (
                <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 break-words mt-1">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleStartEdit}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all flex-shrink-0 border ${accentTheme.buttonOutline} ${accentTheme.bgSoft}`}
              aria-label="Modifier le profil"
            >
              <svg
                className={`w-5 h-5 ${accentTheme.text}`}
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
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all flex-shrink-0 border ${accentTheme.buttonOutline} ${accentTheme.bgSoft}`}
              aria-label="Paramètres"
            >
              <svg
                className={`w-5 h-5 ${accentTheme.text}`}
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

        {/* Stats rapides (mini) */}
        <section className={`grid grid-cols-3 gap-3 rounded-xl bg-[#0F0F1A] border border-slate-800/60 ${accentTheme.borderSoft} ring-1 ${accentTheme.ringSoft} shadow-md shadow-black/20 px-4 py-4`}>
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
        <section className={`space-y-3 rounded-xl p-3 border ${accentTheme.borderExtraSoft}`}>
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
            <div className={`rounded-xl bg-[#0F0F1A] border border-slate-800/60 ${accentTheme.borderSoft} ring-1 ${accentTheme.ringSoft} p-4`}>
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

      {/* Modal d'édition du profil */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onSave={() => {
          // Le contexte sera mis à jour par EditProfileModal avec les données fraîches
          // Le useEffect dépend de profile, donc il se déclenchera automatiquement
          // On peut juste recharger les favoris si nécessaire
          // (le useEffect se déclenchera car profile a changé)
        }}
      />
    </main>
  );
}
