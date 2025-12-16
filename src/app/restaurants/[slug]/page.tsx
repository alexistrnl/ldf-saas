"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AddExperienceModal from "@/components/AddExperienceModal";
import Image from "next/image";
import { calculatePublicRating } from "@/lib/ratingUtils";
import { useIsMobile } from "@/hooks/useIsMobile";
import Spinner from "@/components/Spinner";

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
  is_limited_edition: boolean;
  sort_order: number | null;
  category_id: string | null;
};

type DishCategory = {
  id: string;
  restaurant_id: string;
  name: string;
  order_index: number;
};

type RatingStats = {
  count: number;
  sum: number;
  avg: number;
};

type DishWithStats = Dish & {
  ratingStats: RatingStats;
};

// Fonction helper pour détecter si une image est un PNG
const isPngImage = (url: string | null): boolean => {
  if (!url) return false;
  // Extraire le chemin sans paramètres de requête ni fragments
  const path = url.split('?')[0].split('#')[0];
  return path.toLowerCase().endsWith('.png');
};

// Fonction helper pour déterminer si un plat Burgouzz doit avoir une image en cover avec zoom
const getBurgouzzDishCover = (dish: Dish, category: DishCategory | null, restaurant: Restaurant | null): { shouldCover: boolean; zoomLevel: string } => {
  if (!restaurant) return { shouldCover: false, zoomLevel: '' };
  const isBurgouzz = restaurant.name?.toLowerCase().includes("burgouzz") || restaurant.slug?.toLowerCase().includes("burgouzz");
  if (!isBurgouzz) return { shouldCover: false, zoomLevel: '' };
  
  const dishNameLower = dish.name?.toLowerCase() || "";
  const categoryNameLower = category?.name?.toLowerCase() || "";
  
  // Croquettes camembert
  if (dishNameLower.includes("croquette") && dishNameLower.includes("camembert")) {
    return { shouldCover: true, zoomLevel: 'scale-110' };
  }
  
  // Binchouzz
  if (dishNameLower.includes("binchouzz")) {
    return { shouldCover: true, zoomLevel: 'scale-110' };
  }
  
  // Tous les plats de la section "sauce"
  if (categoryNameLower.includes("sauce")) {
    return { shouldCover: true, zoomLevel: 'scale-110' };
  }
  
  return { shouldCover: false, zoomLevel: '' };
};

// Fonction helper pour déterminer le niveau de zoom pour un plat Popeyes
const getPopeyesDishZoom = (dish: Dish, category: DishCategory | null, restaurant: Restaurant | null): { shouldZoom: boolean; zoomLevel: string; shouldCenter: boolean } => {
  if (!restaurant) return { shouldZoom: false, zoomLevel: 'scale-95', shouldCenter: false };
  const isPopeyes = restaurant.name?.toLowerCase().includes("popeyes") || restaurant.slug?.toLowerCase().includes("popeyes");
  if (!isPopeyes) return { shouldZoom: false, zoomLevel: 'scale-95', shouldCenter: false };
  
  const dishNameLower = dish.name?.toLowerCase() || "";
  const isMiniWrap = dishNameLower.includes("mini wrap");
  const isTenders = dishNameLower.includes("tenders");
  const isCajunBeanBurger = dishNameLower.includes("cajun bean burger");
  const isSaucesDipper = dishNameLower.includes("sauces dipper") || dishNameLower.includes("4 sauces dipper");
  const isAnyDipper = dishNameLower.includes("dipper") && !isSaucesDipper;
  const isSundayNature = dishNameLower.includes("sunday nature");
  const isDessert = category?.name?.toLowerCase().includes("dessert") || false;
  const isCroquePomme = dishNameLower.includes("croque pomme");
  
  // Pour tous les dipper (sauf 4 sauces dipper), zoom pour que les bords touchent le cadre
  if (isAnyDipper) {
    return { shouldZoom: true, zoomLevel: 'scale-[1.85]', shouldCenter: true };
  }
  
  // Pour les desserts (sauf croque pomme), zoom plus important
  if (isDessert && !isCroquePomme) {
    return { shouldZoom: true, zoomLevel: 'scale-150', shouldCenter: true };
  }
  
  // Pour cajun bean burger, zoom plus important
  if (isCajunBeanBurger) {
    return { shouldZoom: true, zoomLevel: 'scale-150', shouldCenter: true };
  }
  
  // Pour sauces dipper, zoom maximum pour combler le cadre
  if (isSaucesDipper) {
    return { shouldZoom: true, zoomLevel: 'scale-200', shouldCenter: true };
  }
  
  // Pour mini wrap et tenders, zoom normal
  if (isMiniWrap || isTenders) {
    return { shouldZoom: true, zoomLevel: 'scale-125', shouldCenter: true };
  }
  
  // Pour sunday nature, centrer mais pas de zoom supplémentaire
  if (isSundayNature) {
    return { shouldZoom: false, zoomLevel: 'scale-95', shouldCenter: true };
  }
  
  // Pour le croque pomme, centrer mais pas de zoom supplémentaire
  if (isCroquePomme) {
    return { shouldZoom: false, zoomLevel: 'scale-95', shouldCenter: true };
  }
  
  return { shouldZoom: false, zoomLevel: 'scale-95', shouldCenter: false };
};

export default function RestaurantPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantRatingStats, setRestaurantRatingStats] = useState<{ count: number; avg: number }>({ count: 0, avg: 0 });
  const [dishes, setDishes] = useState<DishWithStats[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddExperienceOpen, setIsAddExperienceOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [latestDishes, setLatestDishes] = useState<DishWithStats[]>([]);

  const handleAddNoteClick = () => {
    if (isMobile) {
      router.push(`/restaurants/${params.slug}/add-note`);
    } else {
      setIsAddExperienceOpen(true);
    }
  };

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

        // 2) Charger les logs concernant cette enseigne pour calculer la note publique (1 utilisateur = 1 voix)
        const { data: restaurantLogs, error: restaurantLogsError } = await supabase
          .from("fastfood_logs")
          .select("user_id, rating")
          .eq("restaurant_id", restaurantData.id);

        if (restaurantLogsError) {
          console.error("Erreur chargement logs restaurant", restaurantLogsError);
        }

        // Calculer la note publique avec la règle "1 utilisateur = 1 voix"
        const logs = (restaurantLogs || []) as Array<{ user_id: string; rating: number | null }>;
        const { publicRating, uniqueVotersCount } = calculatePublicRating(logs);

        const restaurantRatingStats: { count: number; avg: number } = {
          count: uniqueVotersCount,
          avg: publicRating,
        };

        setRestaurantRatingStats(restaurantRatingStats);

        // 3) Charger les sections de menu pour cette enseigne
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("dish_categories")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("order_index", { ascending: true });

        if (categoriesError) {
          console.error("[RestaurantPage] categories error", categoriesError);
          // Ne pas bloquer si les catégories n'existent pas encore
        }

        const categoriesTyped = (categoriesData || []) as DishCategory[];
        setCategories(categoriesTyped);

        // 4) Charger les plats de cette enseigne
        const { data: dishesData, error: dishesError } = await supabase
          .from("dishes")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("position", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true });

        if (dishesError) {
          console.error("[RestaurantPage] dishes error", dishesError);
          setLoading(false);
          return;
        }

        const dishesDataTyped = (dishesData || []) as Dish[];

        // 5) Charger les notes des plats depuis fastfood_log_dishes
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

        // 6) Charger les 4 derniers plats créés pour ce restaurant
        const { data: latestDishesData, error: latestDishesError } = await supabase
          .from("dishes")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("created_at", { ascending: false })
          .limit(4);

        if (latestDishesError) {
          console.error("[RestaurantPage] latest dishes error", latestDishesError);
        } else if (latestDishesData && latestDishesData.length > 0) {
          // Enrichir les plats récents avec leurs stats de notation
          const latestDishIds = latestDishesData.map((d) => d.id);
          const latestDishRatingMap = new Map<string, { count: number; sum: number; avg: number }>();

          if (latestDishIds.length > 0) {
            const { data: latestDishLogs, error: latestDishLogsError } = await supabase
              .from("fastfood_log_dishes")
              .select("dish_id, rating")
              .in("dish_id", latestDishIds);

            if (latestDishLogsError) {
              console.error("[RestaurantPage] latest dish logs error", latestDishLogsError);
            } else if (latestDishLogs) {
              for (const row of latestDishLogs) {
                if (!row.dish_id || typeof row.rating !== "number") continue;
                const current = latestDishRatingMap.get(row.dish_id) ?? {
                  count: 0,
                  sum: 0,
                  avg: 0,
                };
                const count = current.count + 1;
                const sum = current.sum + row.rating;
                latestDishRatingMap.set(row.dish_id, {
                  count,
                  sum,
                  avg: sum / count,
                });
              }
            }
          }

          // Construire les plats récents avec leurs stats
          const latestDishesWithStats: DishWithStats[] = (latestDishesData as Dish[]).map((dish) => {
            const stats = latestDishRatingMap.get(dish.id);
            return {
              ...dish,
              ratingStats: stats ?? { count: 0, sum: 0, avg: 0 },
            };
          });

          setLatestDishes(latestDishesWithStats);
        } else {
          setLatestDishes([]);
        }

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

  // Fonction helper pour rendre une carte de plat (réutilisée dans plusieurs sections)
  const renderDishCard = (dish: DishWithStats) => {
    const isPng = dish.image_url?.toLowerCase().includes(".png");
    const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");
    const isBlackWhite = restaurant?.name?.toLowerCase().includes("black") && restaurant?.name?.toLowerCase().includes("white");
    const category = categories.find(cat => cat.id === dish.category_id) || null;
    const { shouldZoom, zoomLevel, shouldCenter } = getPopeyesDishZoom(dish, category, restaurant);
    const { shouldCover: shouldCoverBurgouzz, zoomLevel: burgouzzZoomLevel } = getBurgouzzDishCover(dish, category, restaurant);
    
    return (
      <div
        key={dish.id}
        className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col"
      >
        <div className={`relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-amber-50 border border-amber-200 ${isPng && !shouldCoverBurgouzz ? 'py-2' : ''}`}>
          {dish.image_url ? (
            shouldCoverBurgouzz ? (
              <img
                src={dish.image_url}
                alt={dish.name}
                className={`w-full h-full object-cover object-center ${burgouzzZoomLevel}`}
              />
            ) : isPng ? (
              <img
                src={dish.image_url}
                alt={dish.name}
                className={`w-full h-full object-contain object-center ${isBlackWhite ? 'scale-150' : zoomLevel} drop-shadow-xl ${isBurgerKing ? 'px-4' : 'px-4'}`}
              />
            ) : (
              <img
                src={dish.image_url}
                alt={dish.name}
                className={`w-full h-full object-cover object-center ${shouldZoom ? zoomLevel : ''}`}
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-slate-500">Pas d'image</span>
            </div>
          )}
        </div>

        <div className="px-3 py-3 space-y-1">
          <p className="text-sm font-semibold truncate">{dish.name}</p>
          {(dish.is_signature || dish.is_limited_edition) && (
            <div className="flex gap-2 flex-wrap">
              {dish.is_signature && (
                <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                  Plat signature
                </span>
              )}
              {dish.is_limited_edition && (
                <span className="inline-flex items-center rounded-full bg-bitebox/60 text-white text-[10px] font-semibold px-2 py-[1px]">
                  Édition limitée
                </span>
              )}
            </div>
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
                          ? "text-yellow-400"
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
    );
  };

  // Filtrer les catégories qui ont des plats (calculé avec useMemo)
  const categoriesWithDishes = useMemo(() => {
    if (!categories || !dishes) return [];
    return categories.filter((cat) => {
      return dishes.some((d) => d.category_id === cat.id);
    });
  }, [categories, dishes]);

  // Créer une dépendance stable basée sur les IDs pour l'observer
  const categoryIdsString = useMemo(() => {
    return categoriesWithDishes.map((cat) => cat.id).join(",");
  }, [categoriesWithDishes]);

  // Observer pour détecter la section visible lors du scroll
  useEffect(() => {
    if (categoriesWithDishes.length === 0 || loading) return;

    let observer: IntersectionObserver | null = null;
    const categoryIds = categoriesWithDishes.map((cat) => cat.id);

    // Petit délai pour s'assurer que les éléments DOM sont rendus
    const timeoutId = setTimeout(() => {
      const observerOptions = {
        root: null,
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      };

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const categoryId = entry.target.id.replace("section-", "");
            setActiveCategoryId(categoryId);
          }
        });
      }, observerOptions);

      // Observer toutes les sections de catégories
      categoryIds.forEach((categoryId) => {
        const element = document.getElementById(`section-${categoryId}`);
        if (element) {
          observer?.observe(element);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        categoryIds.forEach((categoryId) => {
          const element = document.getElementById(`section-${categoryId}`);
          if (element) {
            observer?.unobserve(element);
          }
        });
        observer?.disconnect();
      }
    };
  }, [categoryIdsString, loading, categoriesWithDishes.length]);

  // Définir la première catégorie comme active par défaut
  useEffect(() => {
    if (categoriesWithDishes.length > 0 && activeCategoryId === null && !loading) {
      setActiveCategoryId(categoriesWithDishes[0].id);
    }
  }, [categoriesWithDishes, loading, activeCategoryId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-red-400">{error ?? "Enseigne introuvable."}</p>
      </div>
    );
  }

  // Calculer le Top 3 des plats les mieux notés
  const topRatedDishes = dishes
    .filter((d) => d.ratingStats.count > 0)
    .sort((a, b) => {
      if (b.ratingStats.avg === a.ratingStats.avg) {
        return b.ratingStats.count - a.ratingStats.count; // départage sur nb d'avis
      }
      return b.ratingStats.avg - a.ratingStats.avg;
    })
    .slice(0, 3);

  // Fonction de scroll fluide vers une section
  const scrollToSection = (categoryId: string) => {
    const el = document.getElementById(`section-${categoryId}`);
    if (!el) return;
    setActiveCategoryId(categoryId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-b-3xl bg-black/40">
        {/* Bannière */}
        <div className="relative h-40 sm:h-52">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
              <span className="text-sm text-slate-500">Pas de logo</span>
            </div>
          )}
          {/* Dégradé en bas pour la lisibilité */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Bloc note + bouton */}
        <section className="mt-4 flex flex-col items-center gap-4 mb-3">
          {/* Bloc note */}
          {restaurantRatingStats.count === 0 ? (
            <span className="text-sm text-slate-500">
              Cette enseigne n'a pas encore de note publique.
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      restaurantRatingStats.avg >= star
                        ? "text-yellow-400"
                        : "text-slate-700"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm text-slate-300">
                {restaurantRatingStats.avg.toFixed(1)} / 5 • {restaurantRatingStats.count} avis
              </span>
            </div>
          )}

          {/* Bouton Ajouter une note */}
          <button
            onClick={handleAddNoteClick}
            className="inline-flex items-center rounded-full bg-bitebox px-6 py-3 text-sm font-semibold text-white shadow hover:bg-bitebox-dark transition"
          >
            Ajouter une note
          </button>
        </section>

        {/* Derniers ajouts */}
        <section className="mt-6">
          <h3 className="mb-3 text-base font-semibold text-white">Derniers ajouts</h3>
          {latestDishes.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun plat ajouté récemment à la carte.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-x-visible sm:pb-0 sm:snap-none">
              {latestDishes.slice(0, 3).map((dish) => (
                <div key={dish.id} className="w-[260px] flex-shrink-0 snap-start sm:w-auto sm:flex-shrink sm:snap-none">
                  {renderDishCard(dish)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top 3 plats les mieux notés */}
        {topRatedDishes.length > 0 && (
          <section className="mt-4">
            <h2 className="text-lg font-semibold text-slate-50 mb-3">
              Les plats les mieux notés
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Le top 3 des plats notés par la communauté pour cette enseigne.
            </p>
            
            {/* Carrousel horizontal scrollable */}
            <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-x-visible sm:pb-0 sm:snap-none">
              {topRatedDishes.map((dish, index) => (
                <div
                  key={dish.id}
                  className="w-[260px] flex-shrink-0 snap-start sm:w-auto sm:flex-shrink sm:snap-none"
                >
                  <div className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col">
                    {/* Image */}
                    {(() => {
                      const isPng = dish.image_url?.toLowerCase().includes(".png");
                      const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");
                      const isBlackWhite = restaurant?.name?.toLowerCase().includes("black") && restaurant?.name?.toLowerCase().includes("white");
                      const category = categories.find(cat => cat.id === dish.category_id) || null;
                      const { shouldZoom, zoomLevel, shouldCenter } = getPopeyesDishZoom(dish, category, restaurant);
                      const { shouldCover: shouldCoverBurgouzz, zoomLevel: burgouzzZoomLevel } = getBurgouzzDishCover(dish, category, restaurant);
                      return (
                        <div className={`relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-amber-50 border border-amber-200 ${isPng && !shouldCoverBurgouzz ? 'py-2' : ''}`}>
                          {dish.image_url ? (
                            shouldCoverBurgouzz ? (
                              <img
                                src={dish.image_url}
                                alt={dish.name}
                                className={`w-full h-full object-cover object-center ${burgouzzZoomLevel}`}
                              />
                            ) : isPng ? (
                              <img
                                src={dish.image_url}
                                alt={dish.name}
                                className={`w-full h-full object-contain object-center ${isBlackWhite ? 'scale-150' : zoomLevel} drop-shadow-xl ${isBurgerKing ? 'px-4' : 'px-4'}`}
                              />
                            ) : (
                              <img
                                src={dish.image_url}
                                alt={dish.name}
                                className={`w-full h-full object-cover object-center ${shouldZoom ? zoomLevel : ''}`}
                              />
                            )
                          ) : (
                            <span className="text-xs text-slate-500">Pas d'image</span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Contenu */}
                    <div className="px-4 py-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-100 truncate">
                          {dish.name}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-bitebox/10 text-yellow-400 border border-bitebox/40 whitespace-nowrap">
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
                                  ? "text-yellow-400"
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
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Carte des plats */}
        <section className="mt-3">
          <h2 className="text-lg font-semibold mb-3">La carte</h2>

          {dishes.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucun plat n'a encore été ajouté pour cette enseigne.
            </p>
          ) : categories.length === 0 ? (
            // Affichage sans sections (comportement par défaut)
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {dishes.map((dish) => (
                <div
                  key={dish.id}
                  className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col"
                >
                  {(() => {
                    const isPng = dish.image_url?.toLowerCase().includes(".png");
                    const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");
                    const isBlackWhite = restaurant?.name?.toLowerCase().includes("black") && restaurant?.name?.toLowerCase().includes("white");
                    const category = categories.find(cat => cat.id === dish.category_id) || null;
                    const { shouldZoom, zoomLevel, shouldCenter } = getPopeyesDishZoom(dish, category, restaurant);
                    const { shouldCover: shouldCoverBurgouzz, zoomLevel: burgouzzZoomLevel } = getBurgouzzDishCover(dish, category, restaurant);
                    return (
                      <div className={`relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-amber-50 border border-amber-200 ${isPng && !shouldCoverBurgouzz ? 'py-2' : ''}`}>
                        {dish.image_url ? (
                          shouldCoverBurgouzz ? (
                            <img
                              src={dish.image_url}
                              alt={dish.name}
                              className={`w-full h-full object-cover object-center ${burgouzzZoomLevel}`}
                            />
                          ) : isPng ? (
                            <img
                              src={dish.image_url}
                              alt={dish.name}
                              className={`w-full h-full object-contain object-center ${isBlackWhite ? 'scale-150' : zoomLevel} drop-shadow-xl ${isBurgerKing ? 'px-4' : 'px-4'}`}
                            />
                          ) : (
                            <img
                              src={dish.image_url}
                              alt={dish.name}
                              className={`w-full h-full object-cover object-center ${shouldZoom ? zoomLevel : ''}`}
                            />
                          )
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-slate-500">Pas d'image</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="px-3 py-3 space-y-1">
                    <p className="text-sm font-semibold truncate">{dish.name}</p>
                    {(dish.is_signature || dish.is_limited_edition) && (
                      <div className="flex gap-2 flex-wrap">
                        {dish.is_signature && (
                          <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                            Plat signature
                          </span>
                        )}
                        {dish.is_limited_edition && (
                          <span className="inline-flex items-center rounded-full bg-bitebox/60 text-white text-[10px] font-semibold px-2 py-[1px]">
                            Édition limitée
                          </span>
                        )}
                      </div>
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
                                    ? "text-yellow-400"
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
          ) : (
            // Affichage groupé par sections
            <div className="space-y-6">
              {categories
                .filter((category) => dishes.some((d) => d.category_id === category.id))
                .map((category) => {
                const categoryDishes = dishes.filter((d) => d.category_id === category.id);
                const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");

                return (
                  <div key={category.id} id={`section-${category.id}`} className={`${isBurgerKing ? 'space-y-1 pt-1' : 'space-y-3 pt-4'}`}>
                    <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">
                      {category.name}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {categoryDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col"
                        >
                          {(() => {
                            const isPng = dish.image_url?.toLowerCase().includes(".png");
                            const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");
                            const isBlackWhite = restaurant?.name?.toLowerCase().includes("black") && restaurant?.name?.toLowerCase().includes("white");
                            const dishCategory = categories.find(cat => cat.id === dish.category_id) || null;
                            const { shouldZoom, zoomLevel, shouldCenter } = getPopeyesDishZoom(dish, dishCategory, restaurant);
                            const { shouldCover: shouldCoverBurgouzz, zoomLevel: burgouzzZoomLevel } = getBurgouzzDishCover(dish, dishCategory, restaurant);
                            return (
                              <div className={`relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-amber-50 border border-amber-200 ${isPng && !shouldCoverBurgouzz ? 'py-2' : ''}`}>
                                {dish.image_url ? (
                                  shouldCoverBurgouzz ? (
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className={`w-full h-full object-cover object-center ${burgouzzZoomLevel}`}
                                    />
                                  ) : isPng ? (
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className={`w-full h-full object-contain object-center ${isBlackWhite ? 'scale-150' : zoomLevel} drop-shadow-xl ${isBurgerKing ? 'px-4' : 'px-4'}`}
                                    />
                                  ) : (
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className={`w-full h-full object-cover object-center ${shouldZoom ? zoomLevel : ''}`}
                                    />
                                  )
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs text-slate-500">Pas d'image</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <div className="px-3 py-3 space-y-1">
                            <p className="text-sm font-semibold truncate">{dish.name}</p>
                            {(dish.is_signature || dish.is_limited_edition) && (
                              <div className="flex gap-2 flex-wrap">
                                {dish.is_signature && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Plat signature
                                  </span>
                                )}
                                {dish.is_limited_edition && (
                                  <span className="inline-flex items-center rounded-full bg-amber-500/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Édition limitée
                                  </span>
                                )}
                              </div>
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
                                            ? "text-yellow-400"
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
                  </div>
                );
              })}
              
              {/* Plats sans section */}
              {(() => {
                const dishesWithoutCategory = dishes.filter((d) => !d.category_id);
                if (dishesWithoutCategory.length === 0) return null;
                const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");

                return (
                  <div className={isBurgerKing ? "space-y-1" : "space-y-3"}>
                    <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">
                      Autres
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {dishesWithoutCategory.map((dish) => (
                        <div
                          key={dish.id}
                          className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800/70 shadow-md flex flex-col"
                        >
                          {(() => {
                            const isPng = dish.image_url?.toLowerCase().includes(".png");
                            const isBurgerKing = restaurant?.name?.toLowerCase().includes("burger king") || restaurant?.slug?.toLowerCase().includes("burger-king");
                            const isBlackWhite = restaurant?.name?.toLowerCase().includes("black") && restaurant?.name?.toLowerCase().includes("white");
                            const dishCategory = categories.find(cat => cat.id === dish.category_id) || null;
                            const { shouldZoom, zoomLevel, shouldCenter } = getPopeyesDishZoom(dish, dishCategory, restaurant);
                            const { shouldCover: shouldCoverBurgouzz, zoomLevel: burgouzzZoomLevel } = getBurgouzzDishCover(dish, dishCategory, restaurant);
                            return (
                              <div className={`relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-amber-50 border border-amber-200 ${isPng && !shouldCoverBurgouzz ? 'py-2' : ''}`}>
                                {dish.image_url ? (
                                  shouldCoverBurgouzz ? (
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className={`w-full h-full object-cover object-center ${burgouzzZoomLevel}`}
                                    />
                                  ) : isPng ? (
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className={`w-full h-full object-contain object-center ${isBlackWhite ? 'scale-150' : zoomLevel} drop-shadow-xl ${isBurgerKing ? 'px-4' : 'px-4'}`}
                                    />
                                  ) : (
                                    <img
                                      src={dish.image_url}
                                      alt={dish.name}
                                      className={`w-full h-full object-cover object-center ${shouldZoom ? zoomLevel : ''}`}
                                    />
                                  )
                                ) : (
                                  <span className="text-xs text-slate-500">Pas d'image</span>
                                )}
                              </div>
                            );
                          })()}

                          <div className="px-3 py-3 space-y-1">
                            <p className="text-sm font-semibold truncate">{dish.name}</p>
                            {(dish.is_signature || dish.is_limited_edition) && (
                              <div className="flex gap-2 flex-wrap">
                                {dish.is_signature && (
                                  <span className="inline-flex items-center rounded-full bg-bitebox/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Plat signature
                                  </span>
                                )}
                                {dish.is_limited_edition && (
                                  <span className="inline-flex items-center rounded-full bg-amber-500/90 text-white text-[10px] font-semibold px-2 py-[1px]">
                                    Édition limitée
                                  </span>
                                )}
                              </div>
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
                                            ? "text-yellow-400"
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
                  </div>
                );
              })()}
            </div>
          )}
        </section>
      </div>
      {/* Modal uniquement sur desktop */}
      {!isMobile && (
        <AddExperienceModal
          isOpen={isAddExperienceOpen}
          onClose={() => setIsAddExperienceOpen(false)}
          presetRestaurantId={restaurant.id}
          presetRestaurantName={restaurant.name}
        />
      )}
    </div>
  );
}
