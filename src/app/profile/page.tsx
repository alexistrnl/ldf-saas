"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserProfile, UserProfile } from "@/lib/profile";
import { getAvatarTheme, hexToRgba } from "@/lib/getAvatarTheme";
import Spinner from "@/components/Spinner";

type ProfileRestaurantSummary = {
  restaurantId: string;
  restaurantName: string;
  slug: string | null;
  logoUrl: string | null;
  visitsCount: number;
  avgRating: number;
};

type ProfileExperience = {
  id: string;
  restaurantId: string | null;
  restaurantName: string;
  restaurantSlug: string | null;
  restaurantLogoUrl: string | null;
  rating: number;
  comment: string | null;
  visitedAt: string | null;
  createdAt: string;
  dishes: {
    dishId: string | null;
    dishName: string;
    rating: number;
    imageUrl: string | null;
  }[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restaurantsSummary, setRestaurantsSummary] = useState<
    ProfileRestaurantSummary[]
  >([]);
  const [experiences, setExperiences] = useState<ProfileExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
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

        // Charger le profil (username)
        const { profile: userProfile, error: profileError } =
          await getCurrentUserProfile();
        if (profileError) {
          console.error("[Profile] load profile error", profileError);
          // Ne bloquer pas le chargement si le profil n'existe pas encore
        } else {
          setProfile(userProfile);
        }

        // 1) Charger tous les logs
        const { data: logsData, error: logsError } = await supabase
          .from("fastfood_logs")
          .select("id, restaurant_id, restaurant_name, rating, comment, visited_at, created_at")
          .eq("user_id", user.id)
          .order("visited_at", { ascending: false });

        if (logsError) {
          console.error("[Profile] logs error", logsError);
          setError("Erreur lors du chargement de tes expériences.");
          setLoading(false);
          return;
        }

        const logs = logsData || [];

        // 2) Récupérer les IDs de restaurants uniques
        const restaurantIds = Array.from(
          new Set(
            logs
              .map((log) => log.restaurant_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        // 3) Charger les infos des restaurants (slug, logo_url)
        let restaurantMap: Record<
          string,
          { slug: string | null; logo_url: string | null; name: string }
        > = {};

        if (restaurantIds.length > 0) {
          const { data: restaurantsData, error: restaurantsError } = await supabase
            .from("restaurants")
            .select("id, slug, logo_url, name")
            .in("id", restaurantIds);

          if (restaurantsError) {
            console.error("[Profile] restaurants error", restaurantsError);
          } else {
            (restaurantsData || []).forEach((restaurant) => {
              restaurantMap[restaurant.id] = {
                slug: restaurant.slug,
                logo_url: restaurant.logo_url,
                name: restaurant.name,
              };
            });
          }
        }

        // 4) Construire le résumé des enseignes
        const grouped = new Map<
          string,
          {
            name: string;
            visits: number;
            totalRating: number;
            countRatings: number;
            restaurantId: string | null;
          }
        >();

        logs.forEach((log) => {
          const key = log.restaurant_id ?? `custom-${log.restaurant_name}`;
          if (!grouped.has(key)) {
            grouped.set(key, {
              name: log.restaurant_name,
              visits: 0,
              totalRating: 0,
              countRatings: 0,
              restaurantId: log.restaurant_id,
            });
          }

          const entry = grouped.get(key)!;
          entry.visits += 1;
          if (log.rating !== null && log.rating !== undefined) {
            entry.totalRating += log.rating;
            entry.countRatings += 1;
          }
        });

        const summaryData: ProfileRestaurantSummary[] = Array.from(
          grouped.entries()
        ).map(([key, value]) => {
          const restaurantInfo = value.restaurantId
            ? restaurantMap[value.restaurantId]
            : null;
          return {
            restaurantId: value.restaurantId ?? key,
            restaurantName: value.name,
            slug: restaurantInfo?.slug ?? null,
            logoUrl: restaurantInfo?.logo_url ?? null,
            visitsCount: value.visits,
            avgRating:
              value.countRatings > 0
                ? Number((value.totalRating / value.countRatings).toFixed(1))
                : 0,
          };
        });

        setRestaurantsSummary(summaryData);

        // 5) Charger les plats notés (fastfood_log_dishes)
        const logIds = logs.map((log) => log.id);
        let dishLogsMap: Record<
          string,
          Array<{
            dish_id: string | null;
            dish_name: string;
            rating: number;
          }>
        > = {};

        if (logIds.length > 0) {
          const { data: dishLogsData, error: dishLogsError } = await supabase
            .from("fastfood_log_dishes")
            .select("log_id, dish_id, dish_name, rating")
            .in("log_id", logIds);

          if (dishLogsError) {
            console.error("[Profile] dishLogs error", dishLogsError);
          } else {
            (dishLogsData || []).forEach((dishLog) => {
              if (!dishLogsMap[dishLog.log_id]) {
                dishLogsMap[dishLog.log_id] = [];
              }
              dishLogsMap[dishLog.log_id].push({
                dish_id: dishLog.dish_id,
                dish_name: dishLog.dish_name,
                rating: dishLog.rating,
              });
            });
          }
        }

        // 6) Charger les images des plats
        const dishIds = Array.from(
          new Set(
            Object.values(dishLogsMap)
              .flat()
              .map((d) => d.dish_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        let dishImagesMap: Record<string, string | null> = {};

        if (dishIds.length > 0) {
          const { data: dishesData, error: dishesError } = await supabase
            .from("dishes")
            .select("id, image_url")
            .in("id", dishIds);

          if (dishesError) {
            console.error("[Profile] dishes error", dishesError);
          } else {
            (dishesData || []).forEach((dish) => {
              dishImagesMap[dish.id] = dish.image_url;
            });
          }
        }

        // 7) Construire les expériences complètes
        const experiencesData: ProfileExperience[] = logs.map((log) => {
          const restaurantInfo = log.restaurant_id
            ? restaurantMap[log.restaurant_id]
            : null;
          const dishLogs = dishLogsMap[log.id] || [];

          return {
            id: log.id,
            restaurantId: log.restaurant_id,
            restaurantName: log.restaurant_name,
            restaurantSlug: restaurantInfo?.slug ?? null,
            restaurantLogoUrl: restaurantInfo?.logo_url ?? null,
            rating: log.rating ?? 0,
            comment: log.comment,
            visitedAt: log.visited_at,
            createdAt: log.created_at,
            dishes: dishLogs.map((dishLog) => ({
              dishId: dishLog.dish_id,
              dishName: dishLog.dish_name,
              rating: dishLog.rating,
              imageUrl: dishLog.dish_id
                ? dishImagesMap[dishLog.dish_id] ?? null
                : null,
            })),
          };
        });

        setExperiences(experiencesData);
      } catch (err) {
        console.error("[Profile] unexpected", err);
        setError("Erreur inattendue lors du chargement de ton profil.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Recharger le profil quand on revient sur la page (si username/avatar a changé via réglages)
  useEffect(() => {
    const reloadProfile = async () => {
      const { profile: updatedProfile } = await getCurrentUserProfile();
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    };

    // Recharger au focus de la page
    const handleFocus = () => reloadProfile();
    window.addEventListener("focus", handleFocus);

    // Recharger aussi au mount si on arrive depuis settings
    reloadProfile();

    return () => window.removeEventListener("focus", handleFocus);
  }, []);

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

  // Calculer les stats
  const restaurantsCount = restaurantsSummary.length;
  const totalExperiences = experiences.length;
  const avgRating =
    experiences.length > 0
      ? (
          experiences.reduce((sum, exp) => sum + exp.rating, 0) / experiences.length
        ).toFixed(1)
      : "0.0";

  // Fonction pour obtenir l'initiale
  const getInitial = (value?: string | null): string => {
    if (!value || value.trim().length === 0) return "?";
    return value.trim().charAt(0).toUpperCase();
  };

  // Fonction pour formater la date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Date inconnue";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Calculer le nom d'affichage et la source de l'initiale
  const displayName =
    profile?.username && profile.username.trim().length > 0
      ? profile.username
      : user?.email ?? "Utilisateur BiteBox";
  const initialSource = profile?.username || user?.email;

  // Calculer le thème basé sur l'avatar
  const theme = getAvatarTheme(profile?.avatar_url);
  const themeColorWithOpacity = hexToRgba(theme.color, 0.4);
  const themeColorGlow = hexToRgba(theme.color, 0.33); // 55 en hex = 33% en décimal

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
                {displayName}
              </span>
              {user?.email && (
                <span className="text-xs text-slate-400 truncate">
                  {user.email}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push("/profile/settings")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all flex-shrink-0 border"
            style={{ borderColor: themeColorWithOpacity, borderWidth: '1px' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.color;
              e.currentTarget.style.backgroundColor = hexToRgba(theme.color, 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = themeColorWithOpacity;
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            aria-label="Paramètres"
          >
            <svg
              className="w-5 h-5 transition-colors"
              style={{ color: theme.color }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </section>

        {/* Stats rapides */}
        <section className="grid grid-cols-3 gap-3 rounded-xl bg-[#0F0F1A] border border-white/5 shadow-md shadow-black/20 px-4 py-4">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {restaurantsCount}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Restos testés
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {totalExperiences}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Expériences
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-white">
              {avgRating}
            </span>
            <span className="text-[11px] text-slate-400 text-center">
              Note moyenne
            </span>
          </div>
        </section>

        {/* Restaurants que j'ai testés */}
        <section className="mt-6 space-y-4">
          <div>
            <h2 
              className="text-xl font-bold mb-1"
              style={{ color: theme.color }}
            >
              Restaurants que j'ai testés
            </h2>
            <p className="text-sm text-white/50 mb-3">
              Ton top des spots où tu as déjà mis une note.
            </p>
          </div>

          {restaurantsSummary.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore testé de restaurant.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto pb-2">
              <div className="flex gap-4 px-4">
                {restaurantsSummary.map((r) => (
                  <Link
                    key={r.restaurantId}
                    href={r.slug ? `/restaurants/${r.slug}` : "#"}
                    className={`w-48 flex-shrink-0 overflow-hidden rounded-xl bg-[#0F0F1A] border shadow-md shadow-black/20 transition hover:shadow-lg hover:shadow-black/30 ${
                      !r.slug ? "pointer-events-none opacity-60" : ""
                    }`}
                    style={{ 
                      borderColor: themeColorWithOpacity,
                      borderWidth: '1px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = themeColorWithOpacity;
                    }}
                  >
                    <div className="h-24 w-full overflow-hidden bg-black/60 flex items-center justify-center">
                      {r.logoUrl ? (
                        <img
                          src={r.logoUrl}
                          alt={r.restaurantName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">
                          Pas de logo
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 p-4 md:p-5">
                      <p className="truncate text-lg font-semibold text-white">
                        {r.restaurantName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {r.avgRating.toFixed(1)} / 5 · {r.visitsCount}{" "}
                        visite{r.visitsCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Mes expériences */}
        <section className="mt-6 space-y-4">
          <div>
            <h2 
              className="text-xl font-bold mb-1"
              style={{ color: theme.color }}
            >
              Mes expériences
            </h2>
            <p className="text-sm text-white/50 mb-3">
              Retrouve toutes tes notes, par date.
            </p>
          </div>

          {experiences.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore enregistré d'expérience.
            </p>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="rounded-xl bg-[#0F0F1A] border shadow-md shadow-black/20 p-4 md:p-5 transition hover:shadow-lg hover:shadow-black/30"
                  style={{ 
                    borderColor: themeColorWithOpacity,
                    borderWidth: '1px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = themeColorWithOpacity;
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                        {exp.restaurantLogoUrl ? (
                          <img
                            src={exp.restaurantLogoUrl}
                            alt={exp.restaurantName}
                            className="h-10 w-10 object-cover"
                          />
                        ) : (
                          <span className="text-xs text-slate-300">
                            {exp.restaurantName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        {exp.restaurantSlug ? (
                          <Link
                            href={`/restaurants/${exp.restaurantSlug}`}
                            className="text-lg font-semibold text-white hover:text-bitebox-light truncate"
                          >
                            {exp.restaurantName}
                          </Link>
                        ) : (
                          <span className="text-lg font-semibold text-white truncate">
                            {exp.restaurantName}
                          </span>
                        )}
                        <span className="text-sm text-white/50">
                          {formatDate(exp.visitedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex justify-end mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={
                              exp.rating >= star
                                ? "text-yellow-400"
                                : "text-slate-700"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-sm text-white font-medium">
                        {exp.rating} / 5
                      </span>
                    </div>
                  </div>

                  {/* Commentaire */}
                  {exp.comment && (
                    <p className="text-sm text-slate-300 mt-4 px-1">
                      {exp.comment}
                    </p>
                  )}

                  {/* Plats goûtés */}
                  {exp.dishes.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-semibold text-white">
                        Plats goûtés :
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {exp.dishes.map((dish, idx) => (
                          <div
                            key={dish.dishId ?? `${exp.id}-dish-${idx}`}
                            className="rounded-lg bg-[#161622] border border-white/5 shadow-sm p-3 flex flex-col gap-1"
                          >
                            <p className="text-sm font-semibold text-white truncate">
                              {dish.dishName}
                            </p>
                            <div className="flex items-center gap-1">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    className={
                                      dish.rating >= star
                                        ? "text-yellow-400 text-xs"
                                        : "text-slate-700 text-xs"
                                    }
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                              <span className="text-xs text-white font-medium">
                                {dish.rating}/5
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
