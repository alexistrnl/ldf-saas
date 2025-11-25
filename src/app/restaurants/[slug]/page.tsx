"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AddExperienceModal from "@/components/AddExperienceModal";

type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
};

type Dish = {
  id: string;
  restaurant_id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  is_signature: boolean;
  sort_order: number | null;
};

type RatingStats = {
  count: number;
  sum: number;
  avg: number;
};

type DishWithStats = Dish & {
  ratingStats: RatingStats;
};

export default function RestaurantPage() {
  const params = useParams<{ slug: string }>();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantRatingStats, setRestaurantRatingStats] = useState<{ count: number; avg: number }>({ count: 0, avg: 0 });
  const [dishes, setDishes] = useState<DishWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddExperienceOpen, setIsAddExperienceOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        setLoading(true);

        // 1) Charger l'enseigne par son slug
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("slug", params.slug)
          .single();

        if (restaurantError || !restaurantData) {
          console.error("[RestaurantPage] restaurant error", restaurantError);
          setError("Impossible de charger cette enseigne.");
          setLoading(false);
          return;
        }

        setRestaurant(restaurantData as Restaurant);

        // 2) Charger les logs concernant cette enseigne pour calculer la note moyenne
        const { data: restaurantLogs, error: restaurantLogsError } = await supabase
          .from("fastfood_logs")
          .select("rating")
          .eq("restaurant_id", restaurantData.id);

        if (restaurantLogsError) {
          console.error("Erreur chargement logs restaurant", restaurantLogsError);
        }

        // Calculer moyenne + nombre d'avis pour l'enseigne
        let restaurantRatingStats: { count: number; avg: number } = {
          count: 0,
          avg: 0,
        };

        if (restaurantLogs && restaurantLogs.length > 0) {
          const count = restaurantLogs.length;
          const sum = restaurantLogs.reduce(
            (acc, row) => acc + (row.rating ?? 0),
            0
          );
          restaurantRatingStats = {
            count,
            avg: sum / count,
          };
        }

        setRestaurantRatingStats(restaurantRatingStats);

        // 3) Charger les plats de cette enseigne
        const { data: dishesData, error: dishesError } = await supabase
          .from("dishes")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });

        if (dishesError) {
          console.error("[RestaurantPage] dishes error", dishesError);
          setLoading(false);
          return;
        }

        const dishesDataTyped = (dishesData || []) as Dish[];

        // 4) Charger les notes des plats depuis fastfood_log_dishes
        const dishIds = dishesDataTyped.map((d) => d.id);

        let dishRatingMap = new Map<string, { count: number; sum: number; avg: number }>();

        if (dishIds.length > 0) {
          const { data: dishLogs, error: dishLogsError } = await supabase
            .from("fastfood_log_dishes")
            .select("dish_id, rating")
            .in("dish_id", dishIds);

          if (dishLogsError) {
            console.error("Erreur chargement notes plats", dishLogsError);
          } else if (dishLogs) {
            dishRatingMap = new Map();

            for (const row of dishLogs) {
              if (!row.dish_id || typeof row.rating !== "number") continue;
              const current = dishRatingMap.get(row.dish_id) ?? {
                count: 0,
                sum: 0,
                avg: 0,
              };
              const count = current.count + 1;
              const sum = current.sum + row.rating;
              dishRatingMap.set(row.dish_id, {
                count,
                sum,
                avg: sum / count,
              });
            }
          }
        }

        // Enrichir chaque plat avec ses stats
        const dishesWithStats: DishWithStats[] = dishesDataTyped.map((dish) => {
          const stats = dishRatingMap.get(dish.id);
          return {
            ...dish,
            ratingStats: stats ?? { count: 0, sum: 0, avg: 0 },
          };
        });

        setDishes(dishesWithStats);
        setLoading(false);
      } catch (err) {
        console.error("[RestaurantPage] unexpected error", err);
        setError("Erreur inattendue lors du chargement de l'enseigne.");
        setLoading(false);
      }
    };

    if (params?.slug) {
      fetchData();
    }
  }, [params?.slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p>Chargement...</p>
      </main>
    );
  }

  if (error || !restaurant) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-red-400">{error ?? "Enseigne introuvable."}</p>
      </main>
    );
  }

  // Calculer le Top 4 des plats les mieux notés
  const topRatedDishes = dishes
    .filter((d) => d.ratingStats.count > 0)
    .sort((a, b) => {
      if (b.ratingStats.avg === a.ratingStats.avg) {
        return b.ratingStats.count - a.ratingStats.count; // départage sur nb d'avis
      }
      return b.ratingStats.avg - a.ratingStats.avg;
    })
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header enseigne */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-4">
            {restaurant.logo_url && (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-sm text-slate-300 mt-1">
                  {restaurant.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
                {restaurantRatingStats.count === 0 ? (
                  <span className="text-[11px] text-slate-500">
                    Cette enseigne n'a pas encore de note publique.
                  </span>
                ) : (
                  <>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={
                            restaurantRatingStats.avg >= star
                              ? "text-amber-400"
                              : "text-slate-700"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {restaurantRatingStats.avg.toFixed(1)} / 5 ·{" "}
                      {restaurantRatingStats.count} avis
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsAddExperienceOpen(true)}
            className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-emerald-400 transition"
          >
            Ajouter une note
          </button>
        </div>

        {/* Top 4 plats les mieux notés */}
        {topRatedDishes.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-50 mb-3">
              Les plats les mieux notés
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Le top 4 des plats notés par la communauté pour cette enseigne.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topRatedDishes.map((dish, index) => (
                <div
                  key={dish.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm"
                >
                  {/* Image */}
                  <div className="aspect-[4/3] bg-slate-950 flex items-center justify-center">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Pas d'image</span>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-100 truncate">
                        {dish.name}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/40">
                        Top {index + 1}
                      </span>
                    </div>

                    {/* Note en étoiles */}
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={
                              dish.ratingStats.avg >= star
                                ? "text-amber-400"
                                : "text-slate-700"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-400 ml-1">
                        {dish.ratingStats.avg.toFixed(1)} / 5 ·{" "}
                        {dish.ratingStats.count} avis
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Carte des plats */}
        <section className="mt-4">
          <h2 className="text-lg font-semibold mb-3">La carte</h2>

          {dishes.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucun plat n'a encore été ajouté pour cette enseigne.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {dishes.map((dish) => (
                <div
                  key={dish.id}
                  className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md"
                >
                  <div className="aspect-[4/3] bg-slate-950 flex items-center justify-center">
                    {dish.image_url ? (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Pas d’image</span>
                    )}
                  </div>

                  <div className="px-3 py-3 space-y-1">
                    <p className="text-sm font-semibold truncate">{dish.name}</p>
                    {dish.is_signature && (
                      <span className="inline-flex items-center rounded-full bg-amber-500/90 text-black text-[10px] font-semibold px-2 py-[1px]">
                        Plat signature
                      </span>
                    )}
                    {dish.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {dish.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                      {dish.ratingStats.count === 0 ? (
                        <span className="text-slate-500">Pas encore noté</span>
                      ) : (
                        <>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  dish.ratingStats.avg >= star
                                    ? "text-amber-400"
                                    : "text-slate-700"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-slate-400 ml-1">
                            {dish.ratingStats.avg.toFixed(1)} / 5 · {dish.ratingStats.count} avis
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <AddExperienceModal
        isOpen={isAddExperienceOpen}
        onClose={() => setIsAddExperienceOpen(false)}
        presetRestaurantId={restaurant.id}
        presetRestaurantName={restaurant.name}
      />
    </main>
  );
}
