"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { UserProfile } from "@/lib/profile";
import { getAvatarThemeFromVariant } from "@/lib/avatarTheme";
import { getAvatarUrl, getProfileAccentColor, hexToRgba } from "@/lib/avatarUtils";
import { useProfile } from "@/context/ProfileContext";
import Spinner from "@/components/Spinner";
import EditProfileModal from "@/components/EditProfileModal";
import ExperienceGrid from "@/components/ExperienceGrid";
import VerifiedBadge from "@/components/VerifiedBadge";

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

type Experience = {
  id: string;
  restaurant_id: string | null;
  restaurant_slug: string | null;
  restaurant_name: string;
  restaurant_logo_url: string | null;
  rating: number;
  comment: string | null;
  visited_at: string | null;
  created_at: string;
  dish_image_url: string | null;
};


export default function ProfilePage() {
  const router = useRouter();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Données du mur
  const [stats, setStats] = useState<ProfileStats>({ restaurantsCount: 0, totalExperiences: 0, avgRating: 0 });
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<RestaurantLite[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  
  // Modal édition
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Ouvrir automatiquement le modal si on vient de la notification (via URL ou événement)
  useEffect(() => {
    const openModal = () => {
      if (!profileLoading && profile) {
        setTimeout(() => {
          setIsEditModalOpen(true);
          // Nettoyer l'URL si nécessaire
          if (typeof window !== 'undefined' && window.location.search.includes('edit=true')) {
            router.replace('/profile', { scroll: false });
          }
        }, 200);
      }
    };

    // Vérifier le paramètre dans l'URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const editParam = urlParams.get('edit');
      if (editParam === 'true') {
        openModal();
      }
    }

    // Écouter l'événement personnalisé
    const handleOpenModal = () => {
      openModal();
    };
    window.addEventListener('openEditProfileModal', handleOpenModal);

    return () => {
      window.removeEventListener('openEditProfileModal', handleOpenModal);
    };
  }, [router, profileLoading, profile]);

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
          ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 100) / 100
          : 0;

        setStats({ restaurantsCount, totalExperiences, avgRating });

        // Charger les restaurants favoris en préservant les positions
        if (profile?.favorite_restaurant_ids) {
          const favoriteIds: (string | null)[] = Array.isArray(profile.favorite_restaurant_ids)
            ? (profile.favorite_restaurant_ids as (string | null)[])
            : [];
          const favoriteIdsSliced = favoriteIds.slice(0, 3);

          // Filtrer les IDs valides (non null) pour la requête
          const validIds = favoriteIdsSliced.filter((id): id is string => 
            id !== null && id !== undefined && typeof id === 'string' && id.length > 0
          );

          if (validIds.length > 0) {
            const { data: restaurantsData } = await supabase
              .from("restaurants")
              .select("id, name, slug, logo_url")
              .in("id", validIds);

            if (restaurantsData) {
              const typedRestaurants = restaurantsData as RestaurantLite[];
              // Créer un Map pour un accès rapide
              const restaurantMap = new Map(typedRestaurants.map(r => [r.id, r]));
              // Préserver les positions : mapper selon l'ordre original
              const orderedFavorites: RestaurantLite[] = [];
              favoriteIdsSliced.forEach((id) => {
                if (id && typeof id === 'string' && restaurantMap.has(id)) {
                  orderedFavorites.push(restaurantMap.get(id)!);
                }
              });
              setFavoriteRestaurants(orderedFavorites);
            } else {
              setFavoriteRestaurants([]);
            }
          } else {
            setFavoriteRestaurants([]);
          }
        } else {
          setFavoriteRestaurants([]);
        }

        // Charger toutes les expériences avec leurs images de plats
        const { data: allLogs } = await supabase
          .from("fastfood_logs")
          .select("id, restaurant_id, restaurant_name, rating, comment, visited_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (allLogs && allLogs.length > 0) {
          // Récupérer les logos et slugs des restaurants, et les images des plats depuis dish_ratings
          const experiencesWithDetails: Experience[] = await Promise.all(
            allLogs.map(async (log) => {
              let restaurantLogoUrl: string | null = null;
              let restaurantSlug: string | null = null;
              let dishImageUrl: string | null = null;

              if (log.restaurant_id) {
                const { data: restaurant } = await supabase
                  .from("restaurants")
                  .select("logo_url, slug")
                  .eq("id", log.restaurant_id)
                  .maybeSingle();
                restaurantLogoUrl = restaurant?.logo_url || null;
                restaurantSlug = restaurant?.slug || null;
              }

              // Récupérer une image de plat depuis dish_ratings pour ce restaurant
              if (log.restaurant_id) {
                const { data: dishRatings } = await supabase
                  .from("dish_ratings")
                  .select("dish_id")
                  .eq("user_id", userId)
                  .eq("restaurant_id", log.restaurant_id)
                  .limit(1);
                
                if (dishRatings && dishRatings.length > 0 && dishRatings[0].dish_id) {
                  const { data: dish } = await supabase
                    .from("dishes")
                    .select("image_url")
                    .eq("id", dishRatings[0].dish_id)
                    .maybeSingle();
                  dishImageUrl = dish?.image_url || null;
                }
              }

              return {
                id: log.id,
                restaurant_id: log.restaurant_id,
                restaurant_slug: restaurantSlug,
                restaurant_name: log.restaurant_name || "Restaurant inconnu",
                restaurant_logo_url: restaurantLogoUrl,
                rating: log.rating || 0,
                comment: log.comment,
                visited_at: log.visited_at,
                created_at: log.created_at,
                dish_image_url: dishImageUrl,
              };
            })
          );

          setExperiences(experiencesWithDetails);
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

  // Obtenir la couleur d'accent (nouveau système)
  const accentColor = getProfileAccentColor(profile);
  const accentRgba = hexToRgba(accentColor, 0.2);
  const accentGlow = hexToRgba(accentColor, 0.33);
  
  // Obtenir l'URL de l'avatar (preset ou photo)
  const avatarUrl = getAvatarUrl(profile);
  const displayName = profile?.display_name && profile.display_name.trim().length > 0
    ? profile.display_name
    : profile?.username && profile.username.trim().length > 0
    ? profile.username
    : user?.email ?? "Utilisateur BiteBox";
  const usernameDisplay = profile?.username || null;

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col px-4 pb-44 pt-6">
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {/* Header profil style TikTok */}
        <section className="px-4 pt-0 pb-6 relative">
          {/* Bouton Modifier le profil - en haut à gauche */}
          <button
            onClick={handleStartEdit}
            className="absolute -top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm z-10"
            aria-label="Modifier le profil"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          
          {/* Bouton Paramètres - en haut à droite */}
          <button
            onClick={() => router.push("/settings")}
            className="absolute -top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm z-10"
            aria-label="Paramètres"
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

          {/* Avatar centré en haut */}
          <div className="flex justify-center mb-4">
            <div
              className="relative h-28 w-28 overflow-hidden rounded-full border-2 shadow-lg"
              style={{ boxShadow: `0 0 20px ${accentGlow}`, borderColor: accentColor }}
            >
              <Image
                src={avatarUrl}
                alt="Avatar"
                fill
                className="object-cover object-center"
                style={{ minWidth: '100%', minHeight: '100%' }}
              />
            </div>
          </div>

          {/* Nom d'utilisateur centré en dessous de l'avatar */}
          <div className="flex flex-col items-center mb-6">
            {displayName && displayName !== usernameDisplay ? (
              <>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <h1 className="text-base font-bold text-white">
                    {displayName}
                  </h1>
                  {(profile?.is_verified === true) && <VerifiedBadge />}
                </div>
                {usernameDisplay && (
                  <span className="text-sm text-slate-400 font-medium">
                    @{usernameDisplay}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-white">
                  {usernameDisplay ? `@${usernameDisplay}` : user?.email ?? "Utilisateur BiteBox"}
                </h1>
                {(profile?.is_verified === true) && <VerifiedBadge />}
              </div>
            )}
            {profile?.bio && profile.bio.trim().length > 0 && (
              <p className="text-sm text-slate-300 mt-3 leading-relaxed text-center max-w-sm px-4">
                {profile.bio}
              </p>
            )}
          </div>

          {/* Stats alignées en dessous avec séparateurs */}
          <div className="flex justify-center gap-6 mb-6 px-4">
            <div className="flex flex-col items-center flex-1">
              <span className="text-xl font-bold text-white mb-0.5">
                {stats.totalExperiences}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Expériences
              </span>
            </div>
            <div className="h-12 w-px" style={{ backgroundColor: accentColor }}></div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-xl font-bold text-white mb-0.5">
                {stats.restaurantsCount}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Restos
              </span>
            </div>
            <div className="h-12 w-px" style={{ backgroundColor: accentColor }}></div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-xl font-bold text-white mb-0.5">
                {stats.avgRating.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Note moy.
              </span>
            </div>
          </div>
        </section>

        {/* Mon podium BiteBox */}
        <section className="px-4 py-4">
          <h2 className="text-base font-bold text-white mb-6 border-b-2 pb-2" style={{ borderBottomColor: accentColor }}>Mon podium BiteBox</h2>
          <div className="flex items-center justify-between gap-3 w-full">
            {/* Helper function pour obtenir le restaurant à une position donnée */}
            {(() => {
              const getRestaurantAtPosition = (position: number): RestaurantLite | null => {
                if (!profile?.favorite_restaurant_ids) return null;
                const ids = Array.isArray(profile.favorite_restaurant_ids) ? profile.favorite_restaurant_ids : [];
                const idAtPosition = ids[position];
                if (!idAtPosition || typeof idAtPosition !== 'string') return null;
                return favoriteRestaurants.find((r) => r.id === idAtPosition) || null;
              };

              const restaurant1 = getRestaurantAtPosition(0);
              const restaurant2 = getRestaurantAtPosition(1);
              const restaurant3 = getRestaurantAtPosition(2);

              return (
                <>
                  {/* 2ème place */}
                  <button
                    onClick={handleStartEdit}
                    className="flex flex-col items-center gap-1.5 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {restaurant2?.logo_url ? (
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-slate-400/40">
                        <Image
                          src={restaurant2.logo_url}
                          alt={restaurant2.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-slate-400/40">
                        <span className="text-xs text-slate-400">+</span>
                      </div>
                    )}
                    <span className="text-xs text-slate-400 font-medium">#2</span>
                  </button>
                  
                  {/* 1ère place - Plus grande */}
                  <button
                    onClick={handleStartEdit}
                    className="flex flex-col items-center gap-1.5 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {restaurant1?.logo_url ? (
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-yellow-500/60">
                        <Image
                          src={restaurant1.logo_url}
                          alt={restaurant1.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-yellow-500/60">
                        <span className="text-sm text-slate-400">+</span>
                      </div>
                    )}
                    <span className="text-xs text-yellow-500/80 font-medium">#1</span>
                  </button>
                  
                  {/* 3ème place */}
                  <button
                    onClick={handleStartEdit}
                    className="flex flex-col items-center gap-1.5 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {restaurant3?.logo_url ? (
                      <div className="relative w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-amber-600/50">
                        <Image
                          src={restaurant3.logo_url}
                          alt={restaurant3.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full bg-slate-700/50 flex items-center justify-center border-2 border-amber-600/50">
                        <span className="text-[10px] text-slate-400">+</span>
                      </div>
                    )}
                    <span className="text-xs text-amber-600/70 font-medium">#3</span>
                  </button>
                </>
              );
            })()}
          </div>
        </section>

        {/* Grille d'expériences style Instagram */}
        <ExperienceGrid experiences={experiences} title="Mes dernières expériences" accentColor={accentColor} />
      </div>

      {/* Modal d'édition du profil */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onSave={() => {
          // Le profil est déjà mis à jour via le contexte par EditProfileModal
          // Le useEffect dépend de profile, donc il se déclenchera automatiquement
          // On recharge les stats, les favoris et les expériences car profile a changé
          console.log("[Profile] onSave callback called, profile updated via context");
          // Recharger les données pour mettre à jour les favoris
          if (user) {
            const loadFavorites = async () => {
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
                } else {
                  setFavoriteRestaurants([]);
                }
              } else {
                setFavoriteRestaurants([]);
              }
            };
            loadFavorites();
          }
        }}
      />
    </main>
  );
}
