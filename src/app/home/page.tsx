"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { calculatePublicRating } from "@/lib/ratingUtils";
import Spinner from "@/components/Spinner";

type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
};

type RestaurantRatingStats = {
  count: number;
  sum: number;
  avg: number;
};

type RestaurantWithStats = Restaurant & {
  ratingStats: RestaurantRatingStats;
};

export default function HomePage() {
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<RestaurantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setError(null);
        setLoading(true);

        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name, slug, logo_url")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[Home] load restaurants error", error);
          setError("Erreur lors du chargement des enseignes.");
          return;
        }

        const restaurantsData = (data || []) as Restaurant[];

        // Récupérer les notes de tous les restaurants avec user_id pour calculer la note publique (1 utilisateur = 1 voix)
        const { data: ratingRows, error: ratingError } = await supabase
          .from("fastfood_logs")
          .select("restaurant_id, user_id, rating");

        if (ratingError) {
          console.error("Erreur chargement notes restaurants", ratingError);
        }

        // Grouper les logs par restaurant_id
        const logsByRestaurant = new Map<string, Array<{ user_id: string; rating: number | null }>>();

        if (ratingRows) {
          for (const row of ratingRows) {
            if (!row.restaurant_id) continue;
            const restaurantLogs = logsByRestaurant.get(row.restaurant_id) ?? [];
            restaurantLogs.push({
              user_id: row.user_id,
              rating: row.rating,
            });
            logsByRestaurant.set(row.restaurant_id, restaurantLogs);
          }
        }

        // Enrichir chaque restaurant avec ses stats (note publique = 1 utilisateur = 1 voix)
        const restaurantsWithStats: RestaurantWithStats[] = restaurantsData.map((r) => {
          const logs = logsByRestaurant.get(r.id) ?? [];
          const { publicRating, uniqueVotersCount } = calculatePublicRating(logs);
          return {
            ...r,
            ratingStats: {
              count: uniqueVotersCount,
              sum: publicRating * uniqueVotersCount,
              avg: publicRating,
            },
          };
        });

        setRestaurants(restaurantsWithStats);
        setFilteredRestaurants(restaurantsWithStats);
      } catch (err) {
        console.error("[Home] unexpected", err);
        setError("Erreur inattendue lors du chargement des enseignes.");
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Filtrer les restaurants en fonction de la recherche
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRestaurants(restaurants);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = restaurants.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(query)
    );
    setFilteredRestaurants(filtered);
  }, [searchQuery, restaurants]);

  const getRestaurantUrl = (r: RestaurantWithStats) =>
    r.slug ? `/restaurants/${r.slug}` : `/restaurants/${r.id}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-2">

        {/* Barre de recherche */}
        <section className="pt-0 pb-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher une enseigne..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 pr-10 text-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bitebox focus:border-transparent transition"
            />
            <svg
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </section>

        {/* Liste des enseignes */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            {searchQuery
              ? `Résultats de recherche${filteredRestaurants.length > 0 ? ` (${filteredRestaurants.length})` : ""}`
              : "Tous les spots"}
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : filteredRestaurants.length === 0 ? (
            <p className="text-sm text-slate-400">
              {searchQuery
                ? `Aucune enseigne ne correspond à "${searchQuery}".`
                : "Aucune enseigne pour l'instant. Ajoute-en via la page admin."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredRestaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  href={getRestaurantUrl(restaurant)}
                  className="group block bg-slate-900/80 rounded-2xl shadow-md hover:shadow-xl border border-slate-800/70 hover:border-bitebox/60 transition overflow-hidden h-full flex flex-col"
                >
                  <div className="aspect-[4/3] sm:aspect-square bg-slate-950 overflow-hidden">
                    {restaurant.logo_url ? (
                      <img
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-slate-500">
                          Pas de logo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-3 space-y-1">
                    <p className="text-sm font-semibold truncate group-hover:text-bitebox-light">
                      {restaurant.name}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                      {restaurant.ratingStats.count === 0 ? (
                        <span className="text-[11px] text-slate-500">Note : à venir</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={
                                  restaurant.ratingStats.avg >= star
                                    ? "text-yellow-400"
                                    : "text-slate-700"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {restaurant.ratingStats.avg.toFixed(1)} / 5 ·{" "}
                            {restaurant.ratingStats.count} avis
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

