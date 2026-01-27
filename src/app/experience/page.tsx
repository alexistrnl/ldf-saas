"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserProfile, UserProfile } from "@/lib/profile";
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

export default function ExperiencePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restaurantsSummary, setRestaurantsSummary] = useState<
    ProfileRestaurantSummary[]
  >([]);
  const [experiences, setExperiences] = useState<ProfileExperience[]>([]);
  const [expandedExperiences, setExpandedExperiences] = useState<Set<string>>(new Set());
  const [totalRestaurants, setTotalRestaurants] = useState<number>(0);
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
          console.error("[Experience] getUser error", userError);
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
          console.error("[Experience] load profile error", profileError);
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
          console.error("[Experience] logs error", logsError);
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
            console.error("[Experience] restaurants error", restaurantsError);
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

        // Charger le nombre total d'enseignes disponibles
        const { count: totalCount, error: countError } = await supabase
          .from("restaurants")
          .select("*", { count: "exact", head: true });

        if (!countError && totalCount !== null) {
          setTotalRestaurants(totalCount);
        }

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
            console.error("[Experience] dishLogs error", dishLogsError);
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
            console.error("[Experience] dishes error", dishesError);
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
        console.error("[Experience] unexpected", err);
        setError("Erreur inattendue lors du chargement de tes expériences.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
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
            Tu dois être connecté pour voir tes expériences.
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

  // Fonction pour formater la date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Date inconnue";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };


  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#020617]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-28 pt-6">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Mes stats BiteBox</h1>
          <p className="text-xs text-slate-400">Ton parcours en un coup d'œil</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Stats rapides */}
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 shadow-lg p-4 flex flex-col items-center justify-center hover:border-white/20 transition-all">
            <div className="text-2xl font-bold text-white mb-1">
              {restaurantsCount}
            </div>
            <div className="text-[11px] text-slate-300 text-center font-medium">
              Restos testés
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 shadow-lg p-4 flex flex-col items-center justify-center hover:border-white/20 transition-all">
            <div className="text-2xl font-bold text-white mb-1">
              {totalExperiences}
            </div>
            <div className="text-[11px] text-slate-300 text-center font-medium">
              Expériences
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-bitebox/20 to-bitebox/10 backdrop-blur-sm border border-bitebox/30 shadow-lg p-4 flex flex-col items-center justify-center hover:border-bitebox/40 transition-all">
            <div className="text-2xl font-bold text-bitebox mb-1 flex items-center gap-1">
              {avgRating}
              <span className="text-sm">⭐</span>
            </div>
            <div className="text-[11px] text-slate-300 text-center font-medium">
              Note moyenne
            </div>
          </div>
        </section>

        {/* Séparateur */}
        <div className="border-t border-white/5 my-2"></div>

        {/* Ma mosaïque BiteBox */}
        <section className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 
                className="text-base font-medium text-slate-200"
              >
                Ma mosaïque BiteBox
              </h2>
              {totalRestaurants > 0 && (
                <span className="text-xs font-medium text-white">
                  {Math.round((restaurantsSummary.length / totalRestaurants) * 100)}%
                </span>
              )}
            </div>
            {totalRestaurants > 0 && (
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                <div 
                  className="h-full bg-bitebox rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min((restaurantsSummary.length / totalRestaurants) * 100, 100)}%` 
                  }}
                />
              </div>
            )}
          </div>

          {restaurantsSummary.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore testé de restaurant.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {restaurantsSummary.map((r) => (
                <Link
                  key={r.restaurantId}
                  href={r.slug ? `/restaurants/${r.slug}` : "#"}
                  className={`overflow-hidden rounded-lg transition-opacity hover:opacity-80 ${
                    !r.slug ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  {r.logoUrl ? (
                    <div className="w-full flex items-center justify-center">
                      <img
                        src={r.logoUrl}
                        alt={r.restaurantName}
                        className="w-full h-auto object-contain"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          const container = img.parentElement?.parentElement;
                          if (container) {
                            // Adapter la hauteur du conteneur à l'image
                            container.style.height = 'auto';
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full p-3 flex items-center justify-center min-h-[60px] bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                      <span className="text-xs text-slate-500 font-medium">
                        {r.restaurantName.charAt(0)}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Séparateur */}
        <div className="border-t border-white/5 mt-1 mb-3"></div>

        {/* Mon activité récente */}
        <section className="space-y-3">
          <div className="text-center">
            <h2 
              className="text-base font-bold mb-1 text-slate-200"
            >
              Mon activité récente
            </h2>
            <p className="text-xs text-slate-400 mb-8">
              Retrouve toutes tes notes, par date.
            </p>
          </div>

          {experiences.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore enregistré d'expérience.
            </p>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp) => {
                const isExpanded = expandedExperiences.has(exp.id);
                const hasDetails = (exp.comment || exp.dishes.length > 0);
                
                return (
                  <div
                    key={exp.id}
                    className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* En-tête cliquable */}
                    <button
                      onClick={() => {
                        if (hasDetails) {
                          setExpandedExperiences((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(exp.id)) {
                              newSet.delete(exp.id);
                            } else {
                              newSet.add(exp.id);
                            }
                            return newSet;
                          });
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-3 ${hasDetails ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
                      disabled={!hasDetails}
                    >
                      {/* Logo */}
                      <div className="h-16 w-16 overflow-hidden rounded-lg flex-shrink-0">
                        {exp.restaurantLogoUrl ? (
                          <img
                            src={exp.restaurantLogoUrl}
                            alt={exp.restaurantName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-white flex items-center justify-center">
                            <span className="text-base font-semibold text-slate-600">
                              {exp.restaurantName.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Nom de l'enseigne et Date */}
                      <div className="flex-1 min-w-0 flex flex-col text-left">
                        {exp.restaurantSlug ? (
                          <Link
                            href={`/restaurants/${exp.restaurantSlug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-medium text-white hover:text-bitebox transition-colors truncate"
                          >
                            {exp.restaurantName}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-white truncate">
                            {exp.restaurantName}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 mt-0.5">
                          {formatDate(exp.visitedAt)}
                        </span>
                      </div>
                      
                      {/* Note */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-sm ${
                                exp.rating >= star
                                  ? "text-orange-400"
                                  : "text-slate-700"
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-orange-400 font-medium">
                          {exp.rating}/5
                        </span>
                      </div>
                      
                      {/* Flèche d'expansion */}
                      {hasDetails && (
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Contenu déroulant */}
                    {isExpanded && hasDetails && (
                      <div className="px-3 pb-3 pt-0 border-t border-white/10 mt-2">
                        {/* Commentaire */}
                        {exp.comment && (
                          <p className="text-sm text-slate-300 mb-3 leading-relaxed">
                            {exp.comment}
                          </p>
                        )}

                        {/* Plats goûtés */}
                        {exp.dishes.length > 0 && (
                          <div className="space-y-3 mt-3">
                            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                              Plats goûtés ({exp.dishes.length})
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {exp.dishes.map((dish, idx) => (
                                <div
                                  key={dish.dishId ?? `${exp.id}-dish-${idx}`}
                                  className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-2 hover:border-white/20 transition-all"
                                >
                                  {dish.imageUrl && (
                                    <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-800/50 mb-1">
                                      <img
                                        src={dish.imageUrl}
                                        alt={dish.dishName}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <p className="text-sm font-semibold text-white line-clamp-2 min-h-[2.5rem]">
                                    {dish.dishName}
                                  </p>
                                  <div className="flex items-center gap-2 mt-auto">
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                          key={star}
                                          className={`text-sm ${
                                            dish.rating >= star
                                              ? "text-orange-400"
                                              : "text-slate-700"
                                          }`}
                                        >
                                          ★
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-xs text-orange-400 font-semibold">
                                      {dish.rating}/5
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
