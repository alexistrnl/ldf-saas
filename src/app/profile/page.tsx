"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

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
  const [user, setUser] = useState<User | null>(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
          <div className="max-w-md mx-auto text-center space-y-4">
            <p className="text-sm text-slate-300">
              Tu dois être connecté pour voir ton profil.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-amber-400 transition"
            >
              Me connecter
            </Link>
          </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold hidden md:block">Mon profil</h1>
          <p className="text-sm text-slate-400">{user.email}</p>
        </header>

        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Restaurants que j'ai testés */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Restaurants que j'ai testés</h2>
          {restaurantsSummary.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore testé de restaurant.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {restaurantsSummary.map((r) => (
                <Link
                  key={r.restaurantId}
                  href={r.slug ? `/restaurants/${r.slug}` : "#"}
                  className={`group block bg-slate-900/80 rounded-2xl shadow-md hover:shadow-xl border border-slate-800/70 hover:border-amber-500/60 transition overflow-hidden ${
                    !r.slug ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <div className="aspect-[16/9] flex items-center justify-center bg-slate-950">
                    {r.logoUrl ? (
                      <img
                        src={r.logoUrl}
                        alt={r.restaurantName}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">
                        Pas de logo
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-3 space-y-1">
                    <p className="text-sm font-semibold truncate group-hover:text-amber-400">
                      {r.restaurantName}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={
                                r.avgRating >= star
                                  ? "text-amber-400"
                                  : "text-slate-700"
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {r.avgRating.toFixed(1)} / 5
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {r.visitsCount} visite{r.visitsCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Mes expériences */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Mes expériences</h2>

          {experiences.length === 0 ? (
            <p className="text-sm text-slate-400">
              Tu n'as pas encore enregistré d'expérience.
            </p>
          ) : (
            <div className="space-y-3">
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 shadow-sm"
                >
                  {/* Header : logo + nom + date + note */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {exp.restaurantLogoUrl ? (
                        <div className="h-9 w-9 rounded-full bg-slate-950 overflow-hidden flex items-center justify-center flex-shrink-0">
                          <img
                            src={exp.restaurantLogoUrl}
                            alt={exp.restaurantName}
                            className="h-9 w-9 object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-300 flex-shrink-0">
                          {exp.restaurantName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {exp.restaurantSlug ? (
                          <Link
                            href={`/restaurants/${exp.restaurantSlug}`}
                            className="text-sm font-semibold text-slate-100 hover:text-amber-300 block truncate"
                          >
                            {exp.restaurantName}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {exp.restaurantName}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400">
                          {exp.visitedAt
                            ? new Date(exp.visitedAt).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "Date inconnue"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={
                              exp.rating >= star
                                ? "text-amber-400"
                                : "text-slate-700"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {exp.rating} / 5
                      </span>
                    </div>
                  </div>

                  {/* Commentaire */}
                  {exp.comment && (
                    <p className="text-xs text-slate-300 mt-2 px-1">
                      {exp.comment}
                    </p>
                  )}

                  {/* Plats notés */}
                  {exp.dishes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] text-slate-400 mb-2">
                        Plats goûtés :
                      </p>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {exp.dishes.map((dish, idx) => (
                          <div
                            key={dish.dishId ?? `${exp.id}-dish-${idx}`}
                            className="min-w-[130px] max-w-[150px] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex-shrink-0"
                          >
                            {dish.imageUrl ? (
                              <div className="h-20 w-full overflow-hidden">
                                <img
                                  src={dish.imageUrl}
                                  alt={dish.dishName}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-20 w-full flex items-center justify-center bg-slate-900 text-[11px] text-slate-400">
                                Pas d'image
                              </div>
                            )}
                            <div className="px-3 py-2">
                              <p className="text-[11px] font-medium text-slate-100 truncate">
                                {dish.dishName}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <span
                                      key={star}
                                      className={
                                        dish.rating >= star
                                          ? "text-amber-400"
                                          : "text-slate-700"
                                      }
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {dish.rating}/5
                                </span>
                              </div>
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
    </div>
  );
}
