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
  latestDishCreatedAt: string | null;
};

export default function HomePage() {
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<RestaurantWithStats[]>([]);
  const [trendingRestaurants, setTrendingRestaurants] = useState<RestaurantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'best-rating' | 'worst-rating' | 'alphabetical' | 'most-ratings' | 'least-ratings'>('best-rating');
  const [showSortMenu, setShowSortMenu] = useState(false);

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

        // Grouper les logs par restaurant_id pour calculer les notes
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

        // Récupérer la date du dernier plat créé pour chaque restaurant
        const { data: allDishes, error: dishesError } = await supabase
          .from("dishes")
          .select("restaurant_id, created_at");

        if (dishesError) {
          console.error("Erreur chargement plats pour dates", dishesError);
        }

        // Trouver la date du dernier plat créé pour chaque restaurant
        const latestDishDates = new Map<string, string>();
        if (allDishes) {
          for (const dish of allDishes) {
            if (!dish.restaurant_id || !dish.created_at) continue;
            const currentLatest = latestDishDates.get(dish.restaurant_id);
            if (!currentLatest || dish.created_at > currentLatest) {
              latestDishDates.set(dish.restaurant_id, dish.created_at);
            }
          }
        }

        // Enrichir chaque restaurant avec ses stats (note publique = 1 utilisateur = 1 voix) et la date du dernier plat
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
            latestDishCreatedAt: latestDishDates.get(r.id) || null,
          };
        });

        setRestaurants(restaurantsWithStats);
        setFilteredRestaurants(restaurantsWithStats);

        // Récupérer les enseignes du moment (les plus notées sur les 3 derniers jours)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const threeDaysAgoStr = threeDaysAgo.toISOString();

        const { data: recentLogs, error: recentLogsError } = await supabase
          .from("fastfood_logs")
          .select("restaurant_id, user_id, rating")
          .gte("created_at", threeDaysAgoStr);

        if (recentLogsError) {
          console.error("Erreur chargement logs récents", recentLogsError);
        } else if (recentLogs) {
          // Compter le nombre de notes par restaurant sur les 3 derniers jours
          const noteCountsByRestaurant = new Map<string, number>();
          
          for (const log of recentLogs) {
            if (!log.restaurant_id) continue;
            const currentCount = noteCountsByRestaurant.get(log.restaurant_id) ?? 0;
            noteCountsByRestaurant.set(log.restaurant_id, currentCount + 1);
          }

          // Trier les restaurants par nombre de notes (décroissant)
          // Note: restaurantsWithStats contient déjà latestDishCreatedAt
          const trendingList = restaurantsWithStats
            .map((r) => ({
              ...r,
              recentNotesCount: noteCountsByRestaurant.get(r.id) ?? 0,
            }))
            .filter((r) => r.recentNotesCount > 0)
            .sort((a, b) => b.recentNotesCount - a.recentNotesCount)
            .slice(0, 8) // Top 8
            .map(({ recentNotesCount, ...rest }) => rest) as RestaurantWithStats[];

          setTrendingRestaurants(trendingList);
        }
      } catch (err) {
        console.error("[Home] unexpected", err);
        setError("Erreur inattendue lors du chargement des enseignes.");
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Fonction de tri
  const sortRestaurants = (restaurantsToSort: RestaurantWithStats[]) => {
    const sorted = [...restaurantsToSort];
    
    switch (sortBy) {
      case 'best-rating':
        return sorted.sort((a, b) => {
          if (a.ratingStats.count === 0 && b.ratingStats.count === 0) return 0;
          if (a.ratingStats.count === 0) return 1;
          if (b.ratingStats.count === 0) return -1;
          return b.ratingStats.avg - a.ratingStats.avg;
        });
      
      case 'worst-rating':
        return sorted.sort((a, b) => {
          if (a.ratingStats.count === 0 && b.ratingStats.count === 0) return 0;
          if (a.ratingStats.count === 0) return 1;
          if (b.ratingStats.count === 0) return -1;
          return a.ratingStats.avg - b.ratingStats.avg;
        });
      
      case 'alphabetical':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      
      case 'most-ratings':
        return sorted.sort((a, b) => b.ratingStats.count - a.ratingStats.count);
      
      case 'least-ratings':
        return sorted.sort((a, b) => a.ratingStats.count - b.ratingStats.count);
      
      default:
        return sorted;
    }
  };

  // Filtrer et trier les restaurants en fonction de la recherche et du tri
  useEffect(() => {
    let filtered = restaurants;
    
    // Filtrer par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = restaurants.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(query)
      );
    }
    
    // Trier les résultats
    const sorted = sortRestaurants(filtered);
    setFilteredRestaurants(sorted);
  }, [searchQuery, restaurants, sortBy]);

  const getRestaurantUrl = (r: RestaurantWithStats) =>
    r.slug ? `/restaurants/${r.slug}` : `/restaurants/${r.id}`;

  // Fonction pour déterminer si un restaurant est "NEW" (dernier plat créé < 3 jours)
  const isRestaurantNew = (restaurant: RestaurantWithStats): boolean => {
    if (!restaurant.latestDishCreatedAt) {
      return false;
    }

    const latestDishDate = new Date(restaurant.latestDishCreatedAt);
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return latestDishDate.getTime() >= threeDaysAgo;
  };

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
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-slate-200">
              {searchQuery
                ? `Résultats de recherche${filteredRestaurants.length > 0 ? ` (${filteredRestaurants.length})` : ""}`
                : "Tous les spots"}
            </h2>
            
            {/* Icône de tri */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Options de tri"
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
                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  />
                </svg>
              </button>
              
              {/* Menu déroulant de tri */}
              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() => { setSortBy('best-rating'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors ${
                        sortBy === 'best-rating' ? 'text-bitebox bg-slate-800' : 'text-white'
                      }`}
                    >
                      Meilleure note
                    </button>
                    <button
                      onClick={() => { setSortBy('worst-rating'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors ${
                        sortBy === 'worst-rating' ? 'text-bitebox bg-slate-800' : 'text-white'
                      }`}
                    >
                      Moins bonne note
                    </button>
                    <button
                      onClick={() => { setSortBy('alphabetical'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors ${
                        sortBy === 'alphabetical' ? 'text-bitebox bg-slate-800' : 'text-white'
                      }`}
                    >
                      Ordre alphabétique
                    </button>
                    <button
                      onClick={() => { setSortBy('most-ratings'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors ${
                        sortBy === 'most-ratings' ? 'text-bitebox bg-slate-800' : 'text-white'
                      }`}
                    >
                      Plus de notes
                    </button>
                    <button
                      onClick={() => { setSortBy('least-ratings'); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 transition-colors ${
                        sortBy === 'least-ratings' ? 'text-bitebox bg-slate-800' : 'text-white'
                      }`}
                    >
                      Moins de notes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

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
            <div className="flex flex-col gap-3">
              {filteredRestaurants.map((restaurant) => {
                const isNew = isRestaurantNew(restaurant);
                return (
                <Link
                  key={restaurant.id}
                  href={getRestaurantUrl(restaurant)}
                  className="group block bg-white/5 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md border border-white/10 hover:border-bitebox/40 transition-all overflow-hidden flex flex-col relative w-full"
                >
                  {isNew && (
                    <div className="absolute top-2 right-2 z-10 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-md">
                      NEW
                    </div>
                  )}
                  <div className="w-full overflow-hidden rounded-t-lg bg-white" style={{ aspectRatio: 'auto' }}>
                    {restaurant.logo_url ? (
                      <img
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        className="w-full h-auto block"
                        style={restaurant.name.toLowerCase().includes('nach!') ? { maxHeight: '180px', objectFit: 'contain' } : {}}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          const container = img.parentElement;
                          if (container) {
                            // Pour nach!, limiter la hauteur à 180px pour mieux voir le logo
                            if (restaurant.name.toLowerCase().includes('nach!')) {
                              container.style.height = '180px';
                            } else {
                              container.style.height = `${img.offsetHeight}px`;
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center">
                        <span className="text-xs text-slate-500">
                          Pas de logo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 space-y-1">
                    <p className="text-sm font-medium truncate group-hover:text-bitebox transition-colors">
                      {restaurant.name}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                      {restaurant.ratingStats.count === 0 ? (
                        <span className="text-[11px] text-slate-500">Note : à venir (0)</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-base ${
                                  restaurant.ratingStats.avg >= star
                                    ? "text-orange-400"
                                    : "text-slate-700"
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-orange-400 font-medium">
                            {restaurant.ratingStats.avg.toFixed(1)} / 5 ({restaurant.ratingStats.count})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

